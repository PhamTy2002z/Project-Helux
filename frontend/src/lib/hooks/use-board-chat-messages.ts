import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  createBoardMemoryApiV1BoardsBoardIdMemoryPost,
  listBoardMemoryApiV1BoardsBoardIdMemoryGet,
  streamBoardMemoryApiV1BoardsBoardIdMemoryStreamGet,
} from "@/api/generated/board-memory/board-memory";
import type { BoardMemoryRead } from "@/api/generated/model";
import { apiDatetimeToMs } from "@/lib/datetime";
import { DEFAULT_HUMAN_LABEL, resolveHumanActorName } from "@/lib/display-name";
import { useSSEStream } from "@/lib/hooks/use-sse-stream";

const PAGE_SIZE = 30;
const AWAITING_REPLY_TIMEOUT_MS = 45_000;
const SESSION_CACHE_TTL_MS = 30_000;

type UseBoardChatMessagesOptions = {
  boardId: string;
  chatSessionId: string | null;
  enabled: boolean;
  source: string;
  onMessageCreated?: (message: BoardMemoryRead) => void;
  /** Skip initial fetch for freshly created sessions (known empty). */
  skipInitialFetch?: boolean;
};

type UseBoardChatMessagesResult = {
  messages: BoardMemoryRead[];
  isLoading: boolean;
  isLoadingOlder: boolean;
  isSending: boolean;
  isAwaitingReply: boolean;
  hasMore: boolean;
  error: string | null;
  loadOlder: () => Promise<void>;
  sendMessage: (
    content: string,
    fileIds?: string[],
    attachments?: MessageAttachment[],
  ) => Promise<boolean>;
};

export type MessageAttachment = {
  id: string;
  file_name: string;
  status: string;
};

type BoardMemoryWithAttachments = BoardMemoryRead & {
  attachments?: MessageAttachment[];
};

type SessionCacheEntry = {
  messages: BoardMemoryRead[];
  hasMore: boolean;
  fetchedCount: number;
  fetchedAt: number;
};

const toSessionCacheKey = (boardId: string, sessionId: string): string =>
  `${boardId}:${sessionId}`;

const compareMessagesAsc = (
  left: BoardMemoryRead,
  right: BoardMemoryRead,
): number => {
  const leftTime = apiDatetimeToMs(left.created_at) ?? 0;
  const rightTime = apiDatetimeToMs(right.created_at) ?? 0;
  if (leftTime !== rightTime) return leftTime - rightTime;
  return left.id.localeCompare(right.id);
};

const sortAsc = (items: BoardMemoryRead[]): BoardMemoryRead[] =>
  [...items].sort(compareMessagesAsc);

const findInsertionIndex = (
  items: BoardMemoryRead[],
  incoming: BoardMemoryRead,
): number => {
  let low = 0;
  let high = items.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const candidate = items[middle];
    if (compareMessagesAsc(candidate, incoming) <= 0) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
};

const preserveExistingAttachments = (
  existing: BoardMemoryRead,
  incoming: BoardMemoryRead,
): BoardMemoryRead => {
  const existingAttachments = (existing as BoardMemoryWithAttachments)
    .attachments;
  const incomingAttachments = (incoming as BoardMemoryWithAttachments)
    .attachments;
  if (!existingAttachments?.length || incomingAttachments?.length) {
    return incoming;
  }
  return {
    ...(incoming as BoardMemoryWithAttachments),
    attachments: existingAttachments,
  } as BoardMemoryRead;
};

const upsertSortedMessage = (
  items: BoardMemoryRead[],
  incoming: BoardMemoryRead,
  /** Optional id->index map for O(1) lookups; mutated in place on insert/update. */
  idIndex?: Map<string, number>,
): BoardMemoryRead[] => {
  const existingIndex = idIndex
    ? (idIndex.get(incoming.id) ?? -1)
    : items.findIndex((message) => message.id === incoming.id);

  if (existingIndex === -1) {
    const insertionIndex = findInsertionIndex(items, incoming);
    const result = [
      ...items.slice(0, insertionIndex),
      incoming,
      ...items.slice(insertionIndex),
    ];
    // Update index: entries at/after insertionIndex shifted +1
    if (idIndex) {
      for (const [id, idx] of idIndex) {
        if (idx >= insertionIndex) idIndex.set(id, idx + 1);
      }
      idIndex.set(incoming.id, insertionIndex);
    }
    return result;
  }

  if (items[existingIndex] === incoming) {
    return items;
  }

  const normalizedIncoming = preserveExistingAttachments(
    items[existingIndex],
    incoming,
  );
  const withoutExisting = [
    ...items.slice(0, existingIndex),
    ...items.slice(existingIndex + 1),
  ];
  const insertionIndex = findInsertionIndex(
    withoutExisting,
    normalizedIncoming,
  );
  const result = [
    ...withoutExisting.slice(0, insertionIndex),
    normalizedIncoming,
    ...withoutExisting.slice(insertionIndex),
  ];
  // Rebuild id->index map from scratch (update is rare)
  if (idIndex) {
    idIndex.clear();
    for (let i = 0; i < result.length; i++) idIndex.set(result[i].id, i);
  }
  return result;
};

const mergeMessagesById = (
  base: BoardMemoryRead[],
  ...collections: BoardMemoryRead[][]
): BoardMemoryRead[] => {
  // Build id->index map once for O(1) lookups during merge
  const idIndex = new Map<string, number>();
  for (let i = 0; i < base.length; i++) idIndex.set(base[i].id, i);

  let merged = base;
  for (const collection of collections) {
    for (const message of collection) {
      merged = upsertSortedMessage(merged, message, idIndex);
    }
  }
  return merged;
};

const latestTimestamp = (items: BoardMemoryRead[]): string | undefined => {
  const latest = items.reduce((max, item) => {
    const value = apiDatetimeToMs(item.created_at);
    return value === null ? max : Math.max(max, value);
  }, 0);
  if (!latest) return undefined;
  return new Date(latest).toISOString();
};

export const useBoardChatMessages = ({
  boardId,
  chatSessionId,
  enabled,
  source,
  onMessageCreated,
  skipInitialFetch,
}: UseBoardChatMessagesOptions): UseBoardChatMessagesResult => {
  const [messages, setMessages] = useState<BoardMemoryRead[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isAwaitingReply, setIsAwaitingReply] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const fetchedCountRef = useRef(0);
  const messagesRef = useRef<BoardMemoryRead[]>([]);
  const sessionCacheRef = useRef<Map<string, SessionCacheEntry>>(new Map());
  const awaitingReplySourceRef = useRef<string | null>(null);
  const awaitingSinceRef = useRef<number>(0);

  const clearAwaitingReply = useCallback(() => {
    awaitingReplySourceRef.current = null;
    awaitingSinceRef.current = 0;
    setIsAwaitingReply(false);
  }, []);

  const startAwaitingReply = useCallback(
    (sinceMs: number) => {
      awaitingReplySourceRef.current = source;
      awaitingSinceRef.current = sinceMs;
      setIsAwaitingReply(true);
    },
    [source],
  );

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const resetState = useCallback(
    (clearError = false) => {
      setMessages([]);
      setHasMore(false);
      fetchedCountRef.current = 0;
      clearAwaitingReply();
      if (clearError) {
        setError(null);
      }
    },
    [clearAwaitingReply],
  );

  useEffect(() => {
    if (!isAwaitingReply || !awaitingSinceRef.current) return;
    const elapsed = Date.now() - awaitingSinceRef.current;
    const remaining = AWAITING_REPLY_TIMEOUT_MS - elapsed;
    if (remaining <= 0) {
      clearAwaitingReply();
      return;
    }
    const timeoutId = window.setTimeout(() => {
      clearAwaitingReply();
    }, remaining);
    return () => window.clearTimeout(timeoutId);
  }, [clearAwaitingReply, isAwaitingReply]);

  const skipInitialFetchRef = useRef(skipInitialFetch);
  skipInitialFetchRef.current = skipInitialFetch;

  const restoreAwaitingReplyFromItems = useCallback(
    (items: BoardMemoryRead[]) => {
      if (items.length === 0) {
        clearAwaitingReply();
        return;
      }
      const lastMsg = items[items.length - 1];
      const lastSource = resolveHumanActorName(lastMsg.source, DEFAULT_HUMAN_LABEL);
      if (lastSource !== source) {
        clearAwaitingReply();
        return;
      }
      const lastAt = apiDatetimeToMs(lastMsg.created_at) ?? 0;
      const age = lastAt ? Date.now() - lastAt : Number.POSITIVE_INFINITY;
      if (age <= AWAITING_REPLY_TIMEOUT_MS) {
        startAwaitingReply(lastAt || Date.now());
      } else {
        clearAwaitingReply();
      }
    },
    [clearAwaitingReply, source, startAwaitingReply],
  );

  const writeSessionCache = useCallback(
    (sessionId: string, entry: SessionCacheEntry) => {
      sessionCacheRef.current.set(sessionId, entry);
    },
    [],
  );

  const fetchLatest = useCallback(async () => {
    if (!boardId || !chatSessionId) {
      resetState(true);
      return;
    }
    if (!enabled) {
      setIsLoading(false);
      setError(null);
      return;
    }

    const cacheKey = toSessionCacheKey(boardId, chatSessionId);
    const cached = sessionCacheRef.current.get(cacheKey);
    if (cached) {
      fetchedCountRef.current = cached.fetchedCount;
      setHasMore(cached.hasMore);
      setMessages(cached.messages);
      restoreAwaitingReplyFromItems(cached.messages);
    } else {
      fetchedCountRef.current = 0;
      setHasMore(false);
      setMessages([]);
      clearAwaitingReply();
    }

    if (cached && Date.now() - cached.fetchedAt < SESSION_CACHE_TTL_MS) {
      setError(null);
      return;
    }

    // Fresh session — known empty, skip the network call
    if (skipInitialFetchRef.current) {
      skipInitialFetchRef.current = false;
      resetState(true);
      writeSessionCache(cacheKey, {
        messages: [],
        hasMore: false,
        fetchedCount: 0,
        fetchedAt: Date.now(),
      });
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await listBoardMemoryApiV1BoardsBoardIdMemoryGet(boardId, {
        is_chat: true,
        chat_session_id: chatSessionId,
        limit: PAGE_SIZE,
        offset: 0,
      });
      if (result.status !== 200) {
        throw new Error("Unable to load chat messages.");
      }
      const items = sortAsc(result.data.items ?? []);
      fetchedCountRef.current = items.length;
      const nextHasMore =
        (result.data.total ?? items.length) > fetchedCountRef.current;
      setHasMore(nextHasMore);
      setMessages(items);
      writeSessionCache(cacheKey, {
        messages: items,
        hasMore: nextHasMore,
        fetchedCount: items.length,
        fetchedAt: Date.now(),
      });

      restoreAwaitingReplyFromItems(items);
    } catch (nextError) {
      resetState();
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to load chat messages.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [
    boardId,
    chatSessionId,
    clearAwaitingReply,
    enabled,
    resetState,
    restoreAwaitingReplyFromItems,
    writeSessionCache,
  ]);

  useEffect(() => {
    void fetchLatest();
  }, [fetchLatest]);

  const loadOlder = useCallback(async () => {
    if (!enabled || !boardId || !chatSessionId) return;
    if (isLoadingOlder || !hasMore) return;
    setIsLoadingOlder(true);
    try {
      const offset = fetchedCountRef.current;
      const result = await listBoardMemoryApiV1BoardsBoardIdMemoryGet(boardId, {
        is_chat: true,
        chat_session_id: chatSessionId,
        limit: PAGE_SIZE,
        offset,
      });
      if (result.status !== 200) {
        throw new Error("Unable to load older messages.");
      }
      const incoming = result.data.items ?? [];
      fetchedCountRef.current += incoming.length;
      const nextHasMore =
        (result.data.total ?? fetchedCountRef.current) >
        fetchedCountRef.current;
      setHasMore(nextHasMore);
      const sessionId = chatSessionId;
      setMessages((prev) => {
        const merged = mergeMessagesById(prev, incoming);
        if (sessionId) {
          writeSessionCache(toSessionCacheKey(boardId, sessionId), {
            messages: merged,
            hasMore: nextHasMore,
            fetchedCount: fetchedCountRef.current,
            fetchedAt: Date.now(),
          });
        }
        return merged;
      });
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to load older messages.",
      );
    } finally {
      setIsLoadingOlder(false);
    }
  }, [
    boardId,
    chatSessionId,
    enabled,
    hasMore,
    isLoadingOlder,
    writeSessionCache,
  ]);

  const sendMessage = useCallback(
    async (
      content: string,
      fileIds?: string[],
      attachments?: MessageAttachment[],
    ): Promise<boolean> => {
      if (!enabled || !boardId || !chatSessionId) return false;
      const trimmed = content.trim();
      if (!trimmed) return false;

      clearAwaitingReply();
      setIsSending(true);
      setError(null);
      try {
        const result = await createBoardMemoryApiV1BoardsBoardIdMemoryPost(
          boardId,
          {
            content: trimmed,
            tags: ["chat"],
            source,
            chat_session_id: chatSessionId,
            ...(fileIds?.length ? { file_ids: fileIds } : {}),
          },
        );
        if (result.status !== 200) {
          throw new Error("Unable to send message.");
        }
        const created = result.data as BoardMemoryWithAttachments;
        const createdWithAttachments =
          attachments?.length && !created.attachments?.length
            ? { ...created, attachments }
            : created;
        const sessionId = chatSessionId;
        setMessages((prev) => {
          const merged = mergeMessagesById(prev, [
            createdWithAttachments as BoardMemoryRead,
          ]);
          if (sessionId) {
            writeSessionCache(toSessionCacheKey(boardId, sessionId), {
              messages: merged,
              hasMore,
              fetchedCount: Math.max(fetchedCountRef.current, merged.length),
              fetchedAt: Date.now(),
            });
          }
          return merged;
        });
        onMessageCreated?.(createdWithAttachments as BoardMemoryRead);
        startAwaitingReply(
          apiDatetimeToMs(createdWithAttachments.created_at) ?? Date.now(),
        );
        return true;
      } catch (nextError) {
        clearAwaitingReply();
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Unable to send message.",
        );
        return false;
      } finally {
        setIsSending(false);
      }
    },
    [
      boardId,
      chatSessionId,
      clearAwaitingReply,
      enabled,
      hasMore,
      onMessageCreated,
      source,
      startAwaitingReply,
      writeSessionCache,
    ],
  );

  useSSEStream({
    enabled: enabled && !!boardId && !!chatSessionId,
    key: `${boardId}-${chatSessionId}`,
    connect: async (signal) => {
      const since = latestTimestamp(messagesRef.current);
      const streamResult =
        await streamBoardMemoryApiV1BoardsBoardIdMemoryStreamGet(
          boardId,
          {
            is_chat: true,
            chat_session_id: chatSessionId!,
            ...(since ? { since } : {}),
          },
          {
            headers: { Accept: "text/event-stream" },
            signal,
          },
        );
      if (streamResult.status !== 200) {
        throw new Error("Unable to connect board chat stream.");
      }
      return streamResult.data as Response;
    },
    onEvent: (event) => {
      if (event.eventType === "memory" && event.data) {
        try {
          const payload = JSON.parse(event.data) as {
            memory?: BoardMemoryRead;
          };
          if (payload.memory?.tags?.includes("chat")) {
            const mem = payload.memory as BoardMemoryRead;
            const sessionId = chatSessionId;
            setMessages((prev) => {
              const merged = mergeMessagesById(prev, [mem]);
              if (sessionId) {
                writeSessionCache(toSessionCacheKey(boardId, sessionId), {
                  messages: merged,
                  hasMore,
                  fetchedCount: Math.max(fetchedCountRef.current, merged.length),
                  fetchedAt: Date.now(),
                });
              }
              return merged;
            });
            onMessageCreated?.(mem);
            if (
              awaitingReplySourceRef.current &&
              resolveHumanActorName(mem.source, DEFAULT_HUMAN_LABEL) !==
                awaitingReplySourceRef.current &&
              (apiDatetimeToMs(mem.created_at) ?? Date.now()) >=
                awaitingSinceRef.current
            ) {
              clearAwaitingReply();
            }
          }
        } catch {
          // Ignore malformed stream payloads.
        }
      }
    },
  });

  return useMemo(
    () => ({
      messages,
      isLoading,
      isLoadingOlder,
      isSending,
      isAwaitingReply,
      hasMore,
      error,
      loadOlder,
      sendMessage,
    }),
    [
      error,
      hasMore,
      isAwaitingReply,
      isLoading,
      isLoadingOlder,
      isSending,
      loadOlder,
      messages,
      sendMessage,
    ],
  );
};

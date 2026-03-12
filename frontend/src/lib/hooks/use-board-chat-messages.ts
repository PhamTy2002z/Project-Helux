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

const PAGE_SIZE = 50;

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
  const existingAttachments = (existing as BoardMemoryWithAttachments).attachments;
  const incomingAttachments = (incoming as BoardMemoryWithAttachments).attachments;
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
): BoardMemoryRead[] => {
  const existingIndex = items.findIndex((message) => message.id === incoming.id);
  if (existingIndex === -1) {
    const insertionIndex = findInsertionIndex(items, incoming);
    return [
      ...items.slice(0, insertionIndex),
      incoming,
      ...items.slice(insertionIndex),
    ];
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
  const insertionIndex = findInsertionIndex(withoutExisting, normalizedIncoming);
  return [
    ...withoutExisting.slice(0, insertionIndex),
    normalizedIncoming,
    ...withoutExisting.slice(insertionIndex),
  ];
};

const mergeMessagesById = (
  base: BoardMemoryRead[],
  ...collections: BoardMemoryRead[][]
): BoardMemoryRead[] => {
  let merged = base;
  for (const collection of collections) {
    for (const message of collection) {
      merged = upsertSortedMessage(merged, message);
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
  const awaitingReplySourceRef = useRef<string | null>(null);
  const awaitingSinceRef = useRef<number>(0);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const resetState = useCallback((clearError = false) => {
    setMessages([]);
    setHasMore(false);
    fetchedCountRef.current = 0;
    awaitingReplySourceRef.current = null;
    awaitingSinceRef.current = 0;
    setIsAwaitingReply(false);
    if (clearError) {
      setError(null);
    }
  }, []);

  const skipInitialFetchRef = useRef(skipInitialFetch);
  skipInitialFetchRef.current = skipInitialFetch;

  const fetchLatest = useCallback(async () => {
    if (!enabled || !boardId || !chatSessionId) {
      resetState(true);
      return;
    }
    // Fresh session — known empty, skip the network call
    if (skipInitialFetchRef.current) {
      skipInitialFetchRef.current = false;
      resetState(true);
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
      setHasMore((result.data.total ?? items.length) > fetchedCountRef.current);
      setMessages(items);

      // Restore awaiting-reply state: if the latest message is from the
      // current user, the agent hasn't replied yet.
      if (items.length > 0) {
        const lastMsg = items[items.length - 1];
        const lastSource = resolveHumanActorName(lastMsg.source, DEFAULT_HUMAN_LABEL);
        if (lastSource === source) {
          awaitingReplySourceRef.current = source;
          awaitingSinceRef.current = apiDatetimeToMs(lastMsg.created_at) ?? Date.now();
          setIsAwaitingReply(true);
        }
      }
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
  }, [boardId, chatSessionId, enabled, resetState]);

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
      setHasMore(
        (result.data.total ?? fetchedCountRef.current) >
          fetchedCountRef.current,
      );
      setMessages((prev) => mergeMessagesById(prev, incoming));
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to load older messages.",
      );
    } finally {
      setIsLoadingOlder(false);
    }
  }, [boardId, chatSessionId, enabled, hasMore, isLoadingOlder]);

  const sendMessage = useCallback(
    async (
      content: string,
      fileIds?: string[],
      attachments?: MessageAttachment[],
    ): Promise<boolean> => {
      if (!enabled || !boardId || !chatSessionId) return false;
      const trimmed = content.trim();
      if (!trimmed) return false;

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
        setMessages((prev) => mergeMessagesById(prev, [createdWithAttachments]));
        onMessageCreated?.(createdWithAttachments);
        awaitingReplySourceRef.current = source;
        awaitingSinceRef.current = Date.now();
        setIsAwaitingReply(true);
        return true;
      } catch (nextError) {
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
    [boardId, chatSessionId, enabled, onMessageCreated, source],
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
            setMessages((prev) => mergeMessagesById(prev, [mem]));
            onMessageCreated?.(mem);
            if (
              awaitingReplySourceRef.current &&
              mem.source !== awaitingReplySourceRef.current
            ) {
              awaitingReplySourceRef.current = null;
              setIsAwaitingReply(false);
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

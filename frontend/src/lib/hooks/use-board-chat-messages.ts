import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  createBoardMemoryApiV1BoardsBoardIdMemoryPost,
  listBoardMemoryApiV1BoardsBoardIdMemoryGet,
  streamBoardMemoryApiV1BoardsBoardIdMemoryStreamGet,
} from "@/api/generated/board-memory/board-memory";
import type { BoardMemoryRead } from "@/api/generated/model";
import { createExponentialBackoff } from "@/lib/backoff";
import { apiDatetimeToMs } from "@/lib/datetime";

const PAGE_SIZE = 50;

type UseBoardChatMessagesOptions = {
  boardId: string;
  chatSessionId: string | null;
  enabled: boolean;
  source: string;
  onMessageCreated?: (message: BoardMemoryRead) => void;
};

type UseBoardChatMessagesResult = {
  messages: BoardMemoryRead[];
  isLoading: boolean;
  isLoadingOlder: boolean;
  isSending: boolean;
  hasMore: boolean;
  error: string | null;
  loadOlder: () => Promise<void>;
  sendMessage: (content: string) => Promise<boolean>;
};

const sortAsc = (items: BoardMemoryRead[]): BoardMemoryRead[] => {
  return [...items].sort((a, b) => {
    const aTime = apiDatetimeToMs(a.created_at) ?? 0;
    const bTime = apiDatetimeToMs(b.created_at) ?? 0;
    return aTime - bTime;
  });
};

const mergeMessagesById = (
  ...collections: BoardMemoryRead[][]
): BoardMemoryRead[] => {
  const byId = new Map<string, BoardMemoryRead>();
  for (const collection of collections) {
    for (const message of collection) {
      byId.set(message.id, message);
    }
  }
  return sortAsc([...byId.values()]);
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
}: UseBoardChatMessagesOptions): UseBoardChatMessagesResult => {
  const [messages, setMessages] = useState<BoardMemoryRead[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const fetchedCountRef = useRef(0);
  const messagesRef = useRef<BoardMemoryRead[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const resetState = useCallback((clearError = false) => {
    setMessages([]);
    setHasMore(false);
    fetchedCountRef.current = 0;
    if (clearError) {
      setError(null);
    }
  }, []);

  const fetchLatest = useCallback(async () => {
    if (!enabled || !boardId || !chatSessionId) {
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
      const incoming = sortAsc(result.data.items ?? []);
      fetchedCountRef.current += incoming.length;
      setHasMore(
        (result.data.total ?? fetchedCountRef.current) >
          fetchedCountRef.current,
      );
      setMessages((prev) => mergeMessagesById(incoming, prev));
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
    async (content: string): Promise<boolean> => {
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
          },
        );
        if (result.status !== 200) {
          throw new Error("Unable to send message.");
        }
        const created = result.data;
        setMessages((prev) => mergeMessagesById(prev, [created]));
        onMessageCreated?.(created);
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

  useEffect(() => {
    if (!enabled || !boardId || !chatSessionId) return;

    let cancelled = false;
    const abortController = new AbortController();
    const backoff = createExponentialBackoff();
    let reconnectTimeout: number | undefined;

    const connect = async () => {
      try {
        const since = latestTimestamp(messagesRef.current);
        const streamResult =
          await streamBoardMemoryApiV1BoardsBoardIdMemoryStreamGet(
            boardId,
            {
              is_chat: true,
              chat_session_id: chatSessionId,
              ...(since ? { since } : {}),
            },
            {
              headers: { Accept: "text/event-stream" },
              signal: abortController.signal,
            },
          );
        if (streamResult.status !== 200) {
          throw new Error("Unable to connect board chat stream.");
        }
        const response = streamResult.data as Response;
        if (!(response instanceof Response) || !response.body) {
          throw new Error("Unable to connect board chat stream.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!cancelled) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value && value.length) {
            backoff.reset();
          }
          buffer += decoder.decode(value, { stream: true });
          buffer = buffer.replace(/\r\n/g, "\n");

          let boundary = buffer.indexOf("\n\n");
          while (boundary !== -1) {
            const chunk = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);

            let eventType = "message";
            let data = "";
            for (const line of chunk.split("\n")) {
              if (line.startsWith("event:")) {
                eventType = line.slice(6).trim();
              } else if (line.startsWith("data:")) {
                data += line.slice(5).trim();
              }
            }

            if (eventType === "memory" && data) {
              try {
                const payload = JSON.parse(data) as {
                  memory?: BoardMemoryRead;
                };
                if (payload.memory?.tags?.includes("chat")) {
                  setMessages((prev) =>
                    mergeMessagesById(prev, [
                      payload.memory as BoardMemoryRead,
                    ]),
                  );
                  onMessageCreated?.(payload.memory as BoardMemoryRead);
                }
              } catch {
                // Ignore malformed stream payloads.
              }
            }

            boundary = buffer.indexOf("\n\n");
          }
        }
      } catch {
        // Reconnect handled below.
      }

      if (!cancelled) {
        const delay = backoff.nextDelayMs();
        reconnectTimeout = window.setTimeout(() => {
          reconnectTimeout = undefined;
          void connect();
        }, delay);
      }
    };

    void connect();

    return () => {
      cancelled = true;
      abortController.abort();
      if (reconnectTimeout !== undefined) {
        window.clearTimeout(reconnectTimeout);
      }
    };
  }, [boardId, chatSessionId, enabled, onMessageCreated]);

  return useMemo(
    () => ({
      messages,
      isLoading,
      isLoadingOlder,
      isSending,
      hasMore,
      error,
      loadOlder,
      sendMessage,
    }),
    [
      error,
      hasMore,
      isLoading,
      isLoadingOlder,
      isSending,
      loadOlder,
      messages,
      sendMessage,
    ],
  );
};

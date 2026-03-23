import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BoardMemoryRead } from "@/api/generated/model";

import { useBoardChatMessages } from "./use-board-chat-messages";

const listBoardMemoryMock = vi.fn();
const createBoardMemoryMock = vi.fn();
const useSSEStreamMock = vi.fn();

vi.mock("@/api/generated/board-memory/board-memory", () => ({
  listBoardMemoryApiV1BoardsBoardIdMemoryGet: (...args: unknown[]) =>
    listBoardMemoryMock(...args),
  createBoardMemoryApiV1BoardsBoardIdMemoryPost: (...args: unknown[]) =>
    createBoardMemoryMock(...args),
  streamBoardMemoryApiV1BoardsBoardIdMemoryStreamGet: vi.fn(),
}));

vi.mock("@/lib/hooks/use-sse-stream", () => ({
  useSSEStream: (...args: unknown[]) => useSSEStreamMock(...args),
}));

const makeMessage = (
  overrides: Partial<BoardMemoryRead> = {},
): BoardMemoryRead =>
  ({
    id: "msg-1",
    board_id: "board-1",
    content: "hello",
    tags: ["chat"],
    source: "Pham",
    is_chat: true,
    chat_session_id: "session-1",
    created_at: new Date().toISOString(),
    ...overrides,
  }) as BoardMemoryRead;

describe("useBoardChatMessages", () => {
  beforeEach(() => {
    listBoardMemoryMock.mockReset();
    createBoardMemoryMock.mockReset();
    useSSEStreamMock.mockReset();
    listBoardMemoryMock.mockResolvedValue({
      status: 200,
      data: { items: [], total: 0 },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not restore awaiting state for stale user messages", async () => {
    listBoardMemoryMock.mockResolvedValueOnce({
      status: 200,
      data: {
        items: [
          makeMessage({
            created_at: new Date(Date.now() - 120_000).toISOString(),
            source: "Pham",
          }),
        ],
        total: 1,
      },
    });

    const { result } = renderHook(() =>
      useBoardChatMessages({
        boardId: "board-1",
        chatSessionId: "session-1",
        enabled: true,
        source: "Pham",
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAwaitingReply).toBe(false);
  });

  it("clears awaiting state when send fails", async () => {
    createBoardMemoryMock.mockRejectedValueOnce(new Error("send failed"));

    const { result } = renderHook(() =>
      useBoardChatMessages({
        boardId: "board-1",
        chatSessionId: "session-1",
        enabled: true,
        source: "Pham",
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const ok = await act(async () => result.current.sendMessage("hello"));

    expect(ok).toBe(false);
    expect(result.current.isSending).toBe(false);
    expect(result.current.isAwaitingReply).toBe(false);
  });

  it("auto-clears awaiting state after timeout", async () => {
    vi.useFakeTimers();

    createBoardMemoryMock.mockResolvedValueOnce({
      status: 200,
      data: makeMessage({
        id: "msg-2",
        content: "new message",
        source: "Pham",
        created_at: new Date().toISOString(),
      }),
    });

    const { result } = renderHook(() =>
      useBoardChatMessages({
        boardId: "board-1",
        chatSessionId: "session-1",
        enabled: true,
        source: "Pham",
      }),
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const ok = await act(async () => result.current.sendMessage("hello"));
    expect(ok).toBe(true);
    expect(result.current.isAwaitingReply).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(45_001);
      await Promise.resolve();
    });

    expect(result.current.isAwaitingReply).toBe(false);
  });

  it("keeps in-memory messages when chat panel is temporarily disabled", async () => {
    listBoardMemoryMock.mockResolvedValueOnce({
      status: 200,
      data: {
        items: [makeMessage({ id: "msg-keep" })],
        total: 1,
      },
    });

    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useBoardChatMessages({
          boardId: "board-1",
          chatSessionId: "session-1",
          enabled,
          source: "Pham",
        }),
      {
        initialProps: { enabled: true },
      },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.messages.map((m) => m.id)).toEqual(["msg-keep"]);
    expect(listBoardMemoryMock).toHaveBeenCalledTimes(1);

    rerender({ enabled: false });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.messages.map((m) => m.id)).toEqual(["msg-keep"]);

    rerender({ enabled: true });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.messages.map((m) => m.id)).toEqual(["msg-keep"]);
    expect(listBoardMemoryMock).toHaveBeenCalledTimes(1);
  });

  it("clears stale previous-session messages while loading uncached session", async () => {
    let resolveSession2!: (value: {
      status: number;
      data: { items: BoardMemoryRead[]; total: number };
    }) => void;

    listBoardMemoryMock.mockImplementation(
      async (
        _boardId: string,
        params: { chat_session_id?: string | null } = {},
      ) => {
        if (params.chat_session_id === "session-1") {
          return {
            status: 200,
            data: {
              items: [
                makeMessage({ id: "msg-s1", chat_session_id: "session-1" }),
              ],
              total: 1,
            },
          };
        }
        if (params.chat_session_id === "session-2") {
          return await new Promise<{
            status: number;
            data: { items: BoardMemoryRead[]; total: number };
          }>((resolve) => {
            resolveSession2 = resolve;
          });
        }
        return { status: 200, data: { items: [], total: 0 } };
      },
    );

    const { result, rerender } = renderHook(
      ({ chatSessionId }: { chatSessionId: string }) =>
        useBoardChatMessages({
          boardId: "board-1",
          chatSessionId,
          enabled: true,
          source: "Pham",
        }),
      {
        initialProps: { chatSessionId: "session-1" },
      },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.messages.map((m) => m.id)).toEqual(["msg-s1"]);

    rerender({ chatSessionId: "session-2" });
    await waitFor(() => expect(result.current.messages).toEqual([]));

    resolveSession2({
      status: 200,
      data: {
        items: [makeMessage({ id: "msg-s2", chat_session_id: "session-2" })],
        total: 1,
      },
    });

    await waitFor(() =>
      expect(result.current.messages.map((m) => m.id)).toEqual(["msg-s2"]),
    );
  });
});

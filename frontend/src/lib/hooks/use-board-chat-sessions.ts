import { useCallback, useMemo } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  archiveBoardChatSessionApiV1BoardsBoardIdChatSessionsChatSessionIdDelete,
  createBoardChatSessionApiV1BoardsBoardIdChatSessionsPost,
  getListBoardChatSessionsApiV1BoardsBoardIdChatSessionsGetQueryKey,
  listBoardChatSessionsApiV1BoardsBoardIdChatSessionsGet,
  renameBoardChatSessionApiV1BoardsBoardIdChatSessionsChatSessionIdPatch,
} from "@/api/generated/board-chat-sessions/board-chat-sessions";
import type { BoardChatSessionRead } from "@/api/generated/model";

const CHAT_SESSION_DEFAULT_TITLE = "New chat";

const sortSessions = (
  sessions: BoardChatSessionRead[],
): BoardChatSessionRead[] => {
  return [...sessions].sort((a, b) => {
    const aTime = Date.parse(a.updated_at) || Date.parse(a.created_at) || 0;
    const bTime = Date.parse(b.updated_at) || Date.parse(b.created_at) || 0;
    return bTime - aTime;
  });
};

const toError = (fallback: string, cause: unknown): Error => {
  if (cause instanceof Error && cause.message.trim()) {
    return cause;
  }
  return new Error(fallback);
};

export type UseBoardChatSessionsResult = {
  sessions: BoardChatSessionRead[];
  isLoading: boolean;
  isRefetching: boolean;
  error: Error | null;
  createSession: (title?: string) => Promise<BoardChatSessionRead>;
  renameSession: (
    chatSessionId: string,
    title: string,
  ) => Promise<BoardChatSessionRead>;
  archiveSession: (chatSessionId: string) => Promise<void>;
  isCreating: boolean;
  isRenaming: boolean;
  isArchiving: boolean;
  refetch: () => Promise<void>;
};

export const useBoardChatSessions = (
  boardId: string,
  enabled: boolean,
): UseBoardChatSessionsResult => {
  const queryClient = useQueryClient();
  const sessionsQueryKey = useMemo(
    () =>
      getListBoardChatSessionsApiV1BoardsBoardIdChatSessionsGetQueryKey(
        boardId,
      ),
    [boardId],
  );

  const sessionsQuery = useQuery({
    queryKey: sessionsQueryKey,
    enabled: enabled && Boolean(boardId),
    queryFn: async () => {
      const result =
        await listBoardChatSessionsApiV1BoardsBoardIdChatSessionsGet(boardId);
      if (result.status !== 200) {
        throw new Error("Unable to load chat sessions.");
      }
      return sortSessions(result.data ?? []);
    },
    staleTime: 15_000,
  });

  const invalidateSessions = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: sessionsQueryKey,
    });
  }, [queryClient, sessionsQueryKey]);

  const createMutation = useMutation({
    mutationFn: async (title?: string) => {
      const result =
        await createBoardChatSessionApiV1BoardsBoardIdChatSessionsPost(
          boardId,
          {
            title: title?.trim() || CHAT_SESSION_DEFAULT_TITLE,
          },
        );
      if (result.status !== 200) {
        throw new Error("Unable to create chat session.");
      }
      return result.data;
    },
    onSuccess: (created) => {
      // Optimistic: prepend new session to cache immediately instead of refetching
      queryClient.setQueryData<BoardChatSessionRead[]>(
        sessionsQueryKey,
        (prev) => (prev ? [created, ...prev] : [created]),
      );
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({
      chatSessionId,
      title,
    }: {
      chatSessionId: string;
      title: string;
    }) => {
      const result =
        await renameBoardChatSessionApiV1BoardsBoardIdChatSessionsChatSessionIdPatch(
          boardId,
          chatSessionId,
          { title },
        );
      if (result.status !== 200) {
        throw new Error("Unable to rename chat session.");
      }
      return result.data;
    },
    onSuccess: invalidateSessions,
  });

  const archiveMutation = useMutation({
    mutationFn: async (chatSessionId: string) => {
      const result =
        await archiveBoardChatSessionApiV1BoardsBoardIdChatSessionsChatSessionIdDelete(
          boardId,
          chatSessionId,
        );
      if (result.status !== 200) {
        throw new Error("Unable to archive chat session.");
      }
    },
    onSuccess: invalidateSessions,
  });

  const createSession = useCallback(
    async (title?: string) => {
      try {
        return await createMutation.mutateAsync(title);
      } catch (error) {
        throw toError("Unable to create chat session.", error);
      }
    },
    [createMutation],
  );

  const renameSession = useCallback(
    async (chatSessionId: string, title: string) => {
      try {
        return await renameMutation.mutateAsync({ chatSessionId, title });
      } catch (error) {
        throw toError("Unable to rename chat session.", error);
      }
    },
    [renameMutation],
  );

  const archiveSession = useCallback(
    async (chatSessionId: string) => {
      try {
        await archiveMutation.mutateAsync(chatSessionId);
      } catch (error) {
        throw toError("Unable to archive chat session.", error);
      }
    },
    [archiveMutation],
  );

  const refetch = useCallback(async () => {
    await sessionsQuery.refetch();
  }, [sessionsQuery]);

  return useMemo(
    () => ({
      sessions: sessionsQuery.data ?? [],
      isLoading: sessionsQuery.isLoading,
      isRefetching: sessionsQuery.isRefetching,
      error: sessionsQuery.error
        ? toError("Unable to load chat sessions.", sessionsQuery.error)
        : null,
      createSession,
      renameSession,
      archiveSession,
      isCreating: createMutation.isPending,
      isRenaming: renameMutation.isPending,
      isArchiving: archiveMutation.isPending,
      refetch,
    }),
    [
      archiveSession,
      createSession,
      createMutation.isPending,
      refetch,
      renameSession,
      renameMutation.isPending,
      archiveMutation.isPending,
      sessionsQuery.data,
      sessionsQuery.error,
      sessionsQuery.isLoading,
      sessionsQuery.isRefetching,
    ],
  );
};

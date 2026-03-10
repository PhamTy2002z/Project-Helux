import { memo, useCallback, useMemo, useState } from "react";

import { PanelLeftOpen, X } from "lucide-react";

import type { BoardMemoryRead } from "@/api/generated/model";
import { BoardChatSessionList } from "@/components/boards/BoardChatSessionList";
import { BoardChatThread } from "@/components/boards/BoardChatThread";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useBoardChatFiles } from "@/lib/hooks/use-board-chat-files";
import { useBoardChatMessages } from "@/lib/hooks/use-board-chat-messages";
import { useBoardChatSessions } from "@/lib/hooks/use-board-chat-sessions";

type BoardChatPanelProps = {
  boardId: string | undefined;
  isOpen: boolean;
  canWrite: boolean;
  currentUserDisplayName: string;
  mentionSuggestions: string[];
  onClose: () => void;
  onMessageCreated: (message: BoardMemoryRead) => void;
  onError: (message: string) => void;
};

export const BoardChatPanel = memo(function BoardChatPanel({
  boardId,
  isOpen,
  canWrite,
  currentUserDisplayName,
  mentionSuggestions,
  onClose,
  onMessageCreated,
  onError,
}: BoardChatPanelProps) {
  const resolvedBoardId = boardId ?? "";
  const sessionsState = useBoardChatSessions(resolvedBoardId, isOpen);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [focusComposer, setFocusComposer] = useState(false);
  const [archiveTargetId, setArchiveTargetId] = useState<string | null>(null);
  const [isSessionListOpen, setIsSessionListOpen] = useState(false);

  const sessions = sessionsState.sessions;
  const effectiveActiveSessionId = useMemo(() => {
    if (!activeSessionId) {
      return sessions[0]?.id ?? null;
    }
    const exists = sessions.some((session) => session.id === activeSessionId);
    return exists ? activeSessionId : (sessions[0]?.id ?? null);
  }, [activeSessionId, sessions]);
  const archiveTarget = useMemo(
    () => sessions.find((session) => session.id === archiveTargetId) ?? null,
    [archiveTargetId, sessions],
  );

  const triggerComposerFocus = useCallback(() => {
    setFocusComposer(true);
    window.setTimeout(() => setFocusComposer(false), 0);
  }, []);

  const messagesState = useBoardChatMessages({
    boardId: resolvedBoardId,
    chatSessionId: effectiveActiveSessionId,
    enabled: isOpen && Boolean(effectiveActiveSessionId),
    source: currentUserDisplayName,
    onMessageCreated,
  });

  const filesState = useBoardChatFiles({
    boardId: resolvedBoardId,
    chatSessionId: effectiveActiveSessionId,
    enabled: isOpen && Boolean(effectiveActiveSessionId),
  });
  const pendingUploads = filesState.pendingUploads;
  const pendingFileChips = useMemo(
    () =>
      pendingUploads.map((upload) => ({
        id: upload.id,
        fileName: upload.file.name,
        status: upload.status,
      })),
    [pendingUploads],
  );

  const handleCreateSession = useCallback(async () => {
    try {
      const created = await sessionsState.createSession("New chat");
      setActiveSessionId(created.id);
      triggerComposerFocus();
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : "Unable to create chat session.",
      );
    }
  }, [onError, sessionsState, triggerComposerFocus]);

  const handleRenameSession = useCallback(
    async (chatSessionId: string, title: string) => {
      try {
        await sessionsState.renameSession(chatSessionId, title);
      } catch (error) {
        onError(
          error instanceof Error
            ? error.message
            : "Unable to rename chat session.",
        );
      }
    },
    [onError, sessionsState],
  );

  const handleConfirmArchive = useCallback(async () => {
    if (!archiveTarget) return;
    try {
      await sessionsState.archiveSession(archiveTarget.id);
      if (archiveTarget.id === effectiveActiveSessionId) {
        setActiveSessionId(null);
      }
      setArchiveTargetId(null);
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : "Unable to archive chat session.",
      );
    }
  }, [archiveTarget, effectiveActiveSessionId, onError, sessionsState]);

  const handleFilesSelected = useCallback(
    async (files: File[]) => {
      try {
        await filesState.uploadFiles(files);
      } catch (err) {
        onError(err instanceof Error ? err.message : "Upload failed.");
      }
    },
    [filesState, onError],
  );

  const handleSend = useCallback(
    async (content: string) => {
      const fileIds = pendingUploads
        .filter((u) => u.status === "ready" && u.fileId)
        .map((u) => u.fileId!);
      const ok = await messagesState.sendMessage(content, fileIds.length ? fileIds : undefined);
      if (ok) {
        filesState.clearPendingUploads();
        void sessionsState.refetch();
      } else if (messagesState.error) {
        onError(messagesState.error);
      }
      return ok;
    },
    [filesState, messagesState, onError, pendingUploads, sessionsState],
  );

  const combinedError = sessionsState.error?.message ?? messagesState.error;

  return (
    <>
      <aside
        className={cn(
          "fixed right-0 top-0 z-50 h-full w-[920px] max-w-[98vw] transform border-l border-slate-200 bg-white shadow-2xl transition-transform",
          isOpen ? "transform-none" : "translate-x-full",
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Board chat
              </p>
              <p className="mt-1 text-sm font-medium text-slate-900">
                Multi-session board chat. Commands like /pause and /resume stay
                board-global.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={isSessionListOpen ? "secondary" : "outline"}
                className="h-8 px-2"
                onClick={() => setIsSessionListOpen((value) => !value)}
                title={isSessionListOpen ? "Hide chats" : "Show chats"}
                aria-controls="board-chat-session-list"
                aria-expanded={isSessionListOpen}
              >
                <PanelLeftOpen className="h-3.5 w-3.5" />
                Chats
              </Button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50"
                aria-label="Close board chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {combinedError ? (
            <div className="border-b border-red-200 bg-red-50 px-6 py-2 text-sm text-red-700">
              {combinedError}
            </div>
          ) : null}

          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
            <div
              id="board-chat-session-list"
              className={cn(
                "overflow-hidden transition-all duration-200 ease-out",
                isSessionListOpen
                  ? "max-h-[45vh] opacity-100 md:max-h-none md:w-72"
                  : "max-h-0 opacity-0 md:max-h-none md:w-0",
              )}
            >
              <BoardChatSessionList
                sessions={sessions}
                activeSessionId={effectiveActiveSessionId}
                canWrite={canWrite}
                isCreating={sessionsState.isCreating}
                isMutating={
                  sessionsState.isRenaming || sessionsState.isArchiving
                }
                onSelect={(chatSessionId) => {
                  setActiveSessionId(chatSessionId);
                  triggerComposerFocus();
                }}
                onCreate={() => void handleCreateSession()}
                onRename={handleRenameSession}
                onArchiveRequest={(session) => {
                  setArchiveTargetId(session.id);
                }}
              />
            </div>

            <div className="min-h-0 flex-1 px-4 py-4">
              <BoardChatThread
                activeSessionId={effectiveActiveSessionId}
                messages={messagesState.messages}
                isLoading={messagesState.isLoading || sessionsState.isLoading}
                isLoadingOlder={messagesState.isLoadingOlder}
                isSending={messagesState.isSending}
                hasMore={messagesState.hasMore}
                error={messagesState.error}
                canWrite={canWrite}
                currentUserDisplayName={currentUserDisplayName}
                mentionSuggestions={mentionSuggestions}
                composerAutoFocus={focusComposer}
                onLoadOlder={messagesState.loadOlder}
                onSend={handleSend}
                onFilesSelected={handleFilesSelected}
                pendingFiles={pendingFileChips}
                onRemovePendingFile={filesState.removePendingUpload}
              />
            </div>
          </div>
        </div>
      </aside>

      <Dialog
        open={Boolean(archiveTarget)}
        onOpenChange={(open) => !open && setArchiveTargetId(null)}
      >
        <DialogContent aria-label="Delete chat session">
          <DialogHeader>
            <DialogTitle>Delete chat session</DialogTitle>
            <DialogDescription>
              This hides the session from the list, messages kept.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            {archiveTarget ? `Session: ${archiveTarget.title}` : ""}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveTargetId(null)}>
              Cancel
            </Button>
            <Button
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={() => void handleConfirmArchive()}
            >
              Delete session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});

BoardChatPanel.displayName = "BoardChatPanel";

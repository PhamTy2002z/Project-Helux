import { memo, useCallback, useMemo, useState } from "react";

import { ChevronDown, MessageSquare, Plus, X } from "lucide-react";

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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useBoardChatFiles } from "@/lib/hooks/use-board-chat-files";
import type { MessageAttachment } from "@/lib/hooks/use-board-chat-messages";
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
  const [isSessionMenuOpen, setIsSessionMenuOpen] = useState(false);

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
      setIsSessionMenuOpen(false);
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
      const attachments: MessageAttachment[] = pendingUploads
        .filter((u) => u.status === "ready" && u.fileId)
        .map((u) => ({
          id: u.fileId!,
          file_name: u.file.name,
          status: "ready",
        }));
      const ok = await messagesState.sendMessage(
        content,
        fileIds.length ? fileIds : undefined,
        attachments.length ? attachments : undefined,
      );
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

  const handleSelectSession = useCallback(
    (chatSessionId: string) => {
      setActiveSessionId(chatSessionId);
      setIsSessionMenuOpen(false);
      triggerComposerFocus();
    },
    [triggerComposerFocus],
  );

  const handleArchiveRequest = useCallback((chatSessionId: string) => {
    setArchiveTargetId(chatSessionId);
    setIsSessionMenuOpen(false);
  }, []);

  const combinedError = sessionsState.error?.message ?? messagesState.error;

  return (
    <>
      <aside
        className={cn(
          "fixed right-0 top-0 z-50 h-full w-[920px] max-w-[98vw] border-l border-slate-200 bg-white shadow-2xl transform-gpu transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:transition-none",
          isOpen
            ? "translate-x-0 opacity-100 pointer-events-auto"
            : "translate-x-[104%] opacity-0 pointer-events-none",
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
              <Popover open={isSessionMenuOpen} onOpenChange={setIsSessionMenuOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant={isSessionMenuOpen ? "secondary" : "outline"}
                    className="h-8 gap-1 px-2"
                    title={
                      isSessionMenuOpen
                        ? "Close session menu"
                        : "Open session menu"
                    }
                    aria-expanded={isSessionMenuOpen}
                  >
                    <MessageSquare aria-hidden="true" className="h-3.5 w-3.5" />
                    Sessions
                    <ChevronDown
                      aria-hidden="true"
                      className={cn(
                        "h-3.5 w-3.5 transition-transform",
                        isSessionMenuOpen ? "rotate-180" : "",
                      )}
                    />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  sideOffset={10}
                  className="w-[min(22rem,calc(100vw-2.5rem))] rounded-xl border border-slate-200 bg-white p-0 shadow-xl"
                >
                  <BoardChatSessionList
                    layout="dropdown"
                    sessions={sessions}
                    activeSessionId={effectiveActiveSessionId}
                    canWrite={canWrite}
                    isCreating={sessionsState.isCreating}
                    isMutating={
                      sessionsState.isRenaming || sessionsState.isArchiving
                    }
                    onSelect={handleSelectSession}
                    onCreate={() => void handleCreateSession()}
                    onRename={handleRenameSession}
                    onArchiveRequest={(session) => {
                      handleArchiveRequest(session.id);
                    }}
                  />
                </PopoverContent>
              </Popover>
              <Button
                type="button"
                size="sm"
                className="h-8 gap-1 px-2"
                onClick={() => void handleCreateSession()}
                disabled={!canWrite || sessionsState.isCreating}
                title={canWrite ? "Create new chat" : "Read-only access"}
              >
                <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                New Chat
              </Button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                aria-label="Close board chat"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          </div>

          {combinedError ? (
            <div className="border-b border-red-200 bg-red-50 px-6 py-2 text-sm text-red-700">
              {combinedError}
            </div>
          ) : null}

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

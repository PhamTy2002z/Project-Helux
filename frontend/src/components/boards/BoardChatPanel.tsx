import {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { ChevronDown, MessageSquare, Plus } from "lucide-react";

import type { AgentRead, BoardMemoryRead } from "@/api/generated/model";
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

/** Threshold (ms) — agent seen within this window is considered active. */
const AGENT_ACTIVE_THRESHOLD_MS = 90_000;

function isAnyAgentActive(agents: AgentRead[]): boolean {
  const now = Date.now();
  return agents.some((a) => {
    if (a.status !== "online") return false;
    if (!a.last_seen_at) return false;
    const seenAt = new Date(a.last_seen_at).getTime();
    return now - seenAt < AGENT_ACTIVE_THRESHOLD_MS;
  });
}

type BoardChatPanelProps = {
  boardId: string | undefined;
  isOpen: boolean;
  canWrite: boolean;
  currentUserDisplayName: string;
  mentionSuggestions: string[];
  agents?: AgentRead[];
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
  agents = [],
  onClose,
  onMessageCreated,
  onError,
}: BoardChatPanelProps) {
  const resolvedBoardId = boardId ?? "";
  const sessionsState = useBoardChatSessions(
    resolvedBoardId,
    Boolean(resolvedBoardId),
  );
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [focusComposer, setFocusComposer] = useState(false);
  const [archiveTargetId, setArchiveTargetId] = useState<string | null>(null);
  const [isSessionMenuOpen, setIsSessionMenuOpen] = useState(false);

  // Track session IDs that were just created — skip initial fetch for these
  const [freshSessionIds, setFreshSessionIds] = useState<Set<string>>(
    () => new Set(),
  );

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

  const skipInitialFetch =
    effectiveActiveSessionId !== null &&
    freshSessionIds.has(effectiveActiveSessionId);

  // Clear the flag after first render so subsequent navigations back fetch normally.
  // setState here is intentional: we need to sync the "consumed" flag after the
  // skip-fetch decision has been read during this render cycle.
  useEffect(() => {
    if (
      effectiveActiveSessionId &&
      freshSessionIds.has(effectiveActiveSessionId)
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: clear consumed flag after render
      setFreshSessionIds((prev) => {
        const next = new Set(prev);
        next.delete(effectiveActiveSessionId);
        return next;
      });
    }
  }, [effectiveActiveSessionId, freshSessionIds]);

  const messagesState = useBoardChatMessages({
    boardId: resolvedBoardId,
    chatSessionId: effectiveActiveSessionId,
    enabled: isOpen && Boolean(effectiveActiveSessionId),
    source: currentUserDisplayName,
    onMessageCreated,
    skipInitialFetch,
  });

  const filesState = useBoardChatFiles({
    boardId: resolvedBoardId,
    chatSessionId: effectiveActiveSessionId,
    enabled: isOpen && Boolean(effectiveActiveSessionId),
  });
  const anyAgentActive = useMemo(() => isAnyAgentActive(agents), [agents]);

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
      setFreshSessionIds((prev) => new Set(prev).add(created.id));
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

  // Ref so handleSend stays stable (no pendingUploads in deps)
  const pendingUploadsRef = useRef(pendingUploads);
  useEffect(() => {
    pendingUploadsRef.current = pendingUploads;
  }, [pendingUploads]);

  const handleSend = useCallback(
    async (content: string) => {
      // Single iteration to collect fileIds + attachments
      const fileIds: string[] = [];
      const attachments: MessageAttachment[] = [];
      for (const u of pendingUploadsRef.current) {
        if (u.status === "ready" && u.fileId) {
          fileIds.push(u.fileId);
          attachments.push({
            id: u.fileId,
            file_name: u.file.name,
            status: "ready",
          });
        }
      }
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
    [filesState, messagesState, onError, sessionsState],
  );

  const handleSelectSession = useCallback(
    (chatSessionId: string) => {
      startTransition(() => setActiveSessionId(chatSessionId));
      setIsSessionMenuOpen(false);
      triggerComposerFocus();
    },
    [triggerComposerFocus],
  );

  const handleArchiveRequest = useCallback((chatSessionId: string) => {
    setArchiveTargetId(chatSessionId);
    setIsSessionMenuOpen(false);
  }, []);

  const activeSessionTitle = useMemo(() => {
    if (!effectiveActiveSessionId) return null;
    return (
      sessions.find((s) => s.id === effectiveActiveSessionId)?.title ?? null
    );
  }, [effectiveActiveSessionId, sessions]);

  const combinedError = sessionsState.error?.message ?? messagesState.error;

  return (
    <>
      {/* Backdrop overlay — click to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          "fixed right-0 top-0 z-50 h-full w-[780px] max-w-[98vw] border-l border-[color:var(--border)] bg-[color:var(--surface)] shadow-2xl transform-gpu transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:transition-none",
          isOpen
            ? "translate-x-0 opacity-100 pointer-events-auto"
            : "translate-x-[104%] opacity-0 pointer-events-none",
        )}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-[color:var(--border)] px-6 py-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              Board chat
            </p>
            <p className="mt-1 text-sm font-medium text-strong">
              Multi-session board chat. Commands like /pause and /resume stay
              board-global.
            </p>
          </div>

          {combinedError ? (
            <div className="border-b border-red-200 bg-red-50 px-6 py-2 text-sm text-red-700">
              {combinedError}
            </div>
          ) : null}

          {/* Session selector bar — above chat thread */}
          <div className="flex items-center justify-between border-b border-[color:var(--border)] px-4 py-2">
            <Popover
              open={isSessionMenuOpen}
              onOpenChange={setIsSessionMenuOpen}
            >
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-[color:var(--surface-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  title={
                    isSessionMenuOpen ? "Close session menu" : "Switch session"
                  }
                  aria-expanded={isSessionMenuOpen}
                >
                  <MessageSquare
                    aria-hidden="true"
                    className="h-3.5 w-3.5 flex-shrink-0 text-[color:var(--text-muted)]"
                  />
                  <span className="max-w-[200px] truncate font-medium text-[color:var(--text)]">
                    {activeSessionTitle ?? "No session"}
                  </span>
                  <ChevronDown
                    aria-hidden="true"
                    className={cn(
                      "h-3.5 w-3.5 flex-shrink-0 text-quiet transition-transform",
                      isSessionMenuOpen ? "rotate-180" : "",
                    )}
                  />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                sideOffset={6}
                className="w-[min(22rem,calc(100vw-2.5rem))] rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-0 shadow-xl"
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
            <button
              type="button"
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-[color:var(--border)] text-muted transition hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50"
              onClick={() => void handleCreateSession()}
              disabled={!canWrite || sessionsState.isCreating}
              title={canWrite ? "Create new chat" : "Read-only access"}
              aria-label="Create new chat"
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 px-4 py-4">
            <BoardChatThread
              activeSessionId={effectiveActiveSessionId}
              messages={messagesState.messages}
              isLoading={messagesState.isLoading || sessionsState.isLoading}
              isLoadingOlder={messagesState.isLoadingOlder}
              isSending={messagesState.isSending}
              isAwaitingReply={
                messagesState.isAwaitingReply ||
                (messagesState.isSending === false && anyAgentActive)
              }
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
          <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-3 text-sm text-[color:var(--text)]">
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

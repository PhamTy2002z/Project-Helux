import { memo, useEffect, useLayoutEffect, useRef } from "react";

import { FileText } from "lucide-react";

import type { BoardMemoryRead } from "@/api/generated/model";
import { LazyMarkdown } from "@/components/atoms/LazyMarkdown";
import { BoardChatComposer } from "@/components/BoardChatComposer";
import { Button } from "@/components/ui/button";
import { DEFAULT_HUMAN_LABEL, resolveHumanActorName } from "@/lib/display-name";
import { cn } from "@/lib/utils";

type PendingFileChip = {
  id: string;
  fileName: string;
  status: string;
};

/** Attachment metadata that may be present on messages once backend hydrates it. */
type MessageAttachment = {
  id: string;
  file_name: string;
  status: string;
};

type BoardChatThreadProps = {
  activeSessionId: string | null;
  messages: BoardMemoryRead[];
  isLoading: boolean;
  isLoadingOlder: boolean;
  isSending: boolean;
  isAwaitingReply: boolean;
  hasMore: boolean;
  error: string | null;
  canWrite: boolean;
  currentUserDisplayName: string;
  mentionSuggestions: string[];
  composerAutoFocus: boolean;
  onLoadOlder: () => Promise<void>;
  onSend: (content: string) => Promise<boolean>;
  onFilesSelected?: (files: File[]) => void;
  pendingFiles?: PendingFileChip[];
  onRemovePendingFile?: (id: string) => void;
};

const NEAR_BOTTOM_THRESHOLD = 80;
const EMBEDDED_TIMESTAMP_PATTERN =
  /^[A-Za-z]{3,9}\s+\d{1,2},\s+\d{1,2}:\d{2}\s*(?:AM|PM)(?:\s+[A-Z]{2,5})?$/i;

const formatShortTimestamp = (value: string) => {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return "—";
  return new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const sanitizeMessageContent = (content: string, sourceLabel: string): string => {
  const normalized = content.replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");
  const nonEmptyIndexes = lines
    .map((line, index) => ({ line: line.trim(), index }))
    .filter(({ line }) => line.length > 0);

  if (nonEmptyIndexes.length < 2) return normalized;
  const first = nonEmptyIndexes[0];
  const second = nonEmptyIndexes[1];
  const isEmbeddedHeader =
    first.line.toLowerCase() === sourceLabel.trim().toLowerCase() &&
    EMBEDDED_TIMESTAMP_PATTERN.test(second.line);
  if (!isEmbeddedHeader) return normalized;

  return lines.slice(second.index + 1).join("\n").trimStart();
};

const MessageCard = memo(function MessageCard({
  message,
  currentUserDisplayName,
}: {
  message: BoardMemoryRead;
  currentUserDisplayName: string;
}) {
  const sourceLabel = resolveHumanActorName(
    message.source,
    DEFAULT_HUMAN_LABEL,
  );
  const isCurrentUser = sourceLabel === currentUserDisplayName;
  const cleanedContent = sanitizeMessageContent(
    message.content ?? "",
    sourceLabel,
  );

  return (
    <div className={cn("flex", isCurrentUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "w-fit max-w-[84%] rounded-2xl border px-4 py-3 shadow-sm",
          "border-[color:var(--border)] bg-[color:var(--surface)] text-strong",
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[13px] font-semibold text-strong">
            {sourceLabel}
          </p>
          <span className="text-[11px] text-quiet">
            {formatShortTimestamp(message.created_at)}
          </span>
        </div>
        <div className="mt-1 select-text cursor-text text-sm leading-6 break-words text-strong">
          <LazyMarkdown content={cleanedContent} variant="chat" />
        </div>
        {((message as unknown as { attachments?: MessageAttachment[] }).attachments)?.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(message as unknown as { attachments: MessageAttachment[] }).attachments.map((att) => (
              <span
                key={att.id}
                className="inline-flex items-center gap-1.5 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-2 py-1 text-xs text-[color:var(--text-muted)]"
              >
                <FileText className="h-3 w-3 flex-shrink-0" />
                <span className="max-w-[120px] truncate">{att.file_name}</span>
                <span
                  className={cn(
                    "rounded px-1 py-0.5 text-[10px] font-medium",
                    att.status === "ready"
                      ? "bg-green-100 text-green-700"
                      : att.status === "failed"
                        ? "bg-red-100 text-red-700"
                        : "bg-blue-100 text-blue-700",
                  )}
                >
                  {att.status}
                </span>
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
});

MessageCard.displayName = "MessageCard";

export const BoardChatThread = memo(function BoardChatThread({
  activeSessionId,
  messages,
  isLoading,
  isLoadingOlder,
  isSending,
  isAwaitingReply,
  hasMore,
  error,
  canWrite,
  currentUserDisplayName,
  mentionSuggestions,
  composerAutoFocus,
  onLoadOlder,
  onSend,
  onFilesSelected,
  pendingFiles,
  onRemovePendingFile,
}: BoardChatThreadProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const nearBottomRef = useRef(true);
  const lastSessionIdRef = useRef<string | null>(null);
  const lastMessageCountRef = useRef(0);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const updateNearBottom = () => {
      const distanceFromBottom =
        node.scrollHeight - node.scrollTop - node.clientHeight;
      nearBottomRef.current = distanceFromBottom <= NEAR_BOTTOM_THRESHOLD;
    };

    updateNearBottom();
    node.addEventListener("scroll", updateNearBottom);
    return () => node.removeEventListener("scroll", updateNearBottom);
  }, []);

  useLayoutEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    if (activeSessionId !== lastSessionIdRef.current) {
      lastSessionIdRef.current = activeSessionId;
      lastMessageCountRef.current = messages.length;
      node.scrollTop = node.scrollHeight;
      nearBottomRef.current = true;
      return;
    }

    const previousCount = lastMessageCountRef.current;
    lastMessageCountRef.current = messages.length;
    if (messages.length <= previousCount) return;
    if (!nearBottomRef.current) return;
    node.scrollTop = node.scrollHeight;
  }, [activeSessionId, messages]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div
        ref={containerRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)]/60 p-4"
      >
        {hasMore ? (
          <div className="flex justify-center">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void onLoadOlder()}
              disabled={isLoadingOlder}
            >
              {isLoadingOlder ? "Loading older..." : "Load older messages"}
            </Button>
          </div>
        ) : null}

        {isLoading ? (
          <p className="text-sm text-muted">Loading messages...</p>
        ) : null}
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {!isLoading && messages.length === 0 ? (
          <p className="text-sm text-muted">
            No messages yet. Start the conversation with your lead agent.
          </p>
        ) : (
          messages.map((message) => (
            <MessageCard
              key={message.id}
              message={message}
              currentUserDisplayName={currentUserDisplayName}
            />
          ))
        )}

        {/* Typing indicator — visible while sending or awaiting agent reply */}
        {(isSending || isAwaitingReply) && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 shadow-sm">
              <div className="flex items-center gap-1.5" role="status" aria-label="Agent is typing">
                <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--text-quiet)] animate-typing-dot-1" />
                <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--text-quiet)] animate-typing-dot-2" />
                <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--text-quiet)] animate-typing-dot-3" />
              </div>
              <span className="text-xs text-quiet">
                {isSending ? "Sending..." : "Awaiting reply..."}
              </span>
            </div>
          </div>
        )}
      </div>

      <BoardChatComposer
        autoFocus={composerAutoFocus}
        isSending={isSending}
        onSend={onSend}
        disabled={!canWrite || !activeSessionId}
        mentionSuggestions={mentionSuggestions}
        placeholder={
          canWrite
            ? "Message the board lead. Tag agents with @name."
            : "Read-only access. Chat is disabled."
        }
        onFilesSelected={onFilesSelected}
        pendingFiles={pendingFiles}
        onRemovePendingFile={onRemovePendingFile}
      />
    </div>
  );
});

BoardChatThread.displayName = "BoardChatThread";

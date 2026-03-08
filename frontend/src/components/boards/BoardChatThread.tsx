import { useEffect, useLayoutEffect, useRef } from "react";

import type { BoardMemoryRead } from "@/api/generated/model";
import { LazyMarkdown } from "@/components/atoms/LazyMarkdown";
import { BoardChatComposer } from "@/components/BoardChatComposer";
import { Button } from "@/components/ui/button";
import { DEFAULT_HUMAN_LABEL, resolveHumanActorName } from "@/lib/display-name";
import { cn } from "@/lib/utils";

type BoardChatThreadProps = {
  activeSessionId: string | null;
  messages: BoardMemoryRead[];
  isLoading: boolean;
  isLoadingOlder: boolean;
  isSending: boolean;
  hasMore: boolean;
  error: string | null;
  canWrite: boolean;
  currentUserDisplayName: string;
  mentionSuggestions: string[];
  composerAutoFocus: boolean;
  onLoadOlder: () => Promise<void>;
  onSend: (content: string) => Promise<boolean>;
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

const MessageCard = ({
  message,
  currentUserDisplayName,
}: {
  message: BoardMemoryRead;
  currentUserDisplayName: string;
}) => {
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
          "border-slate-200 bg-white text-slate-900",
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[13px] font-semibold text-slate-900">
            {sourceLabel}
          </p>
          <span className="text-[11px] text-slate-400">
            {formatShortTimestamp(message.created_at)}
          </span>
        </div>
        <div className="mt-1 select-text cursor-text text-sm leading-6 break-words text-slate-900">
          <LazyMarkdown content={cleanedContent} variant="chat" />
        </div>
      </div>
    </div>
  );
};

export function BoardChatThread({
  activeSessionId,
  messages,
  isLoading,
  isLoadingOlder,
  isSending,
  hasMore,
  error,
  canWrite,
  currentUserDisplayName,
  mentionSuggestions,
  composerAutoFocus,
  onLoadOlder,
  onSend,
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
        className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
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
          <p className="text-sm text-slate-500">Loading messages...</p>
        ) : null}
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {!isLoading && messages.length === 0 ? (
          <p className="text-sm text-slate-500">
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
      />
    </div>
  );
}

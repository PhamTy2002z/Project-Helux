"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AudioLines, Plus, X } from "lucide-react";

import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const MENTION_MAX_OPTIONS = 8;
const MENTION_PATTERN = /(?:^|\s)@([A-Za-z0-9_-]{0,31})$/;

type MentionTarget = {
  start: number;
  end: number;
  query: string;
};

type PendingFileChip = {
  id: string;
  fileName: string;
  status: string;
};

type BoardChatComposerProps = {
  className?: string;
  placeholder?: string;
  isSending?: boolean;
  disabled?: boolean;
  mentionSuggestions?: string[];
  autoFocus?: boolean;
  onSend: (content: string) => Promise<boolean>;
  onFilesSelected?: (files: File[]) => void;
  pendingFiles?: PendingFileChip[];
  onRemovePendingFile?: (id: string) => void;
};

const normalizeMentionHandle = (raw: string): string | null => {
  const trimmed = raw.trim().replace(/^@+/, "");
  if (!trimmed) return null;
  const token = trimmed.split(/\s+/)[0]?.replace(/[^A-Za-z0-9_-]/g, "") ?? "";
  if (!token) return null;
  if (!/^[A-Za-z]/.test(token)) return null;
  return token.slice(0, 32).toLowerCase();
};

const findMentionTarget = (
  text: string,
  caret: number,
): MentionTarget | null => {
  if (caret < 0 || caret > text.length) return null;
  const prefix = text.slice(0, caret);
  const match = prefix.match(MENTION_PATTERN);
  if (!match) return null;
  const query = (match[1] ?? "").toLowerCase();
  const start = caret - query.length - 1;
  return { start, end: caret, query };
};

function BoardChatComposerImpl({
  className,
  placeholder = "Message the board lead. Tag agents with @name.",
  isSending = false,
  disabled = false,
  mentionSuggestions,
  autoFocus = false,
  onSend,
  onFilesSelected,
  pendingFiles,
  onRemovePendingFile,
}: BoardChatComposerProps) {
  const [value, setValue] = useState("");
  const [mentionTarget, setMentionTarget] = useState<MentionTarget | null>(
    null,
  );
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const closeMenuTimeoutRef = useRef<number | null>(null);
  const shouldFocusAfterSendRef = useRef(false);

  // Auto-resize textarea to fit content, up to max height
  const autoResize = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const maxHeight = 200; // ~8 lines
    const scrollHeight = textarea.scrollHeight;
    textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    textarea.style.overflowY = scrollHeight > maxHeight ? "auto" : "hidden";
  }, []);

  const mentionOptions = useMemo(() => {
    const handles = new Set<string>(["lead"]);
    (mentionSuggestions ?? []).forEach((candidate) => {
      const handle = normalizeMentionHandle(candidate);
      if (handle) {
        handles.add(handle);
      }
    });
    return [...handles];
  }, [mentionSuggestions]);

  const filteredMentionOptions = useMemo(() => {
    if (!mentionTarget) return [];
    const query = mentionTarget.query;
    const startsWithMatches = mentionOptions.filter((option) =>
      option.startsWith(query),
    );
    return startsWithMatches.slice(0, MENTION_MAX_OPTIONS);
  }, [mentionOptions, mentionTarget]);

  const activeIndex =
    filteredMentionOptions.length > 0
      ? Math.min(activeMentionIndex, filteredMentionOptions.length - 1)
      : 0;

  useEffect(() => {
    if (isSending) return;
    if (!shouldFocusAfterSendRef.current) return;
    shouldFocusAfterSendRef.current = false;
    textareaRef.current?.focus();
    autoResize();
  }, [isSending, autoResize]);

  useEffect(() => {
    if (!autoFocus) return;
    textareaRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    return () => {
      if (closeMenuTimeoutRef.current !== null) {
        window.clearTimeout(closeMenuTimeoutRef.current);
      }
    };
  }, []);

  const refreshMentionTarget = useCallback(
    (nextValue: string, caret: number) => {
      const nextTarget = findMentionTarget(nextValue, caret);
      setMentionTarget(nextTarget);
    },
    [],
  );

  const applyMentionSelection = useCallback(
    (handle: string) => {
      const textarea = textareaRef.current;
      if (!textarea || !mentionTarget) return;
      const replacement = `@${handle} `;
      const nextValue =
        value.slice(0, mentionTarget.start) +
        replacement +
        value.slice(mentionTarget.end);
      setValue(nextValue);
      setMentionTarget(null);
      setActiveMentionIndex(0);
      window.requestAnimationFrame(() => {
        const nextCaret = mentionTarget.start + replacement.length;
        textarea.focus();
        textarea.setSelectionRange(nextCaret, nextCaret);
      });
    },
    [mentionTarget, value],
  );

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selected = Array.from(event.target.files ?? []);
      if (selected.length && onFilesSelected) {
        onFilesSelected(selected);
      }
      // Reset so same file can be re-selected
      event.target.value = "";
    },
    [onFilesSelected],
  );

  const isComposerDisabled = isSending || disabled;

  const send = useCallback(async () => {
    if (isSending || disabled) return;
    const trimmed = value.trim();
    if (!trimmed) return;
    const ok = await onSend(trimmed);
    shouldFocusAfterSendRef.current = true;
    if (ok) {
      setValue("");
      setMentionTarget(null);
      setActiveMentionIndex(0);
      // Reset textarea height after clearing
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.style.overflowY = "hidden";
      }
    }
  }, [disabled, isSending, onSend, value]);

  const canSend = !isComposerDisabled && value.trim().length > 0;

  return (
    <div className={cn("mt-4", className)}>
      {pendingFiles && pendingFiles.length > 0 && (
        <div className="mb-2.5 flex flex-wrap gap-2">
          {pendingFiles.map((f) => (
            <span
              key={f.id}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs text-slate-700"
            >
              <span className="max-w-[180px] truncate">{f.fileName}</span>
              <span
                className={
                  f.status === "uploading"
                    ? "text-sky-600"
                    : f.status === "failed"
                      ? "text-rose-600"
                      : "text-emerald-600"
                }
              >
                {f.status === "uploading" ? "..." : f.status === "failed" ? "!" : "✓"}
              </span>
              {onRemovePendingFile && (
                <button
                  type="button"
                  onClick={() => onRemovePendingFile(f.id)}
                  className="ml-0.5 text-slate-500 transition hover:text-slate-700"
                  aria-label={`Remove ${f.fileName}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      <div className="relative rounded-[28px] border border-slate-300/80 bg-slate-100/80 px-3.5 py-2.5 shadow-[0_14px_32px_-22px_rgba(15,23,42,0.42)]">
        <div className="flex items-center gap-2">
          {onFilesSelected && (
            <>
              <label
                className={`relative inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-slate-500 transition ${
                  isComposerDisabled
                    ? "cursor-not-allowed bg-slate-100 text-slate-400"
                    : "cursor-pointer hover:bg-slate-200 hover:text-slate-700"
                }`}
                title={isComposerDisabled ? "Chat unavailable" : "Attach files"}
              >
                <Plus className="h-5 w-5" />
                <input
                  type="file"
                  multiple
                  accept=".txt,.md,.csv,.json,.pdf"
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  onChange={handleFileChange}
                  disabled={isComposerDisabled}
                  aria-label="Attach files"
                />
              </label>
            </>
          )}
          <Textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => {
            const nextValue = event.target.value;
            setValue(nextValue);
            autoResize();
            refreshMentionTarget(
              nextValue,
              event.target.selectionStart ?? nextValue.length,
            );
          }}
          onClick={(event) => {
            refreshMentionTarget(
              value,
              event.currentTarget.selectionStart ?? value.length,
            );
          }}
          onKeyUp={(event) => {
            refreshMentionTarget(
              value,
              event.currentTarget.selectionStart ?? value.length,
            );
          }}
          onBlur={() => {
            if (closeMenuTimeoutRef.current !== null) {
              window.clearTimeout(closeMenuTimeoutRef.current);
            }
            closeMenuTimeoutRef.current = window.setTimeout(() => {
              setMentionTarget(null);
              setActiveMentionIndex(0);
            }, 120);
          }}
          onFocus={(event) => {
            refreshMentionTarget(
              value,
              event.currentTarget.selectionStart ?? value.length,
            );
          }}
          onKeyDown={(event) => {
            if (filteredMentionOptions.length > 0 && mentionTarget) {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveMentionIndex(
                  (prev) => (prev + 1) % filteredMentionOptions.length,
                );
                return;
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveMentionIndex(
                  (prev) =>
                    (prev - 1 + filteredMentionOptions.length) %
                    filteredMentionOptions.length,
                );
                return;
              }
              if (event.key === "Enter" || event.key === "Tab") {
                event.preventDefault();
                const selected = filteredMentionOptions[activeIndex];
                if (selected) {
                  applyMentionSelection(selected);
                }
                return;
              }
              if (event.key === "Escape") {
                event.preventDefault();
                setMentionTarget(null);
                setActiveMentionIndex(0);
                return;
              }
            }
            if (event.key !== "Enter") return;
            if (event.nativeEvent.isComposing) return;
            if (event.shiftKey) return;
            event.preventDefault();
            void send();
          }}
          placeholder={placeholder}
          rows={1}
          className="min-h-[24px] min-w-0 !w-auto max-h-40 flex-1 resize-none border-0 bg-transparent px-0 py-0.5 text-[15px] leading-6 text-slate-700 shadow-none placeholder:text-slate-400 focus-visible:ring-0"
          disabled={isComposerDisabled}
        />
          <div className="flex flex-shrink-0 items-center">
            <button
              type="button"
              onClick={() => void send()}
              disabled={!canSend}
              aria-label={isSending ? "Sending message" : "Send message"}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full transition ${
                canSend
                  ? "bg-sky-500 text-white hover:bg-sky-600"
                  : "bg-slate-100 text-slate-400"
              } disabled:cursor-not-allowed`}
            >
              <AudioLines className="h-4 w-4" />
            </button>
          </div>
        </div>
        {mentionTarget && filteredMentionOptions.length > 0 ? (
          <div className="absolute bottom-full left-0 z-20 mb-2 w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
            <div className="max-h-52 overflow-y-auto py-1">
              {filteredMentionOptions.map((option, index) => (
                <button
                  key={option}
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    applyMentionSelection(option);
                  }}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition ${
                    index === activeIndex
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="font-mono">@{option}</span>
                  <span className="text-xs text-slate-400">mention</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export const BoardChatComposer = memo(BoardChatComposerImpl);
BoardChatComposer.displayName = "BoardChatComposer";

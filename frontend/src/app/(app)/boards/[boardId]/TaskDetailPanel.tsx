"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LazyMarkdown } from "@/components/atoms/LazyMarkdown";
import {
  DependencyBanner,
  type DependencyBannerDependency,
} from "@/components/molecules/DependencyBanner";
import { TaskCommentCard } from "./TaskCommentCard";
import { cn } from "@/lib/utils";
import { parseApiDatetime } from "@/lib/datetime";
import type { TaskCustomFieldDefinitionRead } from "@/api/generated/model";
import {
  formatCustomFieldDetailValue,
  isCustomFieldVisible,
  type TaskCustomFieldValues,
} from "./custom-field-utils";
import type { Approval, Task, TaskComment } from "./board-types";
import { normalizeTagColor } from "./board-normalizers";

const COMMENT_MENTION_MAX_OPTIONS = 8;
const COMMENT_MENTION_PATTERN = /(?:^|\s)@([A-Za-z0-9_-]{0,31})$/;

type CommentMentionTarget = {
  start: number;
  end: number;
  query: string;
};

export type TaskDetailPanelProps = {
  selectedTask: Task | null;
  isDetailOpen: boolean;
  onClose: () => void;
  onEditOpen: () => void;
  canWrite: boolean;
  comments: TaskComment[];
  highlightedCommentId: string | null;
  isCommentsLoading: boolean;
  commentsError: string | null;
  isPostingComment: boolean;
  postCommentError: string | null;
  onPostComment: (message: string) => Promise<boolean>;
  boardChatMentionSuggestions: string[];
  assigneeById: Map<string, string>;
  currentUserDisplayName: string;
  taskApprovals: Approval[];
  pendingApprovals: Approval[];
  approvalsError: string | null;
  isApprovalsLoading: boolean;
  approvalsUpdatingId: string | null;
  onApprovalDecision: (
    approvalId: string,
    status: "approved" | "rejected",
  ) => void;
  selectedTaskDependencies: DependencyBannerDependency[];
  selectedTaskResolvedDependencies: DependencyBannerDependency[];
  boardCustomFieldDefinitions: TaskCustomFieldDefinitionRead[];
  selectedTaskCustomFieldValues: TaskCustomFieldValues;
  customFieldDefinitionsLoading: boolean;
  boardId: string | undefined;
  onNavigate: (url: string) => void;
};

function formatApprovalTimestamp(value?: string | null) {
  if (!value) return "—";
  const date = parseApiDatetime(value);
  if (!date) return value;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function humanizeApprovalAction(value: string) {
  return value
    .split(".")
    .map((part) =>
      part.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
    )
    .join(" · ");
}

function approvalPayloadValue(
  payload: Approval["payload"],
  key: string,
): string | null {
  if (!payload || typeof payload !== "object") return null;
  const value = (payload as Record<string, unknown>)[key];
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  return null;
}

function approvalPayloadValues(
  payload: Approval["payload"],
  key: string,
): string[] {
  if (!payload || typeof payload !== "object") return [];
  const value = (payload as Record<string, unknown>)[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function getApprovalTaskIds(approval: Approval): string[] {
  const payload = approval.payload ?? {};
  const linkedTaskIds = (
    approval as Approval & { task_ids?: string[] | null }
  ).task_ids;
  const singleTaskId =
    approval.task_id ??
    approvalPayloadValue(payload, "task_id") ??
    approvalPayloadValue(payload, "taskId") ??
    approvalPayloadValue(payload, "taskID");
  const manyTaskIds = [
    ...approvalPayloadValues(payload, "task_ids"),
    ...approvalPayloadValues(payload, "taskIds"),
    ...approvalPayloadValues(payload, "taskIDs"),
  ];
  const merged = [
    ...(Array.isArray(linkedTaskIds) ? linkedTaskIds : []),
    ...manyTaskIds,
    ...(singleTaskId ? [singleTaskId] : []),
  ];
  const deduped: string[] = [];
  const seen = new Set<string>();
  merged.forEach((value) => {
    if (seen.has(value)) return;
    seen.add(value);
    deduped.push(value);
  });
  return deduped;
}

function getApprovalRows(approval: Approval) {
  const payload = approval.payload ?? {};
  const taskIds = getApprovalTaskIds(approval);
  const assignedAgentId =
    approvalPayloadValue(payload, "assigned_agent_id") ??
    approvalPayloadValue(payload, "assignedAgentId");
  const title = approvalPayloadValue(payload, "title");
  const role = approvalPayloadValue(payload, "role");
  const isAssign = approval.action_type.includes("assign");
  const rows: Array<{ label: string; value: string }> = [];
  if (taskIds.length === 1) rows.push({ label: "Task", value: taskIds[0] });
  if (taskIds.length > 1)
    rows.push({ label: "Tasks", value: taskIds.join(", ") });
  if (isAssign) {
    rows.push({ label: "Assignee", value: assignedAgentId ?? "Unassigned" });
  }
  if (title) rows.push({ label: "Title", value: title });
  if (role) rows.push({ label: "Role", value: role });
  return rows;
}

function getApprovalReason(approval: Approval) {
  return approvalPayloadValue(approval.payload ?? {}, "reason");
}

function normalizeMentionSuggestion(value: string): string | null {
  const trimmed = value.trim().replace(/^@+/, "");
  if (!trimmed) return null;
  const normalized =
    trimmed.split(/\s+/)[0]?.replace(/[^A-Za-z0-9_-]/g, "").toLowerCase() ??
    "";
  return normalized || null;
}

function findCommentMentionTarget(
  text: string,
  caret: number,
): CommentMentionTarget | null {
  if (caret < 0 || caret > text.length) return null;
  const prefix = text.slice(0, caret);
  const match = prefix.match(COMMENT_MENTION_PATTERN);
  if (!match) return null;
  const query = (match[1] ?? "").toLowerCase();
  const start = caret - query.length - 1;
  return { start, end: caret, query };
}

export function TaskDetailPanel({
  selectedTask,
  isDetailOpen,
  onClose,
  onEditOpen,
  canWrite,
  comments,
  highlightedCommentId,
  isCommentsLoading,
  commentsError,
  isPostingComment,
  postCommentError,
  onPostComment,
  boardChatMentionSuggestions,
  assigneeById,
  currentUserDisplayName,
  taskApprovals,
  pendingApprovals,
  approvalsError,
  isApprovalsLoading,
  approvalsUpdatingId,
  onApprovalDecision,
  selectedTaskDependencies,
  selectedTaskResolvedDependencies,
  boardCustomFieldDefinitions,
  selectedTaskCustomFieldValues,
  customFieldDefinitionsLoading,
  boardId,
  onNavigate,
}: TaskDetailPanelProps) {
  const [commentDraft, setCommentDraft] = useState("");
  const [mentionTarget, setMentionTarget] = useState<CommentMentionTarget | null>(
    null,
  );
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);
  const commentTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const closeMentionMenuTimeoutRef = useRef<number | null>(null);

  const resizeCommentTextarea = useCallback(() => {
    const textarea = commentTextareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const maxHeight = 240;
    const scrollHeight = textarea.scrollHeight;
    textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    textarea.style.overflowY = scrollHeight > maxHeight ? "auto" : "hidden";
  }, []);

  const mentionHints = useMemo(() => {
    const handles = new Set<string>(["lead"]);
    boardChatMentionSuggestions.forEach((candidate) => {
      const handle = normalizeMentionSuggestion(candidate);
      if (handle) handles.add(handle);
    });
    return [...handles].slice(0, 4);
  }, [boardChatMentionSuggestions]);

  const mentionOptions = useMemo(() => {
    const handles = new Set<string>(["lead"]);
    boardChatMentionSuggestions.forEach((candidate) => {
      const handle = normalizeMentionSuggestion(candidate);
      if (handle) handles.add(handle);
    });
    return [...handles];
  }, [boardChatMentionSuggestions]);

  const filteredMentionOptions = useMemo(() => {
    if (!mentionTarget) return [];
    const query = mentionTarget.query;
    return mentionOptions
      .filter((option) => option.startsWith(query))
      .slice(0, COMMENT_MENTION_MAX_OPTIONS);
  }, [mentionOptions, mentionTarget]);

  const activeMentionOptionIndex =
    filteredMentionOptions.length > 0
      ? Math.min(activeMentionIndex, filteredMentionOptions.length - 1)
      : 0;

  const refreshMentionTarget = useCallback((nextValue: string, caret: number) => {
    const nextTarget = findCommentMentionTarget(nextValue, caret);
    setMentionTarget(nextTarget);
    if (!nextTarget) {
      setActiveMentionIndex(0);
    }
  }, []);

  const applyMentionSelection = useCallback(
    (handle: string) => {
      const textarea = commentTextareaRef.current;
      if (!textarea || !mentionTarget) return;
      const replacement = `@${handle} `;
      const nextDraft =
        commentDraft.slice(0, mentionTarget.start) +
        replacement +
        commentDraft.slice(mentionTarget.end);
      setCommentDraft(nextDraft);
      setMentionTarget(null);
      setActiveMentionIndex(0);
      window.requestAnimationFrame(() => {
        const nextCaret = mentionTarget.start + replacement.length;
        textarea.focus();
        textarea.setSelectionRange(nextCaret, nextCaret);
      });
    },
    [commentDraft, mentionTarget],
  );

  useEffect(() => {
    setCommentDraft("");
    setMentionTarget(null);
    setActiveMentionIndex(0);
    const textarea = commentTextareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.overflowY = "hidden";
  }, [selectedTask?.id]);

  useEffect(() => {
    resizeCommentTextarea();
  }, [commentDraft, resizeCommentTextarea]);

  useEffect(() => {
    return () => {
      if (closeMentionMenuTimeoutRef.current !== null) {
        window.clearTimeout(closeMentionMenuTimeoutRef.current);
      }
    };
  }, []);

  const submitComment = useCallback(async () => {
    if (!canWrite || isPostingComment) return;
    const content = commentDraft.trim();
    if (!content) return;
    const ok = await onPostComment(content);
    if (!ok) return;
    setCommentDraft("");
    const textarea = commentTextareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.overflowY = "hidden";
    textarea.focus();
  }, [canWrite, commentDraft, isPostingComment, onPostComment]);

  const canSubmitComment =
    canWrite && !isPostingComment && commentDraft.trim().length > 0;

  return (
    <aside
      className={cn(
        "fixed right-0 top-0 z-50 h-full w-[max(760px,45vw)] max-w-[99vw] transform bg-white shadow-2xl transition-transform",
        isDetailOpen ? "transform-none" : "translate-x-full",
      )}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Task detail
            </p>
            <p className="mt-1 text-sm font-medium text-slate-900">
              {selectedTask?.title ?? "Task"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onEditOpen}
              className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50"
              disabled={!selectedTask || !canWrite}
              title={canWrite ? "Edit task" : "Read-only access"}
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Description
            </p>
            {selectedTask?.description ? (
              <div className="prose prose-sm max-w-none text-slate-700">
                <LazyMarkdown
                  content={selectedTask.description}
                  variant="description"
                />
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                No description provided.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Custom fields
            </p>
            {customFieldDefinitionsLoading ? (
              <p className="text-sm text-slate-500">Loading custom fields…</p>
            ) : boardCustomFieldDefinitions.length > 0 ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <dl className="space-y-2">
                  {boardCustomFieldDefinitions.map((definition) => {
                    const value =
                      selectedTaskCustomFieldValues[definition.field_key];
                    if (!isCustomFieldVisible(definition, value)) {
                      return null;
                    }
                    return (
                      <div
                        key={definition.id}
                        className="grid grid-cols-[160px_1fr] gap-3"
                      >
                        <dt className="text-xs font-semibold text-slate-600">
                          {definition.label || definition.field_key}
                          {definition.required === true ? (
                            <span className="ml-1 text-rose-600">*</span>
                          ) : null}
                        </dt>
                        <dd className="text-xs text-slate-800">
                          {formatCustomFieldDetailValue(definition, value)}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No custom fields.</p>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Tags
            </p>
            {selectedTask?.tags?.length ? (
              <div className="flex flex-wrap gap-2">
                {selectedTask.tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700"
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{
                        backgroundColor: `#${normalizeTagColor(tag.color)}`,
                      }}
                    />
                    {tag.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No tags assigned.</p>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Dependencies
            </p>
            {(() => {
              const hasDependencies =
                (selectedTask?.depends_on_task_ids?.length ?? 0) > 0;
              const hasResolvedDependencies =
                selectedTaskResolvedDependencies.length > 0;
              const isDependencyModeBlocked = hasDependencies
                ? selectedTask?.is_blocked === true
                : false;
              const bannerVariant =
                hasDependencies || hasResolvedDependencies
                  ? isDependencyModeBlocked
                    ? "blocked"
                    : "resolved"
                  : "blocked";
              const displayedDependencies =
                hasDependencies && selectedTask
                  ? selectedTaskDependencies
                  : selectedTaskResolvedDependencies;
              const childrenMessage =
                hasDependencies && selectedTask?.is_blocked
                  ? "Blocked by incomplete dependencies."
                  : hasDependencies
                    ? "Dependencies resolved."
                    : hasResolvedDependencies
                      ? "This task resolves these tasks."
                      : null;

              return (
                <DependencyBanner
                  dependencies={displayedDependencies}
                  variant={bannerVariant}
                  emptyMessage="No dependencies."
                >
                  {childrenMessage}
                </DependencyBanner>
              );
            })()}
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Approvals
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate(`/boards/${boardId}/approvals`)}
              >
                View all
              </Button>
            </div>
            {approvalsError ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                {approvalsError}
              </div>
            ) : isApprovalsLoading ? (
              <p className="text-sm text-slate-500">Loading approvals…</p>
            ) : taskApprovals.length === 0 ? (
              <p className="text-sm text-slate-500">
                No approvals tied to this task.{" "}
                {pendingApprovals.length > 0
                  ? `${pendingApprovals.length} pending on this board.`
                  : "No pending approvals on this board."}
              </p>
            ) : (
              <div className="space-y-3">
                {taskApprovals.map((approval) => (
                  <div
                    key={approval.id}
                    className="rounded-xl border border-slate-200 bg-white p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2 text-xs text-slate-500">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          {humanizeApprovalAction(approval.action_type)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Requested{" "}
                          {formatApprovalTimestamp(approval.created_at)}
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-slate-700">
                        {approval.confidence}% confidence · {approval.status}
                      </span>
                    </div>
                    {getApprovalRows(approval).length > 0 ? (
                      <div className="mt-2 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                        {getApprovalRows(approval).map((row) => (
                          <div key={`${approval.id}-${row.label}`}>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                              {row.label}
                            </p>
                            <p className="mt-1 text-xs text-slate-700">
                              {row.value}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {getApprovalReason(approval) ? (
                      <p className="mt-2 text-xs text-slate-600">
                        {getApprovalReason(approval)}
                      </p>
                    ) : null}
                    {approval.status === "pending" ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          onClick={() =>
                            onApprovalDecision(approval.id, "approved")
                          }
                          disabled={
                            approvalsUpdatingId === approval.id || !canWrite
                          }
                          title={canWrite ? "Approve" : "Read-only access"}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            onApprovalDecision(approval.id, "rejected")
                          }
                          disabled={
                            approvalsUpdatingId === approval.id || !canWrite
                          }
                          title={canWrite ? "Reject" : "Read-only access"}
                          className="border-slate-300 text-slate-700"
                        >
                          Reject
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Comments
            </p>
            <div className="space-y-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-sm">
                <div className="relative">
                  <Textarea
                    ref={commentTextareaRef}
                    value={commentDraft}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setCommentDraft(nextValue);
                      refreshMentionTarget(
                        nextValue,
                        event.target.selectionStart ?? nextValue.length,
                      );
                    }}
                    onClick={(event) => {
                      refreshMentionTarget(
                        commentDraft,
                        event.currentTarget.selectionStart ?? commentDraft.length,
                      );
                    }}
                    onKeyUp={(event) => {
                      refreshMentionTarget(
                        commentDraft,
                        event.currentTarget.selectionStart ?? commentDraft.length,
                      );
                    }}
                    onFocus={(event) => {
                      refreshMentionTarget(
                        commentDraft,
                        event.currentTarget.selectionStart ?? commentDraft.length,
                      );
                    }}
                    onBlur={() => {
                      if (closeMentionMenuTimeoutRef.current !== null) {
                        window.clearTimeout(closeMentionMenuTimeoutRef.current);
                      }
                      closeMentionMenuTimeoutRef.current = window.setTimeout(() => {
                        setMentionTarget(null);
                        setActiveMentionIndex(0);
                      }, 120);
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
                          const selected =
                            filteredMentionOptions[activeMentionOptionIndex];
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
                      void submitComment();
                    }}
                    placeholder={
                      canWrite
                        ? "Write a comment for the assigned agent. Tag @lead or @name."
                        : "Read-only access. Comments are disabled."
                    }
                    disabled={!canWrite || isPostingComment}
                    rows={4}
                    className="min-h-[96px] max-h-60 resize-none border-slate-200 bg-white text-sm text-slate-900 shadow-none focus-visible:ring-slate-300"
                  />
                  {mentionTarget && filteredMentionOptions.length > 0 ? (
                    <div className="absolute bottom-2 left-2 z-20 w-full max-w-sm overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/70">
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
                              index === activeMentionOptionIndex
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
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-xs text-slate-500">
                    {canWrite
                      ? "Enter to post, Shift+Enter for newline."
                      : "Read-only mode."}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void submitComment()}
                    disabled={!canSubmitComment}
                  >
                    {isPostingComment ? "Posting..." : "Post comment"}
                  </Button>
                </div>
                {canWrite ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Quick mentions:{" "}
                    {mentionHints.map((handle) => `@${handle}`).join(" · ")}
                  </p>
                ) : null}
              </div>
              {postCommentError ? (
                <p className="text-xs text-rose-600">{postCommentError}</p>
              ) : null}
              {!canWrite ? (
                <p className="text-xs text-slate-500">
                  Read-only access. You cannot post comments on this board.
                </p>
              ) : null}
            </div>
            {isCommentsLoading ? (
              <p className="text-sm text-slate-500">Loading comments…</p>
            ) : commentsError ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                {commentsError}
              </div>
            ) : comments.length === 0 ? (
              <p className="text-sm text-slate-500">No comments yet.</p>
            ) : (
              <div className="space-y-3">
                {comments.map((comment) => (
                  <TaskCommentCard
                    key={comment.id}
                    comment={comment}
                    isHighlighted={highlightedCommentId === comment.id}
                    authorLabel={
                      comment.agent_id
                        ? (assigneeById.get(comment.agent_id) ?? "Agent")
                        : currentUserDisplayName
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

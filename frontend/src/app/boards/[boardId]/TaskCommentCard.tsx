"use client";

import { memo } from "react";
import { Markdown } from "@/components/atoms/Markdown";
import { cn } from "@/lib/utils";
import { commentElementId, formatShortTimestamp } from "./board-utils";
import type { TaskComment } from "./board-types";

export const TaskCommentCard = memo(function TaskCommentCard({
  comment,
  authorLabel,
  isHighlighted = false,
}: {
  comment: TaskComment;
  authorLabel: string;
  isHighlighted?: boolean;
}) {
  const message = (comment.message ?? "").trim();
  return (
    <div
      id={commentElementId(comment.id)}
      className={cn(
        "scroll-mt-28 rounded-xl border bg-white p-3 transition",
        isHighlighted
          ? "border-blue-300 ring-2 ring-blue-200"
          : "border-slate-200",
      )}
    >
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{authorLabel}</span>
        <span>{formatShortTimestamp(comment.created_at)}</span>
      </div>
      {message ? (
        <div className="mt-2 select-text cursor-text text-sm leading-relaxed text-slate-900 break-words">
          <Markdown content={message} variant="comment" />
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-900">—</p>
      )}
    </div>
  );
});

TaskCommentCard.displayName = "TaskCommentCard";

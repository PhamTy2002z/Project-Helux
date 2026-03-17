"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiDatetimeToMs } from "@/lib/datetime";
import { resolveHumanActorName } from "@/lib/display-name";
import { LiveFeedCard } from "./LiveFeedCard";
import type { Agent, LiveFeedItem } from "./board-types";

type AgentLabelFn = (agent: Agent) => string;

export type LiveFeedPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  liveFeed: LiveFeedItem[];
  liveFeedFlashIds: Record<string, boolean>;
  isLiveFeedHistoryLoading: boolean;
  liveFeedHistoryError: string | null;
  agents: Agent[];
  taskTitleById: Map<string, string>;
  currentUserDisplayName: string;
  agentAvatarLabel: AgentLabelFn;
  agentRoleLabel: AgentLabelFn;
  onViewTask: (taskId: string) => void;
};

export function LiveFeedPanel({
  isOpen,
  onClose,
  liveFeed,
  liveFeedFlashIds,
  isLiveFeedHistoryLoading,
  liveFeedHistoryError,
  agents,
  taskTitleById,
  currentUserDisplayName,
  agentAvatarLabel,
  agentRoleLabel,
  onViewTask,
}: LiveFeedPanelProps) {
  const orderedLiveFeed = [...liveFeed].sort((a, b) => {
    const aTime = apiDatetimeToMs(a.created_at) ?? 0;
    const bTime = apiDatetimeToMs(b.created_at) ?? 0;
    return bTime - aTime;
  });

  return (
    <aside
      className={cn(
        "fixed right-0 top-0 z-50 h-full w-[520px] max-w-[96vw] transform border-l border-[color:var(--border)] bg-[color:var(--surface)] shadow-2xl transition-transform",
        isOpen ? "transform-none" : "translate-x-full",
      )}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-[color:var(--border)] px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              Live feed
            </p>
            <p className="mt-1 text-sm font-medium text-strong">
              Realtime task, approval, agent, and board-chat activity.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[color:var(--border)] p-2 text-muted transition hover:bg-[color:var(--surface-muted)]"
            aria-label="Close live feed"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLiveFeedHistoryLoading && orderedLiveFeed.length === 0 ? (
            <p className="text-sm text-muted">Loading feed…</p>
          ) : liveFeedHistoryError ? (
            <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 text-sm text-[color:var(--text)] shadow-sm">
              {liveFeedHistoryError}
            </div>
          ) : orderedLiveFeed.length === 0 ? (
            <p className="text-sm text-muted">Waiting for new activity…</p>
          ) : (
            <div className="space-y-3">
              {orderedLiveFeed.map((item) => {
                const taskId = item.task_id;
                const authorAgent = item.agent_id
                  ? (agents.find((agent) => agent.id === item.agent_id) ?? null)
                  : null;
                const authorName =
                  authorAgent?.name ??
                  resolveHumanActorName(
                    item.actor_name,
                    currentUserDisplayName,
                  );
                const authorRole = authorAgent
                  ? agentRoleLabel(authorAgent)
                  : null;
                const authorAvatar = authorAgent
                  ? agentAvatarLabel(authorAgent)
                  : (authorName[0] ?? "A").toUpperCase();
                return (
                  <LiveFeedCard
                    key={item.id}
                    item={item}
                    isNew={Boolean(liveFeedFlashIds[item.id])}
                    taskTitle={
                      item.title
                        ? item.title
                        : taskId
                          ? (taskTitleById.get(taskId) ?? "Unknown task")
                          : "Activity"
                    }
                    authorName={authorName}
                    authorRole={authorRole}
                    authorAvatar={authorAvatar}
                    onViewTask={taskId ? () => onViewTask(taskId) : undefined}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

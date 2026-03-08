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
        "fixed right-0 top-0 z-50 h-full w-[520px] max-w-[96vw] transform border-l border-slate-200 bg-white shadow-2xl transition-transform",
        isOpen ? "transform-none" : "translate-x-full",
      )}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Live feed
            </p>
            <p className="mt-1 text-sm font-medium text-slate-900">
              Realtime task, approval, agent, and board-chat activity.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50"
            aria-label="Close live feed"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLiveFeedHistoryLoading && orderedLiveFeed.length === 0 ? (
            <p className="text-sm text-slate-500">Loading feed…</p>
          ) : liveFeedHistoryError ? (
            <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
              {liveFeedHistoryError}
            </div>
          ) : orderedLiveFeed.length === 0 ? (
            <p className="text-sm text-slate-500">
              Waiting for new activity…
            </p>
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
                    onViewTask={
                      taskId ? () => onViewTask(taskId) : undefined
                    }
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

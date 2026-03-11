import { useMemo, useState } from "react";

import { TaskCard } from "@/components/molecules/TaskCard";
import { parseApiDatetime } from "@/lib/datetime";
import type { BoardDensity, TaskStatus } from "@/lib/boards/board-query-state";
import type { BoardTaskGroupView, BoardTaskItem } from "@/lib/boards/board-view-model";
import { cn } from "@/lib/utils";

type TaskGroupColumnSectionProps = {
  group: BoardTaskGroupView;
  collapsed: boolean;
  readOnly: boolean;
  density: BoardDensity;
  doneCompression: boolean;
  draggingId: string | null;
  activeColumn: TaskStatus | null;
  onToggleCollapsed: () => void;
  onTaskSelect?: (task: BoardTaskItem) => void;
  onTaskMove?: (taskId: string, status: TaskStatus) => void | Promise<void>;
  onColumnHover: (status: TaskStatus) => void;
  onColumnLeave: (status: TaskStatus) => void;
  onDragStart: (
    task: BoardTaskItem,
  ) => (event: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
};

const columns: Array<{
  title: string;
  status: TaskStatus;
  dot: string;
  badge: string;
}> = [
  { title: "Inbox", status: "inbox", dot: "bg-slate-400", badge: "bg-slate-100 text-slate-600" },
  {
    title: "In Progress",
    status: "in_progress",
    dot: "bg-purple-500",
    badge: "bg-purple-100 text-purple-700",
  },
  { title: "Review", status: "review", dot: "bg-indigo-500", badge: "bg-indigo-100 text-indigo-700" },
  { title: "Done", status: "done", dot: "bg-green-500", badge: "bg-emerald-100 text-emerald-700" },
];

const resolveDueState = (
  task: BoardTaskItem,
): { due: string | undefined; isOverdue: boolean } => {
  const date = parseApiDatetime(task.due_at ?? null);
  if (!date) return { due: undefined, isOverdue: false };

  const dueLabel = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const isOverdue = task.status !== "done" && date.getTime() < Date.now();
  return {
    due: isOverdue ? `Overdue · ${dueLabel}` : dueLabel,
    isOverdue,
  };
};

export function TaskGroupColumnSection({
  group,
  collapsed,
  readOnly,
  density,
  doneCompression,
  draggingId,
  activeColumn,
  onToggleCollapsed,
  onTaskSelect,
  onTaskMove,
  onColumnHover,
  onColumnLeave,
  onDragStart,
  onDragEnd,
}: TaskGroupColumnSectionProps) {
  const [visibleLimitByStatus, setVisibleLimitByStatus] = useState<Record<TaskStatus, number>>({
    inbox: density === "compact" ? 48 : 36,
    in_progress: density === "compact" ? 48 : 36,
    review: density === "compact" ? 48 : 36,
    done: doneCompression ? (density === "compact" ? 20 : 14) : density === "compact" ? 48 : 36,
  });

  const canShowMore = useMemo(() => {
    return columns.some(
      (column) => (group.tasksByStatus[column.status]?.length ?? 0) > visibleLimitByStatus[column.status],
    );
  }, [group.tasksByStatus, visibleLimitByStatus]);

  const handleDrop =
    (status: TaskStatus) => (event: React.DragEvent<HTMLDivElement>) => {
      if (readOnly) return;
      event.preventDefault();
      const raw = event.dataTransfer.getData("text/plain");
      if (!raw) return;
      try {
        const payload = JSON.parse(raw) as { taskId?: string; status?: string };
        if (!payload.taskId || !payload.status || payload.status === status) {
          return;
        }
        void onTaskMove?.(payload.taskId, status);
      } catch {
        // Ignore malformed payloads.
      }
    };

  if (collapsed) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <button
          type="button"
          className="flex w-full items-center justify-between text-left"
          onClick={onToggleCollapsed}
        >
          <div>
            <p className="text-sm font-semibold text-slate-900">{group.title}</p>
            <p className="text-xs text-slate-500">
              {group.totalCount} tasks · {group.progressPct}% done
            </p>
          </div>
          <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
            Expand
          </span>
        </button>
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{group.title}</p>
          <p className="text-xs text-slate-500">
            {group.totalCount} tasks · {group.progressPct}% done
          </p>
        </div>
        <button
          type="button"
          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
          onClick={onToggleCollapsed}
        >
          Collapse
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-4">
        {columns.map((column) => {
          const tasks = group.tasksByStatus[column.status] ?? [];
          const visibleLimit = visibleLimitByStatus[column.status];
          const visibleTasks = tasks.slice(0, visibleLimit);
          const hiddenCount = tasks.length - visibleTasks.length;

          return (
            <div
              key={`${group.id}-${column.status}`}
              className={cn(
                "rounded-xl border border-slate-200 bg-white",
                activeColumn === column.status && !readOnly && "ring-2 ring-slate-200",
              )}
              onDrop={readOnly ? undefined : handleDrop(column.status)}
              onDragOver={(event) => {
                if (readOnly) return;
                event.preventDefault();
                onColumnHover(column.status);
              }}
              onDragLeave={() => onColumnLeave(column.status)}
            >
              <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full", column.dot)} />
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                    {column.title}
                  </h4>
                </div>
                <span
                  className={cn(
                    "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-semibold",
                    column.badge,
                  )}
                >
                  {tasks.length}
                </span>
              </div>

              <div className={cn("space-y-2 p-2", density === "compact" && "space-y-1.5") }>
                {visibleTasks.map((task, index) => {
                  const dueState = resolveDueState(task);
                  return (
                    <TaskCard
                      key={task.id}
                      title={task.title}
                      status={task.status}
                      priority={task.priority}
                      assignee={task.assignee ?? undefined}
                      due={dueState.due}
                      isOverdue={dueState.isOverdue}
                      approvalsPendingCount={task.approvals_pending_count}
                      tags={task.tags}
                      isBlocked={task.is_blocked}
                      blockedByCount={task.blocked_by_task_ids?.length ?? 0}
                      onClick={() => onTaskSelect?.(task)}
                      draggable={!readOnly && !task.is_blocked}
                      isDragging={draggingId === task.id}
                      onDragStart={readOnly ? undefined : onDragStart(task)}
                      onDragEnd={readOnly ? undefined : onDragEnd}
                      density={density}
                      deferDetails={index >= 16}
                    />
                  );
                })}
                {hiddenCount > 0 ? (
                  <button
                    type="button"
                    className="w-full rounded-lg border border-dashed border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 transition hover:border-slate-300 hover:bg-slate-50"
                    onClick={() =>
                      setVisibleLimitByStatus((prev) => ({
                        ...prev,
                        [column.status]: prev[column.status] + (density === "compact" ? 32 : 24),
                      }))
                    }
                  >
                    Show {Math.min(hiddenCount, density === "compact" ? 32 : 24)} more
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {canShowMore ? (
        <p className="mt-3 text-xs text-slate-500">
          Large-list mode active. Render is batched to keep board interactions responsive at scale.
        </p>
      ) : null}
    </section>
  );
}

import { parseApiDatetime } from "@/lib/datetime";

import type {
  BoardQueryState,
  BoardSavedView,
  TaskStatus,
} from "./board-query-state";

export type BoardTaskItem = {
  id: string;
  title: string;
  description?: string | null;
  due_at?: string | null;
  assignee?: string | null;
  status: TaskStatus;
  priority: string;
  tags?: Array<{ id: string; name: string; slug?: string; color: string }>;
  approvals_pending_count?: number;
  is_blocked?: boolean;
  blocked_by_task_ids?: string[];
  task_group_id?: string | null;
  sort_index?: number | null;
  created_at?: string;
  updated_at?: string;
  archived_at?: string | null;
};

export type BoardTaskGroupView = {
  id: string;
  title: string;
  counts: Record<TaskStatus, number>;
  tasksByStatus: Record<TaskStatus, BoardTaskItem[]>;
  doneCount: number;
  totalCount: number;
  progressPct: number;
};

export type BoardViewModel = {
  totalCount: number;
  filteredCount: number;
  groups: BoardTaskGroupView[];
};

const STATUS_ORDER: TaskStatus[] = ["inbox", "in_progress", "review", "done"];

const normalizedPriority = (
  value: string,
): "low" | "medium" | "high" | "other" => {
  const normalized = value.trim().toLowerCase();
  if (normalized === "low") return "low";
  if (normalized === "medium") return "medium";
  if (normalized === "high") return "high";
  return "other";
};

const matchesSavedView = (
  task: BoardTaskItem,
  view: BoardSavedView,
): boolean => {
  if (view === "all") return true;
  if (view === "focus") {
    return task.status !== "done" && !task.is_blocked;
  }
  if (view === "review") {
    return task.status === "review";
  }
  return Boolean(task.is_blocked) || (task.approvals_pending_count ?? 0) > 0;
};

const matchesQuery = (task: BoardTaskItem, query: string): boolean => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  const haystack = [
    task.title,
    task.description ?? "",
    task.assignee ?? "",
    ...(task.tags ?? []).map((tag) => tag.name),
  ]
    .join("\n")
    .toLowerCase();

  return haystack.includes(normalized);
};

const byTaskSortOrder = (left: BoardTaskItem, right: BoardTaskItem): number => {
  const leftSort = left.sort_index;
  const rightSort = right.sort_index;
  const leftHasSort = typeof leftSort === "number";
  const rightHasSort = typeof rightSort === "number";

  if (leftHasSort && rightHasSort && leftSort !== rightSort) {
    return leftSort - rightSort;
  }
  if (leftHasSort !== rightHasSort) {
    return leftHasSort ? -1 : 1;
  }

  const leftUpdated = parseApiDatetime(left.updated_at)?.getTime() ?? 0;
  const rightUpdated = parseApiDatetime(right.updated_at)?.getTime() ?? 0;
  if (leftUpdated !== rightUpdated) {
    return rightUpdated - leftUpdated;
  }

  return left.id.localeCompare(right.id);
};

const groupLabel = (taskGroupId: string | null | undefined): string => {
  if (!taskGroupId) return "Ungrouped";
  return `Group ${taskGroupId.slice(0, 8)}`;
};

export const buildBoardViewModel = (
  tasks: BoardTaskItem[],
  queryState: BoardQueryState,
): BoardViewModel => {
  const filtered = tasks.filter((task) => {
    if (!queryState.includeArchived && task.archived_at) {
      return false;
    }
    if (!matchesSavedView(task, queryState.savedView)) {
      return false;
    }
    if (queryState.status !== "all" && task.status !== queryState.status) {
      return false;
    }
    if (
      queryState.priority !== "all" &&
      normalizedPriority(task.priority) !== queryState.priority
    ) {
      return false;
    }
    if (queryState.hideDone && task.status === "done") {
      return false;
    }
    return matchesQuery(task, queryState.query);
  });

  const groups = new Map<string, BoardTaskGroupView>();
  for (const task of filtered) {
    const groupId = queryState.groupByTaskGroup
      ? (task.task_group_id ?? "ungrouped")
      : "all";
    const existing = groups.get(groupId);
    const group =
      existing ??
      ({
        id: groupId,
        title: queryState.groupByTaskGroup
          ? groupLabel(task.task_group_id)
          : "All Tasks",
        counts: {
          inbox: 0,
          in_progress: 0,
          review: 0,
          done: 0,
        },
        tasksByStatus: {
          inbox: [],
          in_progress: [],
          review: [],
          done: [],
        },
        doneCount: 0,
        totalCount: 0,
        progressPct: 0,
      } satisfies BoardTaskGroupView);

    group.tasksByStatus[task.status].push(task);
    group.counts[task.status] += 1;
    group.totalCount += 1;
    if (task.status === "done") {
      group.doneCount += 1;
    }
    groups.set(groupId, group);
  }

  const orderedGroups = [...groups.values()]
    .map((group) => {
      STATUS_ORDER.forEach((status) => {
        group.tasksByStatus[status] = [...group.tasksByStatus[status]].sort(
          byTaskSortOrder,
        );
      });
      group.progressPct =
        group.totalCount === 0
          ? 0
          : Math.round((group.doneCount / group.totalCount) * 100);
      return group;
    })
    .sort((left, right) => left.title.localeCompare(right.title));

  return {
    totalCount: tasks.length,
    filteredCount: filtered.length,
    groups: orderedGroups,
  };
};

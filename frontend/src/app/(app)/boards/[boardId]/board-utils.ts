import { ApiError } from "@/api/mutator";
import type { OrganizationMemberRead } from "@/api/generated/model";
import { apiDatetimeToMs, parseApiDatetime } from "@/lib/datetime";
import type { Agent, Approval, BoardChatMessage, Task } from "./board-types";

export const formatShortTimestamp = (value: string) => {
  const date = parseApiDatetime(value);
  if (!date) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const commentElementId = (id: string): string =>
  `task-comment-${id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;

export const formatActionError = (err: unknown, fallback: string) => {
  if (err instanceof ApiError) {
    if (err.status === 403) {
      return "Read-only access. You do not have permission to make changes.";
    }
    return err.message || fallback;
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return fallback;
};

export const resolveBoardAccess = (
  member: OrganizationMemberRead | null,
  boardId?: string | null,
) => {
  if (!member || !boardId) {
    return { canRead: false, canWrite: false };
  }
  if (member.all_boards_write) {
    return { canRead: true, canWrite: true };
  }
  if (member.all_boards_read) {
    return { canRead: true, canWrite: false };
  }
  const entry = member.board_access?.find(
    (access) => access.board_id === boardId,
  );
  if (!entry) {
    return { canRead: false, canWrite: false };
  }
  const canWrite = Boolean(entry.can_write);
  const canRead = Boolean(entry.can_read || entry.can_write);
  return { canRead, canWrite };
};

export const latestTaskTimestamp = (items: Task[]): string | null => {
  let latestTime = 0;
  items.forEach((task) => {
    const value = task.updated_at ?? task.created_at;
    if (!value) return;
    const time = apiDatetimeToMs(value);
    if (time !== null && time > latestTime) {
      latestTime = time;
    }
  });
  return latestTime ? new Date(latestTime).toISOString() : null;
};

export const latestApprovalTimestamp = (items: Approval[]): string | null => {
  let latestTime = 0;
  items.forEach((approval) => {
    const value = approval.resolved_at ?? approval.created_at;
    if (!value) return;
    const time = apiDatetimeToMs(value);
    if (time !== null && time > latestTime) {
      latestTime = time;
    }
  });
  return latestTime ? new Date(latestTime).toISOString() : null;
};

export const latestAgentTimestamp = (items: Agent[]): string | null => {
  let latestTime = 0;
  items.forEach((agent) => {
    const value = agent.updated_at ?? agent.last_seen_at;
    if (!value) return;
    const time = apiDatetimeToMs(value);
    if (time !== null && time > latestTime) {
      latestTime = time;
    }
  });
  return latestTime ? new Date(latestTime).toISOString() : null;
};

export const latestChatTimestamp = (
  items: BoardChatMessage[],
): string | undefined => {
  if (!items.length) return undefined;
  const latest = items.reduce((max, item) => {
    const ts = apiDatetimeToMs(item.created_at);
    return ts === null ? max : Math.max(max, ts);
  }, 0);
  if (!latest) return undefined;
  return new Date(latest).toISOString();
};

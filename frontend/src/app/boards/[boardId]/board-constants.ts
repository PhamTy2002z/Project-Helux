import type { LiveFeedEventType } from "./board-types";

export const LIVE_FEED_EVENT_TYPES = new Set<LiveFeedEventType>([
  "task.comment",
  "task.created",
  "task.updated",
  "task.status_changed",
  "board.chat",
  "board.command",
  "agent.created",
  "agent.online",
  "agent.offline",
  "agent.updated",
  "approval.created",
  "approval.updated",
  "approval.approved",
  "approval.rejected",
]);

export const isLiveFeedEventType = (value: string): value is LiveFeedEventType =>
  LIVE_FEED_EVENT_TYPES.has(value as LiveFeedEventType);

export const priorities = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

export const statusOptions = [
  { value: "inbox", label: "Inbox" },
  { value: "in_progress", label: "In progress" },
  { value: "review", label: "Review" },
  { value: "done", label: "Done" },
];

export const SSE_RECONNECT_BACKOFF = {
  baseMs: 1_000,
  factor: 2,
  jitter: 0.2,
  maxMs: 5 * 60_000,
} as const;

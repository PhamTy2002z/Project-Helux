import type {
  AgentRead,
  ApprovalRead,
  BoardMemoryRead,
  BoardRead,
  TaskCardRead,
  TaskCommentRead,
} from "@/api/generated/model";
import type { TaskCustomFieldValues } from "./custom-field-utils";

export type Board = BoardRead;

export type TaskStatus = Exclude<TaskCardRead["status"], undefined>;

export type TaskCustomFieldPayload = {
  custom_field_values?: TaskCustomFieldValues;
};

export type Task = Omit<
  TaskCardRead,
  "status" | "priority" | "approvals_count" | "approvals_pending_count"
> & {
  status: TaskStatus;
  priority: string;
  approvals_count: number;
  approvals_pending_count: number;
  custom_field_values?: TaskCustomFieldValues | null;
};

export type Agent = AgentRead & { status: string };

export type TaskComment = TaskCommentRead;

export type Approval = ApprovalRead & { status: string };

export type BoardChatMessage = BoardMemoryRead;

export type LiveFeedEventType =
  | "task.comment"
  | "task.created"
  | "task.updated"
  | "task.status_changed"
  | "board.chat"
  | "board.command"
  | "agent.created"
  | "agent.online"
  | "agent.offline"
  | "agent.updated"
  | "approval.created"
  | "approval.updated"
  | "approval.approved"
  | "approval.rejected";

export type LiveFeedItem = {
  id: string;
  created_at: string;
  message: string | null;
  agent_id: string | null;
  actor_name?: string | null;
  task_id: string | null;
  title?: string | null;
  event_type: LiveFeedEventType;
};

export type ToastMessage = {
  id: number;
  message: string;
  tone: "error" | "success";
};

import type {
  AgentRead,
  ApprovalRead,
  TaskCardRead,
} from "@/api/generated/model";
import type { Agent, Approval, Task } from "./board-types";

export const normalizeTask = (task: TaskCardRead): Task => ({
  ...task,
  status: task.status ?? "inbox",
  priority: task.priority ?? "medium",
  approvals_count: task.approvals_count ?? 0,
  approvals_pending_count: task.approvals_pending_count ?? 0,
});

export const normalizeAgent = (agent: AgentRead): Agent => ({
  ...agent,
  status: agent.status ?? "offline",
});

export const normalizeApproval = (approval: ApprovalRead): Approval => ({
  ...approval,
  status: approval.status ?? "pending",
});

export const normalizeTagColor = (value?: string | null): string => {
  const cleaned = (value ?? "").trim().replace(/^#/, "").toLowerCase();
  if (!/^[0-9a-f]{6}$/.test(cleaned)) return "9e9e9e";
  return cleaned;
};

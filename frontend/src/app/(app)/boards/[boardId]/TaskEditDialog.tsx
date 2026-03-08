"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import DropdownSelect, {
  type DropdownSelectOption,
} from "@/components/ui/dropdown-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TaskCustomFieldsEditor } from "./TaskCustomFieldsEditor";
import type { TagRead, TaskCustomFieldDefinitionRead } from "@/api/generated/model";
import type { TaskCardRead } from "@/api/generated/model";
import { updateTaskApiV1BoardsBoardIdTasksTaskIdPatch } from "@/api/generated/tasks/tasks";
import {
  localDateInputToUtcIso,
  toLocalDateInput,
} from "@/lib/datetime";
import {
  boardCustomFieldValues,
  canonicalizeCustomFieldValues,
  customFieldPayload,
  customFieldPatchPayload,
  firstMissingRequiredCustomField,
  type TaskCustomFieldValues,
} from "./custom-field-utils";
import { normalizeTask, normalizeTagColor } from "./board-normalizers";
import { formatActionError } from "./board-utils";
import { priorities, statusOptions } from "./board-constants";
import type { Agent, Task, TaskStatus } from "./board-types";
import { cn } from "@/lib/utils";

export type TaskEditDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string | undefined;
  isSignedIn: boolean;
  canWrite: boolean;
  selectedTask: Task | null;
  tasks: Task[];
  agents: Agent[];
  tags: TagRead[];
  boardCustomFieldDefinitions: TaskCustomFieldDefinitionRead[];
  customFieldDefinitionsLoading: boolean;
  assigneeById: Map<string, string>;
  onSaved: (task: Task) => void;
  onDeleteOpen: () => void;
  onError: (message: string) => void;
  onNavigate: (url: string) => void;
};

type BoardTaskUpdatePayload = Parameters<
  typeof updateTaskApiV1BoardsBoardIdTasksTaskIdPatch
>[2] & { custom_field_values?: TaskCustomFieldValues };

export function TaskEditDialog({
  isOpen,
  onOpenChange,
  boardId,
  isSignedIn,
  canWrite,
  selectedTask,
  tasks,
  agents,
  tags,
  boardCustomFieldDefinitions,
  customFieldDefinitionsLoading,
  assigneeById,
  onSaved,
  onDeleteOpen,
  onError,
  onNavigate,
}: TaskEditDialogProps) {
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState<TaskStatus>("inbox");
  const [editPriority, setEditPriority] = useState("medium");
  const [editDueDate, setEditDueDate] = useState("");
  const [editAssigneeId, setEditAssigneeId] = useState("");
  const [editTagIds, setEditTagIds] = useState<string[]>([]);
  const [editDependsOnTaskIds, setEditDependsOnTaskIds] = useState<string[]>([]);
  const [editCustomFieldValues, setEditCustomFieldValues] =
    useState<TaskCustomFieldValues>({});
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [saveTaskError, setSaveTaskError] = useState<string | null>(null);

  // Sync form when selectedTask changes
  useEffect(() => {
    if (!selectedTask) {
      setEditTitle("");
      setEditDescription("");
      setEditStatus("inbox");
      setEditPriority("medium");
      setEditDueDate("");
      setEditAssigneeId("");
      setEditTagIds([]);
      setEditDependsOnTaskIds([]);
      setEditCustomFieldValues(
        boardCustomFieldValues(boardCustomFieldDefinitions, {}),
      );
      setSaveTaskError(null);
      return;
    }
    setEditTitle(selectedTask.title);
    setEditDescription(selectedTask.description ?? "");
    setEditStatus(selectedTask.status);
    setEditPriority(selectedTask.priority);
    setEditDueDate(toLocalDateInput(selectedTask.due_at));
    setEditAssigneeId(selectedTask.assigned_agent_id ?? "");
    setEditTagIds(selectedTask.tag_ids ?? []);
    setEditDependsOnTaskIds(selectedTask.depends_on_task_ids ?? []);
    setEditCustomFieldValues(
      boardCustomFieldValues(
        boardCustomFieldDefinitions,
        selectedTask.custom_field_values,
      ),
    );
    setSaveTaskError(null);
  }, [boardCustomFieldDefinitions, selectedTask]);

  const tagById = useMemo(() => {
    const map = new Map<string, TagRead>();
    tags.forEach((tag) => map.set(tag.id, tag));
    return map;
  }, [tags]);

  const taskById = useMemo(() => {
    const map = new Map<string, Task>();
    tasks.forEach((task) => map.set(task.id, task));
    return map;
  }, [tasks]);

  const taskTitleById = useMemo(() => {
    const map = new Map<string, string>();
    tasks.forEach((task) => map.set(task.id, task.title));
    return map;
  }, [tasks]);

  const assignableAgents = useMemo(
    () => agents.filter((agent) => !agent.is_board_lead),
    [agents],
  );

  const editTagOptions = useMemo<DropdownSelectOption[]>(() => {
    const selected = new Set(editTagIds);
    return tags.map((tag) => ({
      value: tag.id,
      label: `${tag.name} (#${normalizeTagColor(tag.color).toUpperCase()})`,
      disabled: selected.has(tag.id),
    }));
  }, [editTagIds, tags]);

  const dependencyOptions = useMemo<DropdownSelectOption[]>(() => {
    if (!selectedTask) return [];
    const alreadySelected = new Set(editDependsOnTaskIds);
    return tasks
      .filter((task) => task.id !== selectedTask.id)
      .map((task) => ({
        value: task.id,
        label: `${task.title} (${task.status.replace(/_/g, " ")})`,
        disabled: alreadySelected.has(task.id),
      }));
  }, [editDependsOnTaskIds, selectedTask, tasks]);

  const hasTaskChanges = useMemo(() => {
    if (!selectedTask) return false;
    const normalizedTitle = editTitle.trim();
    const normalizedDescription = editDescription.trim();
    const currentDescription = (selectedTask.description ?? "").trim();
    const currentDueDate = toLocalDateInput(selectedTask.due_at);
    const currentAssignee = selectedTask.assigned_agent_id ?? "";
    const currentTags = [...(selectedTask.tag_ids ?? [])].sort().join("|");
    const nextTags = [...editTagIds].sort().join("|");
    const currentDeps = [...(selectedTask.depends_on_task_ids ?? [])]
      .sort()
      .join("|");
    const nextDeps = [...editDependsOnTaskIds].sort().join("|");
    const currentCustomFieldValues = canonicalizeCustomFieldValues(
      boardCustomFieldValues(
        boardCustomFieldDefinitions,
        selectedTask.custom_field_values,
      ),
    );
    const nextCustomFieldValues = canonicalizeCustomFieldValues(
      customFieldPayload(boardCustomFieldDefinitions, editCustomFieldValues),
    );
    return (
      normalizedTitle !== selectedTask.title ||
      normalizedDescription !== currentDescription ||
      editStatus !== selectedTask.status ||
      editPriority !== selectedTask.priority ||
      editDueDate !== currentDueDate ||
      editAssigneeId !== currentAssignee ||
      currentTags !== nextTags ||
      currentDeps !== nextDeps ||
      currentCustomFieldValues !== nextCustomFieldValues
    );
  }, [
    editAssigneeId,
    editDueDate,
    editTagIds,
    editDependsOnTaskIds,
    editDescription,
    editPriority,
    editStatus,
    editTitle,
    editCustomFieldValues,
    boardCustomFieldDefinitions,
    selectedTask,
  ]);

  const addTaskDependency = useCallback((dependencyId: string) => {
    setEditDependsOnTaskIds((prev) =>
      prev.includes(dependencyId) ? prev : [...prev, dependencyId],
    );
  }, []);

  const removeTaskDependency = useCallback((dependencyId: string) => {
    setEditDependsOnTaskIds((prev) =>
      prev.filter((value) => value !== dependencyId),
    );
  }, []);

  const addEditTag = useCallback((tagId: string) => {
    setEditTagIds((prev) => (prev.includes(tagId) ? prev : [...prev, tagId]));
  }, []);

  const removeEditTag = useCallback((tagId: string) => {
    setEditTagIds((prev) => prev.filter((value) => value !== tagId));
  }, []);

  const handleTaskReset = () => {
    if (!selectedTask) return;
    setEditTitle(selectedTask.title);
    setEditDescription(selectedTask.description ?? "");
    setEditStatus(selectedTask.status);
    setEditPriority(selectedTask.priority);
    setEditDueDate(toLocalDateInput(selectedTask.due_at));
    setEditAssigneeId(selectedTask.assigned_agent_id ?? "");
    setEditTagIds(selectedTask.tag_ids ?? []);
    setEditDependsOnTaskIds(selectedTask.depends_on_task_ids ?? []);
    setEditCustomFieldValues(
      boardCustomFieldValues(
        boardCustomFieldDefinitions,
        selectedTask.custom_field_values,
      ),
    );
    setSaveTaskError(null);
  };

  const handleTaskSave = async (closeOnSuccess = false) => {
    if (!selectedTask || !isSignedIn || !boardId) return;
    const trimmedTitle = editTitle.trim();
    if (!trimmedTitle) {
      setSaveTaskError("Title is required.");
      return;
    }
    const currentTaskCustomFieldValues = boardCustomFieldValues(
      boardCustomFieldDefinitions,
      selectedTask.custom_field_values,
    );
    const editCustomFieldPayload = customFieldPayload(
      boardCustomFieldDefinitions,
      editCustomFieldValues,
    );
    const editCustomFieldPatch = customFieldPatchPayload(
      boardCustomFieldDefinitions,
      currentTaskCustomFieldValues,
      editCustomFieldPayload,
    );
    const missingRequiredCustomField = firstMissingRequiredCustomField(
      boardCustomFieldDefinitions.filter((definition) =>
        Object.prototype.hasOwnProperty.call(
          editCustomFieldPatch,
          definition.field_key,
        ),
      ),
      editCustomFieldPatch,
    );
    if (missingRequiredCustomField) {
      setSaveTaskError(
        `Custom field "${missingRequiredCustomField}" is required.`,
      );
      return;
    }
    setIsSavingTask(true);
    setSaveTaskError(null);
    try {
      const currentDeps = [...(selectedTask.depends_on_task_ids ?? [])]
        .sort()
        .join("|");
      const nextDeps = [...editDependsOnTaskIds].sort().join("|");
      const depsChanged = currentDeps !== nextDeps;
      const currentTags = [...(selectedTask.tag_ids ?? [])].sort().join("|");
      const nextTags = [...editTagIds].sort().join("|");
      const tagsChanged = currentTags !== nextTags;
      const currentDueDate = toLocalDateInput(selectedTask.due_at);
      const dueDateChanged = editDueDate !== currentDueDate;
      const customFieldValuesChanged =
        Object.keys(editCustomFieldPatch).length > 0;

      const updatePayload: BoardTaskUpdatePayload = {
        title: trimmedTitle,
        description: editDescription.trim() || null,
        status: editStatus,
        priority: editPriority,
        assigned_agent_id: editAssigneeId || null,
      };

      if (depsChanged && selectedTask.status !== "done") {
        updatePayload.depends_on_task_ids = editDependsOnTaskIds;
      }
      if (tagsChanged) {
        updatePayload.tag_ids = editTagIds;
      }
      if (dueDateChanged) {
        updatePayload.due_at = localDateInputToUtcIso(editDueDate);
      }
      if (
        customFieldValuesChanged &&
        Object.keys(editCustomFieldPatch).length > 0
      ) {
        updatePayload.custom_field_values = editCustomFieldPatch;
      }

      const result = await updateTaskApiV1BoardsBoardIdTasksTaskIdPatch(
        boardId,
        selectedTask.id,
        updatePayload,
      );
      if (result.status === 409) {
        const blockedIds = result.data.detail.blocked_by_task_ids ?? [];
        const blockedTitles = blockedIds
          .map((id) => taskTitleById.get(id) ?? id)
          .join(", ");
        setSaveTaskError(
          blockedTitles
            ? `${result.data.detail.message} Blocked by: ${blockedTitles}`
            : result.data.detail.message,
        );
        return;
      }
      if (result.status === 422) {
        setSaveTaskError(
          result.data.detail?.[0]?.msg ?? "Validation error while saving task.",
        );
        return;
      }
      const previous =
        tasks.find((task) => task.id === selectedTask.id) ?? selectedTask;
      const updated = normalizeTask({
        ...previous,
        ...result.data,
        assignee: result.data.assigned_agent_id
          ? (assigneeById.get(result.data.assigned_agent_id) ?? null)
          : null,
        approvals_count: previous.approvals_count,
        approvals_pending_count: previous.approvals_pending_count,
      } as TaskCardRead);
      onSaved(updated);
      if (closeOnSuccess) {
        onOpenChange(false);
      }
    } catch (err) {
      const message = formatActionError(err, "Something went wrong.");
      setSaveTaskError(message);
      onError(message);
    } finally {
      setIsSavingTask(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent aria-label="Edit task">
        <DialogHeader>
          <DialogTitle>Edit task</DialogTitle>
          <DialogDescription>
            Update task details, priority, status, or assignment.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Title
            </label>
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Task title"
              disabled={!selectedTask || isSavingTask || !canWrite}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Description
            </label>
            <Textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Task details"
              className="min-h-[140px]"
              disabled={!selectedTask || isSavingTask || !canWrite}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Custom fields
            </label>
            <TaskCustomFieldsEditor
              definitions={boardCustomFieldDefinitions}
              values={editCustomFieldValues}
              setValues={setEditCustomFieldValues}
              isLoading={customFieldDefinitionsLoading}
              disabled={!selectedTask || isSavingTask || !canWrite}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Status
              </label>
              <Select
                value={editStatus}
                onValueChange={(value) => setEditStatus(value as TaskStatus)}
                disabled={!selectedTask || isSavingTask || !canWrite}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Priority
              </label>
              <Select
                value={editPriority}
                onValueChange={setEditPriority}
                disabled={!selectedTask || isSavingTask || !canWrite}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  {priorities.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Due date
              </label>
              <Input
                type="date"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
                disabled={!selectedTask || isSavingTask || !canWrite}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Assignee
            </label>
            <Select
              value={editAssigneeId || "unassigned"}
              onValueChange={(value) =>
                setEditAssigneeId(value === "unassigned" ? "" : value)
              }
              disabled={!selectedTask || isSavingTask || !canWrite}
            >
              <SelectTrigger>
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {assignableAgents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {assignableAgents.length === 0 ? (
              <p className="text-xs text-slate-500">
                Add agents to assign tasks.
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Tags
              </label>
              <button
                type="button"
                onClick={() => onNavigate("/tags")}
                className="text-xs font-medium text-slate-500 underline underline-offset-2 transition hover:text-slate-700"
              >
                Manage tags
              </button>
            </div>
            <DropdownSelect
              ariaLabel="Add tag"
              placeholder="Add tag"
              options={editTagOptions}
              onValueChange={addEditTag}
              disabled={!selectedTask || isSavingTask || !canWrite}
              emptyMessage="No tags configured."
            />
            {editTagIds.length === 0 ? (
              <p className="text-xs text-slate-500">No tags assigned.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {editTagIds.map((tagId) => {
                  const tag = tagById.get(tagId);
                  const label = tag?.name ?? tagId;
                  const color = normalizeTagColor(tag?.color);
                  return (
                    <span
                      key={tagId}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700"
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: `#${color}` }}
                      />
                      <span className="max-w-[16rem] truncate">{label}</span>
                      <button
                        type="button"
                        onClick={() => removeEditTag(tagId)}
                        className={cn(
                          "rounded-full p-0.5 text-slate-500 transition",
                          canWrite
                            ? "hover:bg-white hover:text-slate-700"
                            : "opacity-50 cursor-not-allowed",
                        )}
                        aria-label="Remove tag"
                        disabled={!canWrite}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Dependencies
            </label>
            <p className="text-xs text-slate-500">
              Tasks stay blocked until every dependency is marked done.
            </p>
            <DropdownSelect
              ariaLabel="Add dependency"
              placeholder="Add dependency"
              options={dependencyOptions}
              onValueChange={addTaskDependency}
              disabled={
                !selectedTask ||
                isSavingTask ||
                selectedTask.status === "done" ||
                !canWrite
              }
              emptyMessage="No other tasks found."
            />
            {selectedTask?.status === "done" ? (
              <p className="text-xs text-slate-500">
                Dependencies can only be edited until the task is done.
              </p>
            ) : null}
            {editDependsOnTaskIds.length === 0 ? (
              <p className="text-xs text-slate-500">No dependencies.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {editDependsOnTaskIds.map((depId) => {
                  const depTask = taskById.get(depId);
                  const label = depTask?.title ?? depId;
                  const statusLabel = depTask?.status
                    ? depTask.status.replace(/_/g, " ")
                    : null;
                  const isDone = depTask?.status === "done";
                  return (
                    <span
                      key={depId}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs",
                        isDone
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border-slate-200 bg-slate-50 text-slate-700",
                      )}
                    >
                      <span className="max-w-[18rem] truncate">{label}</span>
                      {statusLabel ? (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                          {statusLabel}
                        </span>
                      ) : null}
                      {selectedTask?.status !== "done" ? (
                        <button
                          type="button"
                          onClick={() => removeTaskDependency(depId)}
                          className={cn(
                            "rounded-full p-0.5 text-slate-500 transition",
                            canWrite
                              ? "hover:bg-white hover:text-slate-700"
                              : "opacity-50 cursor-not-allowed",
                          )}
                          aria-label="Remove dependency"
                          disabled={!canWrite}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      ) : null}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
          {saveTaskError ? (
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600">
              {saveTaskError}
            </div>
          ) : null}
        </div>
        <DialogFooter className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={onDeleteOpen}
            disabled={!selectedTask || isSavingTask || !canWrite}
            className="border-rose-200 text-rose-600 hover:border-rose-300 hover:text-rose-700"
            title={canWrite ? "Delete task" : "Read-only access"}
          >
            Delete task
          </Button>
          <Button
            variant="outline"
            onClick={handleTaskReset}
            disabled={
              !selectedTask || isSavingTask || !hasTaskChanges || !canWrite
            }
          >
            Reset
          </Button>
          <Button
            onClick={() => handleTaskSave(true)}
            disabled={
              !selectedTask || isSavingTask || !hasTaskChanges || !canWrite
            }
          >
            {isSavingTask ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

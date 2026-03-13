"use client";

import { useState, useCallback, useMemo } from "react";
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
import { createTaskApiV1BoardsBoardIdTasksPost } from "@/api/generated/tasks/tasks";
import type { TaskCardRead } from "@/api/generated/model";
import { localDateInputToUtcIso } from "@/lib/datetime";
import {
  customFieldPayload,
  firstMissingRequiredCustomField,
  type TaskCustomFieldValues,
} from "./custom-field-utils";
import { normalizeTask, normalizeTagColor } from "./board-normalizers";
import { formatActionError } from "./board-utils";
import { priorities } from "./board-constants";
import type { Task } from "./board-types";

export type TaskCreateDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string | undefined;
  isSignedIn: boolean;
  canWrite: boolean;
  tags: TagRead[];
  boardCustomFieldDefinitions: TaskCustomFieldDefinitionRead[];
  customFieldDefinitionsLoading: boolean;
  defaultCreateCustomFieldValues: TaskCustomFieldValues;
  assigneeById: Map<string, string>;
  onTaskCreated: (task: Task) => void;
  onError: (message: string) => void;
  boardLabel: string;
  onNavigate: (url: string) => void;
};

export function TaskCreateDialog({
  isOpen,
  onOpenChange,
  boardId,
  isSignedIn,
  canWrite,
  tags,
  boardCustomFieldDefinitions,
  customFieldDefinitionsLoading,
  defaultCreateCustomFieldValues,
  assigneeById,
  onTaskCreated,
  onError,
  boardLabel,
  onNavigate,
}: TaskCreateDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [createDueDate, setCreateDueDate] = useState("");
  const [createTagIds, setCreateTagIds] = useState<string[]>([]);
  const [createCustomFieldValues, setCreateCustomFieldValues] =
    useState<TaskCustomFieldValues>(defaultCreateCustomFieldValues);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const tagById = useMemo(() => {
    const map = new Map<string, TagRead>();
    tags.forEach((tag) => map.set(tag.id, tag));
    return map;
  }, [tags]);

  const createTagOptions = useMemo<DropdownSelectOption[]>(() => {
    const selected = new Set(createTagIds);
    return tags.map((tag) => ({
      value: tag.id,
      label: `${tag.name} (#${normalizeTagColor(tag.color).toUpperCase()})`,
      disabled: selected.has(tag.id),
    }));
  }, [createTagIds, tags]);

  const addCreateTag = useCallback((tagId: string) => {
    setCreateTagIds((prev) => (prev.includes(tagId) ? prev : [...prev, tagId]));
  }, []);

  const removeCreateTag = useCallback((tagId: string) => {
    setCreateTagIds((prev) => prev.filter((value) => value !== tagId));
  }, []);

  const resetForm = useCallback(() => {
    setTitle("");
    setDescription("");
    setPriority("medium");
    setCreateDueDate("");
    setCreateTagIds([]);
    setCreateCustomFieldValues(defaultCreateCustomFieldValues);
    setCreateError(null);
  }, [defaultCreateCustomFieldValues]);

  const handleCreateTask = async () => {
    if (!isSignedIn || !boardId) return;
    const trimmed = title.trim();
    if (!trimmed) {
      setCreateError("Add a task title to continue.");
      return;
    }
    const createCustomFieldPayload = customFieldPayload(
      boardCustomFieldDefinitions,
      createCustomFieldValues,
    );
    const missingRequiredCustomField = firstMissingRequiredCustomField(
      boardCustomFieldDefinitions,
      createCustomFieldPayload,
    );
    if (missingRequiredCustomField) {
      setCreateError(
        `Custom field "${missingRequiredCustomField}" is required.`,
      );
      return;
    }
    setIsCreating(true);
    setCreateError(null);
    try {
      const result = await createTaskApiV1BoardsBoardIdTasksPost(boardId, {
        title: trimmed,
        description: description.trim() || null,
        status: "inbox",
        priority,
        due_at: localDateInputToUtcIso(createDueDate),
        tag_ids: createTagIds,
        custom_field_values: createCustomFieldPayload,
      });
      if (result.status !== 200) throw new Error("Unable to create task.");

      const created = normalizeTask({
        ...result.data,
        assignee: result.data.assigned_agent_id
          ? (assigneeById.get(result.data.assigned_agent_id) ?? null)
          : null,
        approvals_count: 0,
        approvals_pending_count: 0,
      } as TaskCardRead);
      onTaskCreated(created);
      onOpenChange(false);
      resetForm();
    } catch (err) {
      const message = formatActionError(err, "Something went wrong.");
      setCreateError(message);
      onError(message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) resetForm();
      }}
    >
      <DialogContent aria-label={boardLabel}>
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
          <DialogDescription>
            Add a task to the inbox and triage it when you are ready.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-strong">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Prepare launch notes"
              disabled={!canWrite || isCreating}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-strong">
              Description
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional details"
              className="min-h-[120px]"
              disabled={!canWrite || isCreating}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-strong">
              Custom fields
            </label>
            <TaskCustomFieldsEditor
              definitions={boardCustomFieldDefinitions}
              values={createCustomFieldValues}
              setValues={setCreateCustomFieldValues}
              isLoading={customFieldDefinitionsLoading}
              disabled={!canWrite || isCreating}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-strong">Priority</label>
            <Select
              value={priority}
              onValueChange={setPriority}
              disabled={!canWrite || isCreating}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                {priorities.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-strong">Due date</label>
            <Input
              type="date"
              value={createDueDate}
              onChange={(e) => setCreateDueDate(e.target.value)}
              disabled={!canWrite || isCreating}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm font-medium text-strong">Tags</label>
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
              options={createTagOptions}
              onValueChange={addCreateTag}
              disabled={!canWrite || isCreating}
              emptyMessage="No tags configured."
            />
            {createTagIds.length ? (
              <div className="flex flex-wrap gap-2">
                {createTagIds.map((tagId) => {
                  const tag = tagById.get(tagId);
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
                      {tag?.name ?? tagId}
                      <button
                        type="button"
                        onClick={() => removeCreateTag(tagId)}
                        className="rounded-full p-0.5 text-slate-500 transition hover:bg-white hover:text-slate-700"
                        aria-label="Remove tag"
                        disabled={!canWrite || isCreating}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500">No tags assigned.</p>
            )}
          </div>
          {createError ? (
            <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-3 text-xs text-muted">
              {createError}
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCreateTask}
            disabled={!canWrite || isCreating}
          >
            {isCreating ? "Creating…" : "Create task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

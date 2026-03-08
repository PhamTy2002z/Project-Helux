"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteTaskApiV1BoardsBoardIdTasksTaskIdDelete } from "@/api/generated/tasks/tasks";
import { formatActionError } from "./board-utils";
import type { Task } from "./board-types";

export type TaskDeleteDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string | undefined;
  isSignedIn: boolean;
  canWrite: boolean;
  selectedTask: Task | null;
  onDeleted: (taskId: string) => void;
  onError: (message: string) => void;
};

export function TaskDeleteDialog({
  isOpen,
  onOpenChange,
  boardId,
  isSignedIn,
  canWrite,
  selectedTask,
  onDeleted,
  onError,
}: TaskDeleteDialogProps) {
  const [isDeletingTask, setIsDeletingTask] = useState(false);
  const [deleteTaskError, setDeleteTaskError] = useState<string | null>(null);

  const handleDeleteTask = async () => {
    if (!selectedTask || !boardId || !isSignedIn) return;
    setIsDeletingTask(true);
    setDeleteTaskError(null);
    try {
      const result = await deleteTaskApiV1BoardsBoardIdTasksTaskIdDelete(
        boardId,
        selectedTask.id,
      );
      if (result.status !== 200) throw new Error("Unable to delete task.");
      onDeleted(selectedTask.id);
      onOpenChange(false);
    } catch (err) {
      const message = formatActionError(err, "Something went wrong.");
      setDeleteTaskError(message);
      onError(message);
    } finally {
      setIsDeletingTask(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(next) => {
        if (!isDeletingTask) onOpenChange(next);
      }}
    >
      <DialogContent aria-label="Delete task">
        <DialogHeader>
          <DialogTitle>Delete task</DialogTitle>
          <DialogDescription>
            This removes the task permanently. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {deleteTaskError ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-600">
            {deleteTaskError}
          </div>
        ) : null}
        <DialogFooter className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeletingTask}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteTask}
            disabled={isDeletingTask || !canWrite}
            className="bg-rose-600 text-white hover:bg-rose-700"
          >
            {isDeletingTask ? "Deleting…" : "Delete task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

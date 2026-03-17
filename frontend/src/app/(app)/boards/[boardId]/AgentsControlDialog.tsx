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

export type AgentsControlDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  action: "pause" | "resume";
  onConfirmed: () => Promise<{ ok: boolean; error: string | null }>;
};

export function AgentsControlDialog({
  isOpen,
  onOpenChange,
  action,
  onConfirmed,
}: AgentsControlDialogProps) {
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setIsSending(true);
    setError(null);
    try {
      const result = await onConfirmed();
      if (!result.ok) {
        setError(result.error ?? `Unable to send /${action} command.`);
        return;
      }
      onOpenChange(false);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setError(null);
      }}
    >
      <DialogContent aria-label="Agent controls">
        <DialogHeader>
          <DialogTitle>
            {action === "pause" ? "Pause agents" : "Resume agents"}
          </DialogTitle>
          <DialogDescription>
            {action === "pause"
              ? "Send /pause to every agent on this board."
              : "Send /resume to every agent on this board."}
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-3 text-sm text-[color:var(--text)]">
          <p className="font-semibold text-strong">What happens</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              This posts{" "}
              <span className="font-mono">
                {action === "pause" ? "/pause" : "/resume"}
              </span>{" "}
              to board chat.
            </li>
            <li>
              FlowGrid forwards it to all agents on this board.
            </li>
          </ul>
        </div>

        <DialogFooter className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSending}
          >
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isSending}>
            {isSending
              ? "Sending…"
              : action === "pause"
                ? "Pause agents"
                : "Resume agents"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

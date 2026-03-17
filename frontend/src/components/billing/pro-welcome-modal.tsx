"use client";

import { CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const UNLOCKED_FEATURES = [
  "2 board groups, 3 boards",
  "15 agents total, 5 per board",
  "200M tokens/month",
  "16k max tokens/run",
];

type ProWelcomeModalProps = {
  open: boolean;
  onClose: () => void;
};

/** Celebration modal shown on dashboard after successful Pro upgrade. */
export function ProWelcomeModal({ open, onClose }: ProWelcomeModalProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md sm:p-8 text-center">
        <DialogHeader className="items-center">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
            <Sparkles className="h-7 w-7 text-emerald-600" />
          </div>
          <DialogTitle className="text-xl">Welcome to Pro!</DialogTitle>
          <p className="mt-1 text-sm text-muted">
            Your plan is now active. Here&apos;s what&apos;s unlocked:
          </p>
        </DialogHeader>

        <ul className="mx-auto mt-4 w-full max-w-xs space-y-2.5 text-left">
          {UNLOCKED_FEATURES.map((f) => (
            <li
              key={f}
              className="flex items-center gap-2.5 text-sm text-[color:var(--text)]"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              {f}
            </li>
          ))}
        </ul>

        <DialogFooter className="mt-6 sm:justify-center">
          <Button onClick={onClose} className="w-full sm:w-auto">
            Get Started
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

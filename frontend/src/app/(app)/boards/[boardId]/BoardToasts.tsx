"use client";

import { cn } from "@/lib/utils";
import type { ToastMessage } from "./board-types";

export type BoardToastsProps = {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
};

export function BoardToasts({ toasts, onDismiss }: BoardToastsProps) {
  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[60] flex w-[320px] max-w-[90vw] flex-col gap-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "rounded-xl border bg-[color:var(--surface)] px-4 py-3 text-sm shadow-lush",
            toast.tone === "error"
              ? "border-rose-200 text-rose-700"
              : "border-emerald-200 text-emerald-700",
          )}
        >
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "mt-1 h-2 w-2 rounded-full",
                toast.tone === "error" ? "bg-rose-500" : "bg-emerald-500",
              )}
            />
            <p className="flex-1 text-sm text-[color:var(--text)]">{toast.message}</p>
            <button
              type="button"
              className="text-xs text-quiet hover:text-[color:var(--text-muted)]"
              onClick={() => onDismiss(toast.id)}
            >
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

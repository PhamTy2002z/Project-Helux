import { useEffect, useRef, useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";

import {
  BOARD_SAVED_VIEW_OPTIONS,
  type BoardPriorityFilter,
  type BoardQueryState,
  type BoardStatusFilter,
} from "@/lib/boards/board-query-state";
import { cn } from "@/lib/utils";

type TaskBoardFilterBarProps = {
  state: BoardQueryState;
  visibleCount: number;
  totalCount: number;
  groupCount: number;
  onChange: (next: BoardQueryState) => void;
  onCollapseAll?: () => void;
  onExpandAll?: () => void;
};

const STATUS_OPTIONS: Array<{ value: BoardStatusFilter; label: string }> = [
  { value: "all", label: "All Statuses" },
  { value: "inbox", label: "Inbox" },
  { value: "in_progress", label: "In Progress" },
  { value: "review", label: "Review" },
  { value: "done", label: "Done" },
];

const PRIORITY_OPTIONS: Array<{ value: BoardPriorityFilter; label: string }> = [
  { value: "all", label: "All Priorities" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

/** Count how many advanced toggles are active to show a badge on the "More" button. */
function countActiveToggles(state: BoardQueryState): number {
  let count = 0;
  if (state.density === "compact") count += 1;
  if (state.doneCompression) count += 1;
  if (state.includeArchived) count += 1;
  return count;
}

export function TaskBoardFilterBar({
  state,
  visibleCount,
  totalCount,
  groupCount,
  onChange,
  onCollapseAll,
  onExpandAll,
}: TaskBoardFilterBarProps) {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click
  useEffect(() => {
    if (!isMoreOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) {
        setIsMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isMoreOpen]);

  const patch = (partial: Partial<BoardQueryState>) => {
    onChange({ ...state, ...partial });
  };

  const activeToggleCount = countActiveToggles(state);

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      {/* Row 1: search + filters + primary toggles */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          aria-label="Search tasks"
          type="search"
          placeholder="Search title, assignee, tags"
          value={state.query}
          onChange={(event) => patch({ query: event.target.value })}
          className="min-w-[180px] flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none transition focus:border-slate-400"
        />

        <select
          aria-label="Saved view"
          value={state.savedView}
          onChange={(event) => patch({ savedView: event.target.value as BoardQueryState["savedView"] })}
          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
        >
          {BOARD_SAVED_VIEW_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          aria-label="Status filter"
          value={state.status}
          onChange={(event) => patch({ status: event.target.value as BoardStatusFilter })}
          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          aria-label="Priority filter"
          value={state.priority}
          onChange={(event) => patch({ priority: event.target.value as BoardPriorityFilter })}
          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
        >
          {PRIORITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {/* Divider */}
        <div className="mx-0.5 h-6 w-px bg-slate-200" />

        {/* Primary toggles — most used, always visible */}
        <button
          type="button"
          onClick={() => patch({ hideDone: !state.hideDone })}
          className={cn(
            "rounded-full border px-2.5 py-1 text-xs font-semibold transition",
            state.hideDone
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50",
          )}
        >
          Hide Done
        </button>
        <button
          type="button"
          onClick={() => patch({ groupByTaskGroup: !state.groupByTaskGroup })}
          className={cn(
            "rounded-full border px-2.5 py-1 text-xs font-semibold transition",
            state.groupByTaskGroup
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50",
          )}
        >
          Group by Task Group
        </button>

        {/* Collapse / Expand group shortcuts */}
        {onCollapseAll ? (
          <button
            type="button"
            onClick={onCollapseAll}
            className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Collapse All
          </button>
        ) : null}
        {onExpandAll ? (
          <button
            type="button"
            onClick={onExpandAll}
            className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Expand All
          </button>
        ) : null}

        {/* "More" popover for secondary toggles */}
        <div ref={moreRef} className="relative">
          <button
            type="button"
            onClick={() => setIsMoreOpen((prev) => !prev)}
            className={cn(
              "flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition",
              isMoreOpen || activeToggleCount > 0
                ? "border-slate-400 bg-slate-100 text-slate-700"
                : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50",
            )}
          >
            <SlidersHorizontal className="h-3 w-3" />
            More
            {activeToggleCount > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-900 text-[10px] text-white">
                {activeToggleCount}
              </span>
            )}
            <ChevronDown className={cn("h-3 w-3 transition-transform", isMoreOpen && "rotate-180")} />
          </button>

          {isMoreOpen && (
            <div className="absolute right-0 top-full z-20 mt-1.5 w-52 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
              <ToggleOption
                label="Compact Density"
                active={state.density === "compact"}
                onClick={() => patch({ density: state.density === "comfortable" ? "compact" : "comfortable" })}
              />
              <ToggleOption
                label="Compress Done Lane"
                active={state.doneCompression}
                onClick={() => patch({ doneCompression: !state.doneCompression })}
              />
              <ToggleOption
                label="Include Archived"
                active={state.includeArchived}
                onClick={() => patch({ includeArchived: !state.includeArchived })}
              />
            </div>
          )}
        </div>
      </div>

      {/* Row 2: counter */}
      <p className="mt-2 text-xs text-slate-500">
        Showing <span className="font-semibold text-slate-700">{visibleCount}</span> of{" "}
        <span className="font-semibold text-slate-700">{totalCount}</span> tasks across{" "}
        <span className="font-semibold text-slate-700">{groupCount}</span> groups.
      </p>
    </div>
  );
}

/** A single toggle row inside the "More" popover. */
function ToggleOption({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-xs text-slate-700 transition hover:bg-slate-50"
    >
      {label}
      <span
        className={cn(
          "flex h-4 w-8 items-center rounded-full transition-colors",
          active ? "justify-end bg-slate-900" : "justify-start bg-slate-200",
        )}
      >
        <span className={cn(
          "h-3 w-3 rounded-full bg-white shadow-sm transition-transform",
          active ? "mr-0.5" : "ml-0.5",
        )} />
      </span>
    </button>
  );
}

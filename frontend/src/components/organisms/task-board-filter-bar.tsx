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

export function TaskBoardFilterBar({
  state,
  visibleCount,
  totalCount,
  groupCount,
  onChange,
  onCollapseAll,
  onExpandAll,
}: TaskBoardFilterBarProps) {
  const patch = (partial: Partial<BoardQueryState>) => {
    onChange({
      ...state,
      ...partial,
    });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <input
          aria-label="Search tasks"
          type="search"
          placeholder="Search title, assignee, tags"
          value={state.query}
          onChange={(event) => patch({ query: event.target.value })}
          className="min-w-[220px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
        />

        <select
          aria-label="Saved view"
          value={state.savedView}
          onChange={(event) => patch({ savedView: event.target.value as BoardQueryState["savedView"] })}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
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
          onChange={(event) =>
            patch({
              status: event.target.value as BoardStatusFilter,
            })
          }
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
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
          onChange={(event) =>
            patch({
              priority: event.target.value as BoardPriorityFilter,
            })
          }
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          {PRIORITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => patch({ density: state.density === "comfortable" ? "compact" : "comfortable" })}
          className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
        >
          Density: {state.density === "comfortable" ? "Comfortable" : "Compact"}
        </button>
        <button
          type="button"
          onClick={() => patch({ hideDone: !state.hideDone })}
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
            state.hideDone
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50",
          )}
        >
          Hide Done
        </button>
        <button
          type="button"
          onClick={() => patch({ doneCompression: !state.doneCompression })}
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
            state.doneCompression
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50",
          )}
        >
          Compress Done Lane
        </button>
        <button
          type="button"
          onClick={() => patch({ groupByTaskGroup: !state.groupByTaskGroup })}
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
            state.groupByTaskGroup
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50",
          )}
        >
          Group by Task Group
        </button>
        <button
          type="button"
          onClick={() => patch({ includeArchived: !state.includeArchived })}
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
            state.includeArchived
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50",
          )}
        >
          Include Archived
        </button>
        {onCollapseAll ? (
          <button
            type="button"
            onClick={onCollapseAll}
            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Collapse All Groups
          </button>
        ) : null}
        {onExpandAll ? (
          <button
            type="button"
            onClick={onExpandAll}
            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Expand All Groups
          </button>
        ) : null}
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Showing <span className="font-semibold text-slate-700">{visibleCount}</span> of{" "}
        <span className="font-semibold text-slate-700">{totalCount}</span> tasks across{" "}
        <span className="font-semibold text-slate-700">{groupCount}</span> groups.
      </p>
    </div>
  );
}

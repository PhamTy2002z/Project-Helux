export type TaskStatus = "inbox" | "in_progress" | "review" | "done";

export type BoardSavedView = "all" | "focus" | "review" | "blocked";
export type BoardStatusFilter = "all" | TaskStatus;
export type BoardPriorityFilter = "all" | "low" | "medium" | "high";
export type BoardDensity = "comfortable" | "compact";

export type BoardQueryState = {
  query: string;
  savedView: BoardSavedView;
  status: BoardStatusFilter;
  priority: BoardPriorityFilter;
  density: BoardDensity;
  includeArchived: boolean;
  hideDone: boolean;
  doneCompression: boolean;
  groupByTaskGroup: boolean;
};

const QUERY_PARAM_KEY = "bq";
const SAVED_VIEW_PARAM_KEY = "bview";
const STATUS_PARAM_KEY = "bstatus";
const PRIORITY_PARAM_KEY = "bpriority";
const DENSITY_PARAM_KEY = "bdensity";
const INCLUDE_ARCHIVED_PARAM_KEY = "barchived";
const HIDE_DONE_PARAM_KEY = "bhide_done";
const DONE_COMPRESS_PARAM_KEY = "bdone_compress";
const GROUP_BY_PARAM_KEY = "bgroup";

const STATUS_VALUES: readonly BoardStatusFilter[] = [
  "all",
  "inbox",
  "in_progress",
  "review",
  "done",
];
const PRIORITY_VALUES: readonly BoardPriorityFilter[] = [
  "all",
  "low",
  "medium",
  "high",
];
const SAVED_VIEW_VALUES: readonly BoardSavedView[] = [
  "all",
  "focus",
  "review",
  "blocked",
];
const DENSITY_VALUES: readonly BoardDensity[] = ["comfortable", "compact"];

export const BOARD_SAVED_VIEW_OPTIONS: Array<{
  value: BoardSavedView;
  label: string;
}> = [
  { value: "all", label: "All Tasks" },
  { value: "focus", label: "Focus Queue" },
  { value: "review", label: "Review Queue" },
  { value: "blocked", label: "Blocked / Approval" },
];

export const defaultBoardQueryState: BoardQueryState = {
  query: "",
  savedView: "all",
  status: "all",
  priority: "all",
  density: "comfortable",
  includeArchived: false,
  hideDone: false,
  doneCompression: true,
  groupByTaskGroup: true,
};

type SearchParamsLike = {
  get(name: string): string | null;
};

const parseBoolean = (value: string | null, fallback: boolean): boolean => {
  if (value == null) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const parseEnum = <T extends string>(
  value: string | null,
  accepted: readonly T[],
  fallback: T,
): T => {
  if (value == null) return fallback;
  const normalized = value.trim().toLowerCase() as T;
  return accepted.includes(normalized) ? normalized : fallback;
};

export const parseBoardQueryState = (
  searchParams: SearchParamsLike,
): BoardQueryState => {
  const query = (searchParams.get(QUERY_PARAM_KEY) ?? "").trim();

  return {
    query,
    savedView: parseEnum(
      searchParams.get(SAVED_VIEW_PARAM_KEY),
      SAVED_VIEW_VALUES,
      defaultBoardQueryState.savedView,
    ),
    status: parseEnum(
      searchParams.get(STATUS_PARAM_KEY),
      STATUS_VALUES,
      defaultBoardQueryState.status,
    ),
    priority: parseEnum(
      searchParams.get(PRIORITY_PARAM_KEY),
      PRIORITY_VALUES,
      defaultBoardQueryState.priority,
    ),
    density: parseEnum(
      searchParams.get(DENSITY_PARAM_KEY),
      DENSITY_VALUES,
      defaultBoardQueryState.density,
    ),
    includeArchived: parseBoolean(
      searchParams.get(INCLUDE_ARCHIVED_PARAM_KEY),
      defaultBoardQueryState.includeArchived,
    ),
    hideDone: parseBoolean(
      searchParams.get(HIDE_DONE_PARAM_KEY),
      defaultBoardQueryState.hideDone,
    ),
    doneCompression: parseBoolean(
      searchParams.get(DONE_COMPRESS_PARAM_KEY),
      defaultBoardQueryState.doneCompression,
    ),
    groupByTaskGroup: parseBoolean(
      searchParams.get(GROUP_BY_PARAM_KEY),
      defaultBoardQueryState.groupByTaskGroup,
    ),
  };
};

const setOrDeleteParam = (
  params: URLSearchParams,
  key: string,
  value: string | null,
): void => {
  if (value == null || value.length === 0) {
    params.delete(key);
    return;
  }
  params.set(key, value);
};

export const applyBoardQueryStateToSearchParams = (
  current: URLSearchParams,
  state: BoardQueryState,
): URLSearchParams => {
  const next = new URLSearchParams(current.toString());

  setOrDeleteParam(next, QUERY_PARAM_KEY, state.query.trim() || null);
  setOrDeleteParam(
    next,
    SAVED_VIEW_PARAM_KEY,
    state.savedView === defaultBoardQueryState.savedView
      ? null
      : state.savedView,
  );
  setOrDeleteParam(
    next,
    STATUS_PARAM_KEY,
    state.status === defaultBoardQueryState.status ? null : state.status,
  );
  setOrDeleteParam(
    next,
    PRIORITY_PARAM_KEY,
    state.priority === defaultBoardQueryState.priority ? null : state.priority,
  );
  setOrDeleteParam(
    next,
    DENSITY_PARAM_KEY,
    state.density === defaultBoardQueryState.density ? null : state.density,
  );
  setOrDeleteParam(
    next,
    INCLUDE_ARCHIVED_PARAM_KEY,
    state.includeArchived === defaultBoardQueryState.includeArchived
      ? null
      : String(state.includeArchived),
  );
  setOrDeleteParam(
    next,
    HIDE_DONE_PARAM_KEY,
    state.hideDone === defaultBoardQueryState.hideDone
      ? null
      : String(state.hideDone),
  );
  setOrDeleteParam(
    next,
    DONE_COMPRESS_PARAM_KEY,
    state.doneCompression === defaultBoardQueryState.doneCompression
      ? null
      : String(state.doneCompression),
  );
  setOrDeleteParam(
    next,
    GROUP_BY_PARAM_KEY,
    state.groupByTaskGroup === defaultBoardQueryState.groupByTaskGroup
      ? null
      : String(state.groupByTaskGroup),
  );

  return next;
};

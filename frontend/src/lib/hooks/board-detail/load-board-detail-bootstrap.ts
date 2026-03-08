import {
  getBoardGroupSnapshotApiV1BoardsBoardIdGroupSnapshotGet,
  getBoardSnapshotApiV1BoardsBoardIdSnapshotGet,
} from "@/api/generated/boards/boards";
import type { BoardGroupSnapshot, BoardSnapshot } from "@/api/generated/model";

export type BoardDetailBootstrapResult = {
  snapshot: BoardSnapshot | null;
  snapshotError: string | null;
  groupSnapshot: BoardGroupSnapshot | null;
  groupSnapshotError: string | null;
};

const groupSnapshotParams = {
  include_self: false,
  include_done: false,
  per_board_task_limit: 5,
} as const;

const defaultGroupSnapshotError = "Unable to load board group snapshot.";
const defaultBoardSnapshotError = "Unable to load board snapshot.";

export const loadBoardDetailBootstrap = async (
  boardId: string,
): Promise<BoardDetailBootstrapResult> => {
  const [snapshotResult, groupResult] = await Promise.allSettled([
    getBoardSnapshotApiV1BoardsBoardIdSnapshotGet(boardId),
    getBoardGroupSnapshotApiV1BoardsBoardIdGroupSnapshotGet(
      boardId,
      groupSnapshotParams,
    ),
  ]);

  let snapshot: BoardSnapshot | null = null;
  let snapshotError: string | null = null;

  if (snapshotResult.status !== "fulfilled") {
    snapshotError =
      snapshotResult.reason instanceof Error
        ? snapshotResult.reason.message
        : defaultBoardSnapshotError;
  } else if (snapshotResult.value.status !== 200) {
    snapshotError = `${defaultBoardSnapshotError} (status ${snapshotResult.value.status})`;
  } else {
    snapshot = snapshotResult.value.data;
  }

  let groupSnapshot: BoardGroupSnapshot | null = null;
  let groupSnapshotError: string | null = null;

  if (groupResult.status !== "fulfilled") {
    groupSnapshotError =
      groupResult.reason instanceof Error
        ? groupResult.reason.message
        : defaultGroupSnapshotError;
  } else if (groupResult.value.status === 200) {
    groupSnapshot = groupResult.value.data;
  } else {
    groupSnapshotError = `${defaultGroupSnapshotError} (status ${groupResult.value.status})`;
  }

  return {
    snapshot,
    snapshotError,
    groupSnapshot,
    groupSnapshotError,
  };
};

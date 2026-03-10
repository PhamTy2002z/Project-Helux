import { type ReactNode, useMemo, useState } from "react";

import {
  type ColumnDef,
  type OnChangeFn,
  type SortingState,
  type Updater,
  type VisibilityState,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { type AgentRead, type BoardRead } from "@/api/generated/model";
import { DataTable } from "@/components/tables/DataTable";
import {
  dateCell,
  linkifyCell,
  pillCell,
} from "@/components/tables/cell-formatters";
import { truncateText as truncate } from "@/lib/formatters";

type AgentsTableEmptyState = {
  title: string;
  description: string;
  icon?: ReactNode;
  actionHref?: string;
  actionLabel?: string;
};

type AgentsTableProps = {
  agents: AgentRead[];
  boards?: BoardRead[];
  isLoading?: boolean;
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  showActions?: boolean;
  hiddenColumns?: string[];
  columnOrder?: string[];
  disableSorting?: boolean;
  stickyHeader?: boolean;
  emptyMessage?: string;
  emptyState?: AgentsTableEmptyState;
  onDelete?: (agent: AgentRead) => void;
};

const DEFAULT_EMPTY_ICON = (
  <svg
    className="h-16 w-16 text-slate-300"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const TOKEN_NUMBER_FORMATTER = new Intl.NumberFormat("en-US");

const formatTokenCount = (value: number): string =>
  TOKEN_NUMBER_FORMATTER.format(Math.max(Math.trunc(value), 0));

const tokenResetHint = (value: string | null | undefined): string => {
  if (!value) {
    return "Resets at next VN midnight.";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Resets at next VN midnight.";
  }
  return `Resets ${parsed.toLocaleString()}.`;
};

export function AgentsTable({
  agents,
  boards = [],
  isLoading = false,
  sorting,
  onSortingChange,
  showActions = true,
  hiddenColumns,
  columnOrder,
  disableSorting = false,
  stickyHeader = false,
  emptyMessage = "No agents found.",
  emptyState,
  onDelete,
}: AgentsTableProps) {
  const [internalSorting, setInternalSorting] = useState<SortingState>([
    { id: "name", desc: false },
  ]);
  const resolvedSorting = sorting ?? internalSorting;
  const handleSortingChange: OnChangeFn<SortingState> =
    onSortingChange ??
    ((updater: Updater<SortingState>) => {
      setInternalSorting(updater);
    });

  const sortedAgents = useMemo(() => [...agents], [agents]);
  const columnVisibility = useMemo<VisibilityState>(
    () =>
      Object.fromEntries(
        (hiddenColumns ?? []).map((columnId) => [columnId, false]),
      ),
    [hiddenColumns],
  );
  const boardNameById = useMemo(
    () => new Map(boards.map((board) => [board.id, board.name])),
    [boards],
  );

  const columns = useMemo<ColumnDef<AgentRead>[]>(() => {
    const baseColumns: ColumnDef<AgentRead>[] = [
      {
        accessorKey: "name",
        header: "Agent",
        cell: ({ row }) =>
          linkifyCell({
            href: `/agents/${row.original.id}`,
            label: row.original.name,
            subtitle: `ID ${row.original.id}`,
          }),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => pillCell(row.original.status),
      },
      {
        accessorKey: "token_remaining_today",
        header: "Quota left",
        cell: ({ row }) => {
          const agent = row.original;
          const isBlocked = Boolean(agent.token_blocked);

          // Show cost as primary when cost data actually tracked (costUsed > 0)
          const costUsed = agent.cost_used_today;
          const costLimit = agent.cost_limit_today;
          if (
            !agent.is_gateway_main &&
            typeof costUsed === "number" &&
            costUsed > 0 &&
            typeof costLimit === "number" &&
            costLimit > 0
          ) {
            const costRemaining =
              agent.cost_remaining_today ?? Math.max(costLimit - costUsed, 0);
            return (
              <div className="flex min-w-[120px] flex-col gap-1">
                <span className="text-sm text-slate-700">
                  ${costRemaining.toFixed(2)} / ${costLimit.toFixed(2)}
                </span>
                {isBlocked ? (
                  <span
                    className="inline-flex w-fit rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700"
                    title={tokenResetHint(agent.token_reset_at)}
                  >
                    Blocked
                  </span>
                ) : null}
              </div>
            );
          }

          // Fallback to token display
          const used = agent.token_used_today;
          const limit = agent.token_limit_today;
          const remaining = agent.token_remaining_today;
          if (
            agent.is_gateway_main ||
            typeof used !== "number" ||
            typeof limit !== "number" ||
            typeof remaining !== "number"
          ) {
            return <span className="text-sm text-slate-700">—</span>;
          }
          const safeRemaining = Math.max(remaining, 0);
          return (
            <div className="flex min-w-[120px] flex-col gap-1">
              <span className="text-sm text-slate-700">
                {formatTokenCount(safeRemaining)} / {formatTokenCount(limit)}
              </span>
              {isBlocked ? (
                <span
                  className="inline-flex w-fit rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700"
                  title={tokenResetHint(agent.token_reset_at)}
                >
                  Blocked
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "openclaw_session_id",
        header: "Session",
        cell: ({ row }) => (
          <span className="text-sm text-slate-700">
            {truncate(row.original.openclaw_session_id)}
          </span>
        ),
      },
      {
        accessorKey: "board_id",
        header: "Board",
        cell: ({ row }) => {
          const boardId = row.original.board_id;
          if (!boardId) {
            return <span className="text-sm text-slate-700">—</span>;
          }
          const boardName = boardNameById.get(boardId) ?? boardId;
          return linkifyCell({
            href: `/boards/${boardId}`,
            label: boardName,
            block: false,
          });
        },
      },
      {
        accessorKey: "last_seen_at",
        header: "Last seen",
        cell: ({ row }) =>
          dateCell(row.original.last_seen_at, { relative: true }),
      },
      {
        accessorKey: "updated_at",
        header: "Updated",
        cell: ({ row }) => dateCell(row.original.updated_at),
      },
    ];

    return baseColumns;
  }, [boardNameById]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: sortedAgents,
    columns,
    enableSorting: !disableSorting,
    state: {
      ...(!disableSorting ? { sorting: resolvedSorting } : {}),
      ...(columnOrder ? { columnOrder } : {}),
      columnVisibility,
    },
    ...(disableSorting ? {} : { onSortingChange: handleSortingChange }),
    getCoreRowModel: getCoreRowModel(),
    ...(disableSorting ? {} : { getSortedRowModel: getSortedRowModel() }),
  });

  return (
    <DataTable
      table={table}
      isLoading={isLoading}
      emptyMessage={emptyMessage}
      stickyHeader={stickyHeader}
      rowActions={
        showActions
          ? {
              actions: [
                {
                  key: "edit",
                  label: "Edit",
                  href: (agent: AgentRead) =>
                    agent.is_gateway_main ? null : `/agents/${agent.id}/edit`,
                },
                ...(onDelete
                  ? [
                      {
                        key: "delete",
                        label: "Delete",
                        onClick: onDelete,
                        shouldShow: (agent: AgentRead) =>
                          !Boolean(agent.is_gateway_main),
                      },
                    ]
                  : []),
              ],
            }
          : undefined
      }
      rowClassName="hover:bg-slate-50"
      cellClassName="px-6 py-4"
      emptyState={
        emptyState
          ? {
              icon: emptyState.icon ?? DEFAULT_EMPTY_ICON,
              title: emptyState.title,
              description: emptyState.description,
              actionHref: emptyState.actionHref,
              actionLabel: emptyState.actionLabel,
            }
          : undefined
      }
    />
  );
}

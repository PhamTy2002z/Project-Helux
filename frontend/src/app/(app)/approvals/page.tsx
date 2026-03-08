"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useRef } from "react";

import { SignedIn, SignedOut, SignInButton, useAuth } from "@/auth/clerk";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { ApiError } from "@/api/mutator";
import {
  listApprovalsApiV1BoardsBoardIdApprovalsGet,
  streamApprovalsApiV1BoardsBoardIdApprovalsStreamGet,
  updateApprovalApiV1BoardsBoardIdApprovalsApprovalIdPatch,
} from "@/api/generated/approvals/approvals";
import { useListBoardsApiV1BoardsGet } from "@/api/generated/boards/boards";
import type { ApprovalRead, BoardRead } from "@/api/generated/model";
import nextDynamic from "next/dynamic";
import { DashboardSidebar } from "@/components/organisms/DashboardSidebar";
import { DashboardShell } from "@/components/templates/DashboardShell";
import { Button } from "@/components/ui/button";
import { createExponentialBackoff } from "@/lib/backoff";
import { usePageActive } from "@/hooks/usePageActive";
import { visibilityAwareInterval, withQueryPolicy } from "@/lib/query-policy";
import { parseSSEBuffer } from "@/lib/sse-parser";

const BoardApprovalsPanel = nextDynamic(
  () => import("@/components/BoardApprovalsPanel").then((m) => m.BoardApprovalsPanel),
  { ssr: false },
);

type GlobalApprovalsData = {
  approvals: ApprovalRead[];
  warnings: string[];
};

const APPROVAL_STREAM_RECONNECT_BACKOFF = {
  baseMs: 1_000,
  factor: 2,
  jitter: 0.2,
  maxMs: 5 * 60_000,
} as const;

const APPROVAL_STREAM_CONNECT_SPACING_MS = 120;

const approvalTimestampMs = (approval: ApprovalRead): number => {
  const raw = approval.resolved_at ?? approval.created_at;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
};

const sortApprovalsByRecent = (items: ApprovalRead[]): ApprovalRead[] =>
  [...items].sort((left, right) => approvalTimestampMs(right) - approvalTimestampMs(left));

const hasApprovalChanged = (left: ApprovalRead, right: ApprovalRead): boolean =>
  left.status !== right.status ||
  left.resolved_at !== right.resolved_at ||
  left.confidence !== right.confidence ||
  left.agent_id !== right.agent_id ||
  left.created_at !== right.created_at ||
  left.action_type !== right.action_type;

const mergeApproval = (items: ApprovalRead[], incoming: ApprovalRead): ApprovalRead[] => {
  const index = items.findIndex((item) => item.id === incoming.id);
  if (index === -1) {
    return sortApprovalsByRecent([incoming, ...items]);
  }
  const existing = items[index];
  if (!hasApprovalChanged(existing, incoming)) {
    return items;
  }
  const next = [...items];
  next[index] = incoming;
  return sortApprovalsByRecent(next);
};

const latestApprovalSinceForBoard = (boardId: string, approvals: ApprovalRead[]): string | undefined => {
  let latestMs = 0;
  for (const approval of approvals) {
    if (approval.board_id !== boardId) continue;
    const candidateMs = approvalTimestampMs(approval);
    if (candidateMs > latestMs) latestMs = candidateMs;
  }
  return latestMs > 0 ? new Date(latestMs).toISOString() : undefined;
};

function GlobalApprovalsInner() {
  const { isSignedIn } = useAuth();
  const isPageActive = usePageActive();
  const queryClient = useQueryClient();

  const boardsQuery = useListBoardsApiV1BoardsGet(undefined, {
    query: {
      ...withQueryPolicy("interactive"),
      enabled: Boolean(isSignedIn),
      refetchInterval: visibilityAwareInterval(120_000, isPageActive),
      retry: false,
    },
  });

  const boards = useMemo(() => {
    if (boardsQuery.data?.status !== 200) return [];
    return boardsQuery.data.data.items ?? [];
  }, [boardsQuery.data]);

  const boardLabelById = useMemo(() => {
    const entries = boards.map((board: BoardRead) => [board.id, board.name]);
    return Object.fromEntries(entries) as Record<string, string>;
  }, [boards]);

  const boardIds = useMemo(
    () => boards.map((board) => board.id).sort((left, right) => left.localeCompare(right)),
    [boards],
  );

  const boardIdsKey = useMemo(() => boardIds.join(","), [boardIds]);

  const approvalsKey = useMemo(
    () => ["approvals", "global", boardIdsKey] as const,
    [boardIdsKey],
  );

  const approvalsQuery = useQuery<GlobalApprovalsData, ApiError>({
    queryKey: approvalsKey,
    enabled: Boolean(isSignedIn && boardIds.length > 0),
    ...withQueryPolicy("interactive", {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    }),
    refetchInterval: visibilityAwareInterval(90_000, isPageActive),
    queryFn: async ({ signal }) => {
      const results = await Promise.allSettled(
        boards.map(async (board) => {
          const response = await listApprovalsApiV1BoardsBoardIdApprovalsGet(
            board.id,
            { limit: 200 },
            { signal },
          );
          if (response.status !== 200) {
            throw new Error(
              `Failed to load approvals for ${board.name} (status ${response.status}).`,
            );
          }
          return { approvals: response.data.items ?? [] };
        }),
      );

      const approvals: ApprovalRead[] = [];
      const warnings: string[] = [];

      for (const result of results) {
        if (result.status === "fulfilled") {
          approvals.push(...result.value.approvals);
        } else {
          warnings.push(result.reason?.message ?? "Unable to load approvals.");
        }
      }

      return { approvals: sortApprovalsByRecent(approvals), warnings };
    },
  });

  const updateApprovalMutation = useMutation<
    Awaited<
      ReturnType<typeof updateApprovalApiV1BoardsBoardIdApprovalsApprovalIdPatch>
    >,
    ApiError,
    { boardId: string; approvalId: string; status: "approved" | "rejected" }
  >({
    mutationFn: ({ boardId, approvalId, status }) =>
      updateApprovalApiV1BoardsBoardIdApprovalsApprovalIdPatch(
        boardId,
        approvalId,
        { status },
      ),
  });

  const approvals = useMemo(
    () => approvalsQuery.data?.approvals ?? [],
    [approvalsQuery.data],
  );
  const approvalsRef = useRef<ApprovalRead[]>([]);
  useEffect(() => {
    approvalsRef.current = approvals;
  }, [approvals]);

  const warnings = useMemo(
    () => approvalsQuery.data?.warnings ?? [],
    [approvalsQuery.data],
  );
  const errorText = approvalsQuery.error?.message ?? null;

  useEffect(() => {
    if (!isPageActive || !isSignedIn || boardIds.length === 0) return;

    let cancelled = false;
    const cleanups: Array<() => void> = [];

    for (const [index, boardId] of boardIds.entries()) {
      const boardDelay = index * APPROVAL_STREAM_CONNECT_SPACING_MS;
      const abortController = new AbortController();
      const backoff = createExponentialBackoff(APPROVAL_STREAM_RECONNECT_BACKOFF);
      let reconnectTimeout: number | undefined;
      let connectTimeout: number | undefined;

      const connect = async () => {
        try {
          const since = latestApprovalSinceForBoard(boardId, approvalsRef.current);
          const streamResult = await streamApprovalsApiV1BoardsBoardIdApprovalsStreamGet(
            boardId,
            since ? { since } : undefined,
            {
              headers: { Accept: "text/event-stream" },
              signal: abortController.signal,
            },
          );

          if (streamResult.status !== 200) {
            throw new Error("Unable to connect approvals stream.");
          }

          const response = streamResult.data as Response;
          if (!(response instanceof Response) || !response.body) {
            throw new Error("Unable to connect approvals stream.");
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (!cancelled) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value && value.length) {
              backoff.reset();
            }

            buffer += decoder.decode(value, { stream: true });
            const parsed = parseSSEBuffer(buffer);
            buffer = parsed.remaining;

            for (const event of parsed.events) {
              if (event.eventType !== "approval" || !event.data) continue;
              try {
                const payload = JSON.parse(event.data) as { approval?: ApprovalRead };
                if (!payload.approval) continue;
                queryClient.setQueryData<GlobalApprovalsData>(approvalsKey, (previous) => {
                  const base = previous ?? { approvals: [], warnings: [] };
                  const mergedApprovals = mergeApproval(base.approvals, payload.approval as ApprovalRead);
                  if (mergedApprovals === base.approvals) return base;
                  return {
                    ...base,
                    approvals: mergedApprovals,
                  };
                });
              } catch {
                // Ignore malformed payloads.
              }
            }
          }
        } catch {
          // Reconnect below.
        }

        if (!cancelled) {
          if (reconnectTimeout !== undefined) {
            window.clearTimeout(reconnectTimeout);
          }
          const delay = backoff.nextDelayMs();
          reconnectTimeout = window.setTimeout(() => {
            reconnectTimeout = undefined;
            void connect();
          }, delay);
        }
      };

      connectTimeout = window.setTimeout(() => {
        connectTimeout = undefined;
        void connect();
      }, boardDelay);

      cleanups.push(() => {
        abortController.abort();
        if (connectTimeout !== undefined) {
          window.clearTimeout(connectTimeout);
        }
        if (reconnectTimeout !== undefined) {
          window.clearTimeout(reconnectTimeout);
        }
      });
    }

    return () => {
      cancelled = true;
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [approvalsKey, boardIds, isPageActive, isSignedIn, queryClient]);

  const handleDecision = useCallback(
    (approvalId: string, status: "approved" | "rejected") => {
      const approval = approvals.find((item) => item.id === approvalId);
      const boardId = approval?.board_id;
      if (!boardId) return;

      updateApprovalMutation.mutate(
        { boardId, approvalId, status },
        {
          onSuccess: (result) => {
            if (result.status !== 200) return;
            queryClient.setQueryData<GlobalApprovalsData>(
              approvalsKey,
              (previous) => {
                if (!previous) return previous;
                const merged = mergeApproval(previous.approvals, result.data);
                if (merged === previous.approvals) return previous;
                return {
                  ...previous,
                  approvals: merged,
                };
              },
            );
          },
          onError: () => {
            queryClient.invalidateQueries({ queryKey: approvalsKey });
          },
        },
      );
    },
    [approvals, approvalsKey, queryClient, updateApprovalMutation],
  );

  const combinedError = useMemo(() => {
    const parts: string[] = [];
    if (errorText) parts.push(errorText);
    if (warnings.length > 0) parts.push(warnings.join(" "));
    return parts.length > 0 ? parts.join(" ") : null;
  }, [errorText, warnings]);

  return (
    <main className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="p-6">
        <div className="h-[calc(100vh-160px)] min-h-[520px]">
          <BoardApprovalsPanel
            boardId="global"
            approvals={approvals}
            isLoading={boardsQuery.isLoading || approvalsQuery.isLoading}
            error={combinedError}
            onDecision={handleDecision}
            scrollable
            boardLabelById={boardLabelById}
          />
        </div>
      </div>
    </main>
  );
}

export default function GlobalApprovalsPage() {
  return (
    <DashboardShell>
      <SignedOut>
        <div className="flex h-full flex-col items-center justify-center gap-4 rounded-2xl surface-panel p-10 text-center">
          <p className="text-sm text-muted">Sign in to view approvals.</p>
          <SignInButton
            mode="modal"
            forceRedirectUrl="/approvals"
            signUpForceRedirectUrl="/approvals"
          >
            <Button>Sign in</Button>
          </SignInButton>
        </div>
      </SignedOut>
      <SignedIn>
        <DashboardSidebar />
        <GlobalApprovalsInner />
      </SignedIn>
    </DashboardShell>
  );
}

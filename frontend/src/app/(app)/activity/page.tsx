"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { SignedIn, SignedOut, useAuth } from "@/auth/clerk";
import { Activity as ActivityIcon } from "lucide-react";

import { ApiError } from "@/api/mutator";
import { streamAgentsApiV1AgentsStreamGet } from "@/api/generated/agents/agents";
import { listActivityApiV1ActivityGet } from "@/api/generated/activity/activity";
import {
  getBoardSnapshotApiV1BoardsBoardIdSnapshotGet,
  listBoardsApiV1BoardsGet,
} from "@/api/generated/boards/boards";
import { streamBoardMemoryApiV1BoardsBoardIdMemoryStreamGet } from "@/api/generated/board-memory/board-memory";
import { streamApprovalsApiV1BoardsBoardIdApprovalsStreamGet } from "@/api/generated/approvals/approvals";
import { streamTasksApiV1BoardsBoardIdTasksStreamGet } from "@/api/generated/tasks/tasks";
import {
  type getMyMembershipApiV1OrganizationsMeMemberGetResponse,
  useGetMyMembershipApiV1OrganizationsMeMemberGet,
} from "@/api/generated/organizations/organizations";
import type {
  ActivityEventRead,
  AgentRead,
  ApprovalRead,
  BoardMemoryRead,
  BoardRead,
  TaskCommentRead,
  TaskRead,
} from "@/api/generated/model";
import { LazyMarkdown } from "@/components/atoms/LazyMarkdown";
import { ActivityFeed } from "@/components/activity/ActivityFeed";
import { SignedOutPanel } from "@/components/auth/SignedOutPanel";
import { DashboardSidebar } from "@/components/organisms/DashboardSidebar";
import { DashboardShell } from "@/components/templates/DashboardShell";
import { createExponentialBackoff } from "@/lib/backoff";
import {
  DEFAULT_HUMAN_LABEL,
  resolveHumanActorName,
  resolveMemberDisplayName,
} from "@/lib/display-name";
import { apiDatetimeToMs, parseApiDatetime } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { usePageActive } from "@/hooks/usePageActive";
import { withQueryPolicy } from "@/lib/query-policy";

const SSE_RECONNECT_BACKOFF = {
  baseMs: 1_000,
  factor: 2,
  jitter: 0.2,
  maxMs: 5 * 60_000,
} as const;

const STREAM_CONNECT_SPACING_MS = 120;
const MAX_FEED_ITEMS = 300;
const PAGED_LIMIT = 200;
const PAGED_MAX = 1000;

type Agent = AgentRead & { status: string };

type TaskEventType =
  | "task.comment"
  | "task.created"
  | "task.updated"
  | "task.status_changed";

type FeedEventType =
  | TaskEventType
  | "board.chat"
  | "board.command"
  | "agent.created"
  | "agent.online"
  | "agent.offline"
  | "agent.updated"
  | "approval.created"
  | "approval.updated"
  | "approval.approved"
  | "approval.rejected";

type FeedItem = {
  id: string;
  created_at: string;
  event_type: FeedEventType;
  message: string | null;
  source_event_id: string | null;
  agent_id: string | null;
  actor_name: string;
  actor_role: string | null;
  board_id: string | null;
  board_name: string | null;
  board_href: string | null;
  task_id: string | null;
  task_title: string | null;
  title: string;
  context_href: string | null;
};

type TaskMeta = {
  title: string;
  boardId: string | null;
};

type ActivityRouteParams = Record<string, string>;

const ACTIVITY_FEED_PATH = "/activity";

const TASK_EVENT_TYPES = new Set<TaskEventType>([
  "task.comment",
  "task.created",
  "task.updated",
  "task.status_changed",
]);

const isTaskEventType = (value: string): value is TaskEventType =>
  TASK_EVENT_TYPES.has(value as TaskEventType);

const isAbortLikeError = (error: unknown): boolean => {
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }
  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return true;
    }
    return error.message.toLowerCase().includes("signal is aborted");
  }
  return false;
};

const formatShortTimestamp = (value: string) => {
  const date = parseApiDatetime(value);
  if (!date) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const normalizeRouteParams = (
  params: ActivityEventRead["route_params"] | ActivityRouteParams | null | undefined,
): ActivityRouteParams => {
  if (!params || typeof params !== "object") return {};
  return Object.entries(params).reduce<ActivityRouteParams>((acc, [key, value]) => {
    if (typeof value === "string" && value.length > 0) {
      acc[key] = value;
    }
    return acc;
  }, {});
};

const buildRouteHref = (
  routeName: string | null | undefined,
  routeParams: ActivityRouteParams,
  fallback: {
    eventId: string;
    eventType: string;
    createdAt: string;
    taskId: string | null;
  },
): string => {
  if (routeName === "board.approvals") {
    const boardId = routeParams.boardId;
    if (boardId) {
      return `/boards/${encodeURIComponent(boardId)}/approvals`;
    }
  }

  if (routeName === "board") {
    const boardId = routeParams.boardId;
    if (boardId) {
      const params = new URLSearchParams();
      Object.entries(routeParams).forEach(([key, value]) => {
        if (key !== "boardId") params.set(key, value);
      });
      const query = params.toString();
      return query
        ? `/boards/${encodeURIComponent(boardId)}?${query}`
        : `/boards/${encodeURIComponent(boardId)}`;
    }
  }

  const params = new URLSearchParams(
    Object.keys(routeParams).length > 0
      ? routeParams
      : {
          eventId: fallback.eventId,
          eventType: fallback.eventType,
          createdAt: fallback.createdAt,
        },
  );
  if (fallback.taskId && !params.has("taskId")) {
    params.set("taskId", fallback.taskId);
  }
  return `${ACTIVITY_FEED_PATH}?${params.toString()}`;
};

const buildBoardHref = (
  routeParams: ActivityRouteParams,
  boardId: string | null,
): string | null => {
  const resolved = routeParams.boardId ?? boardId;
  if (!resolved) return null;
  return `/boards/${encodeURIComponent(resolved)}`;
};

const feedItemElementId = (id: string): string =>
  `activity-item-${id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;

const normalizeAgent = (agent: AgentRead): Agent => ({
  ...agent,
  status: (agent.status ?? "offline").trim() || "offline",
});

const normalizeStatus = (value?: string | null) =>
  (value ?? "").trim().toLowerCase() || "offline";

const humanizeApprovalAction = (value: string): string => {
  const cleaned = value.replace(/[._-]+/g, " ").trim();
  if (!cleaned) return "Approval";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
};

const humanizeStatus = (value: string): string =>
  value.replace(/_/g, " ").trim() || "offline";

const roleFromAgent = (agent?: Agent | null): string | null => {
  if (!agent) return null;
  const profile = agent.identity_profile;
  if (!profile || typeof profile !== "object") return null;
  const role = profile.role;
  if (typeof role !== "string") return null;
  const trimmed = role.trim();
  return trimmed || null;
};

const eventLabel = (eventType: FeedEventType): string => {
  if (eventType === "task.comment") return "Comment";
  if (eventType === "task.created") return "Created";
  if (eventType === "task.status_changed") return "Status";
  if (eventType === "board.chat") return "Chat";
  if (eventType === "board.command") return "Command";
  if (eventType === "agent.created") return "Agent";
  if (eventType === "agent.online") return "Online";
  if (eventType === "agent.offline") return "Offline";
  if (eventType === "agent.updated") return "Agent update";
  if (eventType === "approval.created") return "Approval";
  if (eventType === "approval.updated") return "Approval update";
  if (eventType === "approval.approved") return "Approved";
  if (eventType === "approval.rejected") return "Rejected";
  return "Updated";
};

const eventPillClass = (eventType: FeedEventType): string => {
  if (eventType === "task.comment") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }
  if (eventType === "task.created") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (eventType === "task.status_changed") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (eventType === "board.chat") {
    return "border-teal-200 bg-teal-50 text-teal-700";
  }
  if (eventType === "board.command") {
    return "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700";
  }
  if (eventType === "agent.created") {
    return "border-violet-200 bg-violet-50 text-violet-700";
  }
  if (eventType === "agent.online") {
    return "border-lime-200 bg-lime-50 text-lime-700";
  }
  if (eventType === "agent.offline") {
    return "status-neutral";
  }
  if (eventType === "agent.updated") {
    return "border-indigo-200 bg-indigo-50 text-indigo-700";
  }
  if (eventType === "approval.created") {
    return "border-cyan-200 bg-cyan-50 text-cyan-700";
  }
  if (eventType === "approval.updated") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }
  if (eventType === "approval.approved") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (eventType === "approval.rejected") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  return "status-neutral";
};

const FeedCard = memo(function FeedCard({
  item,
  isHighlighted = false,
}: {
  item: FeedItem;
  isHighlighted?: boolean;
}) {
  const message = (item.message ?? "").trim();
  const authorAvatar = (item.actor_name[0] ?? "A").toUpperCase();

  return (
    <div
      id={feedItemElementId(item.id)}
      className={cn(
        "scroll-mt-28 rounded-xl border bg-[color:var(--surface)] p-4 transition",
        isHighlighted
          ? "border-blue-300 ring-2 ring-blue-200"
          : "border-[color:var(--border)] hover:border-[color:var(--border-strong)]",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[color:var(--surface-muted)] text-xs font-semibold text-[color:var(--text)]">
          {authorAvatar}
        </div>
        <div className="min-w-0 flex-1">
          <div className="min-w-0">
            {item.context_href ? (
              <Link
                href={item.context_href}
                className="block text-sm font-semibold leading-snug text-strong transition hover:text-strong hover:underline"
                title={item.title}
                style={{
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {item.title}
              </Link>
            ) : (
              <p className="text-sm font-semibold leading-snug text-strong">
                {item.title}
              </p>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                  eventPillClass(item.event_type),
                )}
              >
                {eventLabel(item.event_type)}
              </span>
              {item.board_href && item.board_name ? (
                <Link
                  href={item.board_href}
                  className="font-semibold text-[color:var(--text)] hover:text-strong hover:underline"
                >
                  {item.board_name}
                </Link>
              ) : item.board_name ? (
                <span className="font-semibold text-[color:var(--text)]">
                  {item.board_name}
                </span>
              ) : null}
              {item.board_name ? (
                <span className="text-quiet">·</span>
              ) : null}
              <span className="font-medium text-[color:var(--text)]">
                {item.actor_name}
              </span>
              {item.actor_role ? (
                <>
                  <span className="text-quiet">·</span>
                  <span className="text-muted">{item.actor_role}</span>
                </>
              ) : null}
              <span className="text-quiet">·</span>
              <span className="text-quiet">
                {formatShortTimestamp(item.created_at)}
              </span>
            </div>
          </div>
        </div>
      </div>
      {message ? (
        <div className="mt-3 select-text cursor-text text-sm leading-relaxed text-strong break-words">
          <LazyMarkdown content={message} variant="basic" />
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">—</p>
      )}
    </div>
  );
});

FeedCard.displayName = "FeedCard";

export default function ActivityPage() {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const { isSignedIn } = useAuth();
  const searchParams = useSearchParams();
  const isPageActive = usePageActive();
  const selectedEventId = useMemo(() => {
    const value = searchParams.get("eventId");
    if (!value) return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, [searchParams]);
  const [highlightedFeedItemId, setHighlightedFeedItemId] = useState<string | null>(null);

  const membershipQuery = useGetMyMembershipApiV1OrganizationsMeMemberGet<
    getMyMembershipApiV1OrganizationsMeMemberGetResponse,
    ApiError
  >({
    query: {
      ...withQueryPolicy("interactive"),
      enabled: Boolean(isSignedIn),
      refetchOnWindowFocus: false,
      retry: false,
    },
  });
  const isOrgAdmin = useMemo(() => {
    const member =
      membershipQuery.data?.status === 200 ? membershipQuery.data.data : null;
    return member ? ["owner", "admin"].includes(member.role) : false;
  }, [membershipQuery.data]);
  const currentUserDisplayName = useMemo(() => {
    const member =
      membershipQuery.data?.status === 200 ? membershipQuery.data.data : null;
    return resolveMemberDisplayName(member, DEFAULT_HUMAN_LABEL);
  }, [membershipQuery.data]);

  const [isFeedLoading, setIsFeedLoading] = useState(false);
  const [isFeedEnriching, setIsFeedEnriching] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [boards, setBoards] = useState<BoardRead[]>([]);

  const feedItemsRef = useRef<FeedItem[]>([]);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const boardsByIdRef = useRef<Map<string, BoardRead>>(new Map());
  const taskMetaByIdRef = useRef<Map<string, TaskMeta>>(new Map());
  const agentsByIdRef = useRef<Map<string, Agent>>(new Map());
  const approvalsByIdRef = useRef<Map<string, ApprovalRead>>(new Map());

  useEffect(() => {
    feedItemsRef.current = feedItems;
  }, [feedItems]);

  const boardIds = useMemo(() => boards.map((board) => board.id), [boards]);

  const pushFeedItem = useCallback((item: FeedItem) => {
    setFeedItems((prev) => {
      if (seenIdsRef.current.has(item.id)) return prev;
      seenIdsRef.current.add(item.id);
      const next = [item, ...prev];
      return next.slice(0, MAX_FEED_ITEMS);
    });
  }, []);

  const mergeFeedItems = useCallback((items: FeedItem[]) => {
    if (items.length === 0) return;
    setFeedItems((prev) => {
      const next = [...prev];
      let changed = false;
      for (let index = items.length - 1; index >= 0; index -= 1) {
        const item = items[index];
        if (seenIdsRef.current.has(item.id)) continue;
        seenIdsRef.current.add(item.id);
        next.unshift(item);
        changed = true;
      }
      return changed ? next.slice(0, MAX_FEED_ITEMS) : prev;
    });
  }, []);

  const resolveAuthor = useCallback(
    (
      agentId: string | null | undefined,
      fallbackName: string = currentUserDisplayName,
    ) => {
      if (agentId) {
        const agent = agentsByIdRef.current.get(agentId);
        if (agent) {
          return {
            id: agent.id,
            name: agent.name,
            role: roleFromAgent(agent),
          };
        }
      }
      return {
        id: agentId ?? null,
        name: fallbackName,
        role: null,
      };
    },
    [currentUserDisplayName],
  );

  const boardNameForId = useCallback((boardId: string | null | undefined) => {
    if (!boardId) return null;
    return boardsByIdRef.current.get(boardId)?.name ?? null;
  }, []);

  const updateTaskMeta = useCallback(
    (
      task: { id: string; title: string; board_id?: string | null },
      fallbackBoardId: string,
    ) => {
      const boardId = task.board_id ?? fallbackBoardId;
      taskMetaByIdRef.current.set(task.id, {
        title: task.title,
        boardId,
      });
    },
    [],
  );

  const mapTaskActivity = useCallback(
    (
      event: ActivityEventRead,
      fallbackBoardId: string | null = null,
    ): FeedItem | null => {
      if (!isTaskEventType(event.event_type)) return null;
      const meta = event.task_id
        ? taskMetaByIdRef.current.get(event.task_id)
        : null;
      const routeName = event.route_name ?? null;
      const routeParams = normalizeRouteParams(event.route_params);
      const taskId = event.task_id ?? routeParams.taskId ?? null;
      const boardId =
        meta?.boardId ??
        event.board_id ??
        routeParams.boardId ??
        fallbackBoardId ??
        null;
      const fallbackRouteParams: ActivityRouteParams = {};
      if (boardId) fallbackRouteParams.boardId = boardId;
      if (taskId) fallbackRouteParams.taskId = taskId;
      const effectiveRouteParams =
        Object.keys(routeParams).length > 0 ? routeParams : fallbackRouteParams;
      const effectiveRouteName =
        routeName ?? (boardId ? "board" : "activity");
      const author = resolveAuthor(event.agent_id, currentUserDisplayName);
      return {
        id: `activity:${event.id}`,
        created_at: event.created_at,
        event_type: event.event_type,
        message: event.message ?? null,
        source_event_id: event.id,
        agent_id: author.id,
        actor_name: author.name,
        actor_role: author.role,
        board_id: boardId,
        board_name: boardNameForId(boardId),
        board_href: buildBoardHref(effectiveRouteParams, boardId),
        task_id: taskId,
        task_title: meta?.title ?? null,
        title:
          meta?.title ?? (taskId ? "Unknown task" : "Task activity"),
        context_href: buildRouteHref(effectiveRouteName, effectiveRouteParams, {
          eventId: event.id,
          eventType: event.event_type,
          createdAt: event.created_at,
          taskId,
        }),
      };
    },
    [boardNameForId, currentUserDisplayName, resolveAuthor],
  );

  const mapTaskComment = useCallback(
    (comment: TaskCommentRead, fallbackBoardId: string): FeedItem => {
      const meta = comment.task_id
        ? taskMetaByIdRef.current.get(comment.task_id)
        : null;
      const boardId = meta?.boardId ?? fallbackBoardId;
      const taskId = comment.task_id ?? null;
      const routeParams: ActivityRouteParams = {};
      if (boardId) routeParams.boardId = boardId;
      if (taskId) routeParams.taskId = taskId;
      routeParams.commentId = comment.id;
      const author = resolveAuthor(comment.agent_id, currentUserDisplayName);
      return {
        id: `comment:${comment.id}`,
        created_at: comment.created_at,
        event_type: "task.comment",
        message: comment.message ?? null,
        source_event_id: null,
        agent_id: author.id,
        actor_name: author.name,
        actor_role: author.role,
        board_id: boardId,
        board_name: boardNameForId(boardId),
        board_href: buildBoardHref(routeParams, boardId),
        task_id: taskId,
        task_title: meta?.title ?? null,
        title:
          meta?.title ?? (taskId ? "Unknown task" : "Task activity"),
        context_href: buildRouteHref("board", routeParams, {
          eventId: comment.id,
          eventType: "task.comment",
          createdAt: comment.created_at,
          taskId,
        }),
      };
    },
    [boardNameForId, currentUserDisplayName, resolveAuthor],
  );

  const mapApprovalEvent = useCallback(
    (
      approval: ApprovalRead,
      boardId: string,
      previous: ApprovalRead | null = null,
    ): FeedItem => {
      const nextStatus = approval.status ?? "pending";
      const previousStatus = previous?.status ?? null;
      const kind: FeedEventType =
        previousStatus === null
          ? nextStatus === "approved"
            ? "approval.approved"
            : nextStatus === "rejected"
              ? "approval.rejected"
              : "approval.created"
          : nextStatus !== previousStatus
            ? nextStatus === "approved"
              ? "approval.approved"
              : nextStatus === "rejected"
                ? "approval.rejected"
                : "approval.updated"
            : "approval.updated";

      const stamp =
        kind === "approval.created"
          ? approval.created_at
          : (approval.resolved_at ?? approval.created_at);
      const action = humanizeApprovalAction(approval.action_type);
      const author = resolveAuthor(approval.agent_id, currentUserDisplayName);
      const statusText =
        nextStatus === "approved"
          ? "approved"
          : nextStatus === "rejected"
            ? "rejected"
            : "pending";
      const message =
        kind === "approval.created"
          ? `${action} requested (${approval.confidence}% confidence).`
          : kind === "approval.approved"
            ? `${action} approved (${approval.confidence}% confidence).`
            : kind === "approval.rejected"
              ? `${action} rejected (${approval.confidence}% confidence).`
              : `${action} updated (${statusText}, ${approval.confidence}% confidence).`;

      const taskMeta = approval.task_id
        ? taskMetaByIdRef.current.get(approval.task_id)
        : null;
      const routeParams: ActivityRouteParams = { boardId };
      const taskId = approval.task_id ?? null;

      return {
        id: `approval:${approval.id}:${kind}:${stamp}`,
        created_at: stamp,
        event_type: kind,
        message,
        source_event_id: null,
        agent_id: author.id,
        actor_name: author.name,
        actor_role: author.role,
        board_id: boardId,
        board_name: boardNameForId(boardId),
        board_href: buildBoardHref(routeParams, boardId),
        task_id: taskId,
        task_title: taskMeta?.title ?? null,
        title: `Approval · ${action}`,
        context_href: buildRouteHref("board.approvals", routeParams, {
          eventId: approval.id,
          eventType: kind,
          createdAt: stamp,
          taskId,
        }),
      };
    },
    [boardNameForId, currentUserDisplayName, resolveAuthor],
  );

  const mapBoardChat = useCallback(
    (memory: BoardMemoryRead, boardId: string): FeedItem => {
      const content = (memory.content ?? "").trim();
      const actorName = resolveHumanActorName(
        memory.source,
        currentUserDisplayName,
      );
      const command = content.startsWith("/");
      const routeParams: ActivityRouteParams = { boardId, panel: "chat" };
      return {
        id: `chat:${memory.id}`,
        created_at: memory.created_at,
        event_type: command ? "board.command" : "board.chat",
        message: content || null,
        source_event_id: null,
        agent_id: null,
        actor_name: actorName,
        actor_role: null,
        board_id: boardId,
        board_name: boardNameForId(boardId),
        board_href: buildBoardHref(routeParams, boardId),
        task_id: null,
        task_title: null,
        title: command ? "Board command" : "Board chat",
        context_href: buildRouteHref("board", routeParams, {
          eventId: memory.id,
          eventType: command ? "board.command" : "board.chat",
          createdAt: memory.created_at,
          taskId: null,
        }),
      };
    },
    [boardNameForId, currentUserDisplayName],
  );

  const mapAgentEvent = useCallback(
    (
      agent: Agent,
      previous: Agent | null,
      isSnapshot = false,
    ): FeedItem | null => {
      const nextStatus = normalizeStatus(agent.status);
      const previousStatus = previous ? normalizeStatus(previous.status) : null;
      const statusChanged =
        previousStatus !== null && nextStatus !== previousStatus;
      const profileChanged =
        Boolean(previous) &&
        (previous?.name !== agent.name ||
          previous?.is_board_lead !== agent.is_board_lead ||
          JSON.stringify(previous?.identity_profile ?? {}) !==
            JSON.stringify(agent.identity_profile ?? {}));

      let kind: FeedEventType;
      if (isSnapshot) {
        kind =
          nextStatus === "online"
            ? "agent.online"
            : nextStatus === "offline"
              ? "agent.offline"
              : "agent.updated";
      } else if (!previous) {
        kind = "agent.created";
      } else if (statusChanged && nextStatus === "online") {
        kind = "agent.online";
      } else if (statusChanged && nextStatus === "offline") {
        kind = "agent.offline";
      } else if (statusChanged || profileChanged) {
        kind = "agent.updated";
      } else {
        return null;
      }

      const stamp = agent.last_seen_at ?? agent.updated_at ?? agent.created_at;
      const message =
        kind === "agent.created"
          ? `${agent.name} joined this board.`
          : kind === "agent.online"
            ? `${agent.name} is online.`
            : kind === "agent.offline"
              ? `${agent.name} is offline.`
              : `${agent.name} updated (${humanizeStatus(nextStatus)}).`;
      const boardId = agent.board_id ?? null;
      const routeParams: ActivityRouteParams = boardId
        ? { boardId }
        : {};

      return {
        id: `agent:${agent.id}:${isSnapshot ? "snapshot" : kind}:${stamp}`,
        created_at: stamp,
        event_type: kind,
        message,
        source_event_id: null,
        agent_id: agent.id,
        actor_name: agent.name,
        actor_role: roleFromAgent(agent),
        board_id: boardId,
        board_name: boardNameForId(boardId),
        board_href: buildBoardHref(routeParams, boardId),
        task_id: null,
        task_title: null,
        title: `Agent · ${agent.name}`,
        context_href:
          boardId === null
            ? null
            : buildRouteHref("board", routeParams, {
                eventId: agent.id,
                eventType: kind,
                createdAt: stamp,
                taskId: null,
              }),
      };
    },
    [boardNameForId],
  );

  const latestTimestamp = useCallback(
    (predicate: (item: FeedItem) => boolean): string | null => {
      let latest = 0;
      for (const item of feedItemsRef.current) {
        if (!predicate(item)) continue;
        const time = apiDatetimeToMs(item.created_at) ?? 0;
        if (time > latest) latest = time;
      }
      return latest ? new Date(latest).toISOString() : null;
    },
    [],
  );

  useEffect(() => {
    if (!isSignedIn) {
      setBoards([]);
      setFeedItems([]);
      setFeedError(null);
      setIsFeedLoading(false);
      setIsFeedEnriching(false);
      seenIdsRef.current = new Set();
      boardsByIdRef.current = new Map();
      taskMetaByIdRef.current = new Map();
      agentsByIdRef.current = new Map();
      approvalsByIdRef.current = new Map();
      return;
    }

    let cancelled = false;
    const abortController = new AbortController();
    setIsFeedLoading(true);
    setIsFeedEnriching(true);
    setFeedError(null);

    const mergeBoards = (incomingBoards: BoardRead[]) => {
      if (incomingBoards.length === 0) return;
      for (const board of incomingBoards) {
        boardsByIdRef.current.set(board.id, board);
      }
      setBoards((previous) => {
        const merged = new Map(previous.map((board) => [board.id, board]));
        for (const board of incomingBoards) {
          merged.set(board.id, board);
        }
        return [...merged.values()].sort((left, right) =>
          left.name.localeCompare(right.name),
        );
      });
    };

    const seedFromSnapshot = (board: BoardRead, batch: FeedItem[]) => {
      return (snapshot: Awaited<
        ReturnType<typeof getBoardSnapshotApiV1BoardsBoardIdSnapshotGet>
      >) => {
        if (snapshot.status !== 200) return;
        const data = snapshot.data;

        for (const task of data.tasks ?? []) {
          taskMetaByIdRef.current.set(task.id, {
            title: task.title,
            boardId: board.id,
          });
        }

        for (const agent of data.agents ?? []) {
          const normalized = normalizeAgent(agent);
          agentsByIdRef.current.set(normalized.id, normalized);
          const item = mapAgentEvent(normalized, null, true);
          if (item) batch.push(item);
        }

        for (const approval of data.approvals ?? []) {
          approvalsByIdRef.current.set(approval.id, approval);
          batch.push(mapApprovalEvent(approval, board.id, null));
        }

        for (const memory of data.chat_messages ?? []) {
          batch.push(mapBoardChat(memory, board.id));
        }
      };
    };

    const loadProgressive = async () => {
      const signal = abortController.signal;

      let stageABoards: BoardRead[] = [];
      try {
        const [boardsResult, activityResult] = await Promise.all([
          listBoardsApiV1BoardsGet(
            {
              limit: PAGED_LIMIT,
              offset: 0,
            },
            { signal },
          ),
          listActivityApiV1ActivityGet(
            {
              limit: PAGED_LIMIT,
              offset: 0,
            },
            { signal },
          ),
        ]);

        if (cancelled) return;
        if (boardsResult.status !== 200) {
          throw new Error("Unable to load boards.");
        }
        if (activityResult.status !== 200) {
          throw new Error("Unable to load activity feed.");
        }

        stageABoards = boardsResult.data.items ?? [];
        mergeBoards(stageABoards);

        const firstWindow = (activityResult.data.items ?? [])
          .map((event) => mapTaskActivity(event))
          .filter((item): item is FeedItem => item !== null)
          .sort((left, right) => {
            const leftTime = apiDatetimeToMs(left.created_at) ?? 0;
            const rightTime = apiDatetimeToMs(right.created_at) ?? 0;
            return rightTime - leftTime;
          })
          .slice(0, MAX_FEED_ITEMS);

        seenIdsRef.current = new Set(firstWindow.map((item) => item.id));
        setFeedItems(firstWindow);
      } catch (err) {
        if (!cancelled) {
          setFeedError(
            err instanceof Error ? err.message : "Unable to load activity feed.",
          );
          setIsFeedEnriching(false);
        }
        return;
      } finally {
        if (!cancelled) {
          setIsFeedLoading(false);
        }
      }

      if (cancelled) return;

      try {
        const allBoards: BoardRead[] = [...stageABoards];
        for (let offset = PAGED_LIMIT; offset < PAGED_MAX; offset += PAGED_LIMIT) {
          const result = await listBoardsApiV1BoardsGet(
            {
              limit: PAGED_LIMIT,
              offset,
            },
            { signal },
          );
          if (cancelled) return;
          if (result.status !== 200) break;
          const items = result.data.items ?? [];
          if (items.length === 0) break;
          allBoards.push(...items);
          mergeBoards(items);
          if (items.length < PAGED_LIMIT) break;
        }

        for (let offset = PAGED_LIMIT; offset < PAGED_MAX; offset += PAGED_LIMIT) {
          const result = await listActivityApiV1ActivityGet(
            {
              limit: PAGED_LIMIT,
              offset,
            },
            { signal },
          );
          if (cancelled) return;
          if (result.status !== 200) break;
          const items = result.data.items ?? [];
          const mapped = items
            .map((event) => mapTaskActivity(event))
            .filter((item): item is FeedItem => item !== null)
            .sort((left, right) => {
              const leftTime = apiDatetimeToMs(left.created_at) ?? 0;
              const rightTime = apiDatetimeToMs(right.created_at) ?? 0;
              return rightTime - leftTime;
            });
          mergeFeedItems(mapped);
          if (items.length < PAGED_LIMIT) break;
        }

        const snapshotChunkSize = 6;
        for (let index = 0; index < allBoards.length; index += snapshotChunkSize) {
          const boardChunk = allBoards.slice(index, index + snapshotChunkSize);
          const snapshotResults = await Promise.allSettled(
            boardChunk.map((board) =>
              getBoardSnapshotApiV1BoardsBoardIdSnapshotGet(board.id, undefined, { signal }),
            ),
          );
          if (cancelled) return;

          const snapshotSeed: FeedItem[] = [];
          for (const [resultIndex, snapshotResult] of snapshotResults.entries()) {
            if (snapshotResult.status !== "fulfilled") continue;
            const board = boardChunk[resultIndex];
            seedFromSnapshot(board, snapshotSeed)(snapshotResult.value);
          }
          snapshotSeed.sort((left, right) => {
            const leftTime = apiDatetimeToMs(left.created_at) ?? 0;
            const rightTime = apiDatetimeToMs(right.created_at) ?? 0;
            return rightTime - leftTime;
          });
          mergeFeedItems(snapshotSeed);
        }
      } catch (err) {
        if (cancelled || isAbortLikeError(err)) return;
        setFeedError(
          err instanceof Error ? err.message : "Unable to enrich activity feed.",
        );
      } finally {
        if (!cancelled) {
          setIsFeedEnriching(false);
        }
      }
    };

    void loadProgressive();
    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [
    isSignedIn,
    mergeFeedItems,
    mapAgentEvent,
    mapApprovalEvent,
    mapBoardChat,
    mapTaskActivity,
  ]);

  useEffect(() => {
    if (!isPageActive) return;
    if (!isSignedIn) return;
    if (boardIds.length === 0) return;

    let cancelled = false;
    const cleanups: Array<() => void> = [];

    boardIds.forEach((boardId, index) => {
      const boardDelay = index * STREAM_CONNECT_SPACING_MS;
      const abortController = new AbortController();
      const backoff = createExponentialBackoff(SSE_RECONNECT_BACKOFF);
      let reconnectTimeout: number | undefined;
      let connectTimer: number | undefined;

      const connect = async () => {
        try {
          const since = latestTimestamp(
            (item) =>
              item.board_id === boardId && isTaskEventType(item.event_type),
          );
          const streamResult =
            await streamTasksApiV1BoardsBoardIdTasksStreamGet(
              boardId,
              since ? { since } : undefined,
              {
                headers: { Accept: "text/event-stream" },
                signal: abortController.signal,
              },
            );
          if (streamResult.status !== 200) {
            throw new Error("Unable to connect task stream.");
          }
          const response = streamResult.data as Response;
          if (!(response instanceof Response) || !response.body) {
            throw new Error("Unable to connect task stream.");
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
            buffer = buffer.replace(/\r\n/g, "\n");
            let boundary = buffer.indexOf("\n\n");
            while (boundary !== -1) {
              const raw = buffer.slice(0, boundary);
              buffer = buffer.slice(boundary + 2);
              const lines = raw.split("\n");
              let eventType = "message";
              let data = "";
              for (const line of lines) {
                if (line.startsWith("event:")) {
                  eventType = line.slice(6).trim();
                } else if (line.startsWith("data:")) {
                  data += line.slice(5).trim();
                }
              }
              if (eventType === "task" && data) {
                try {
                  const payload = JSON.parse(data) as {
                    type?: string;
                    activity?: ActivityEventRead;
                    task?: TaskRead;
                    comment?: TaskCommentRead;
                  };
                  if (payload.task) {
                    updateTaskMeta(payload.task, boardId);
                  }
                  if (payload.activity) {
                    const mapped = mapTaskActivity(payload.activity, boardId);
                    if (mapped) {
                      if (!mapped.task_title && payload.task?.title) {
                        mapped.task_title = payload.task.title;
                        mapped.title = payload.task.title;
                      }
                      pushFeedItem(mapped);
                    }
                  } else if (
                    payload.type === "task.comment" &&
                    payload.comment
                  ) {
                    pushFeedItem(mapTaskComment(payload.comment, boardId));
                  }
                } catch {
                  // Ignore malformed payloads.
                }
              }
              boundary = buffer.indexOf("\n\n");
            }
          }
        } catch {
          // Reconnect handled below.
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

      connectTimer = window.setTimeout(() => {
        connectTimer = undefined;
        void connect();
      }, boardDelay);

      cleanups.push(() => {
        abortController.abort();
        if (connectTimer !== undefined) {
          window.clearTimeout(connectTimer);
        }
        if (reconnectTimeout !== undefined) {
          window.clearTimeout(reconnectTimeout);
        }
      });
    });

    return () => {
      cancelled = true;
      cleanups.forEach((fn) => fn());
    };
  }, [
    boardIds,
    boardNameForId,
    isPageActive,
    isSignedIn,
    latestTimestamp,
    mapTaskActivity,
    mapTaskComment,
    pushFeedItem,
    updateTaskMeta,
  ]);

  useEffect(() => {
    if (!isPageActive) return;
    if (!isSignedIn) return;
    if (boardIds.length === 0) return;

    let cancelled = false;
    const cleanups: Array<() => void> = [];

    boardIds.forEach((boardId, index) => {
      const boardDelay = index * STREAM_CONNECT_SPACING_MS;
      const abortController = new AbortController();
      const backoff = createExponentialBackoff(SSE_RECONNECT_BACKOFF);
      let reconnectTimeout: number | undefined;
      let connectTimer: number | undefined;

      const connect = async () => {
        try {
          const since = latestTimestamp(
            (item) =>
              item.board_id === boardId &&
              item.event_type.startsWith("approval."),
          );
          const streamResult =
            await streamApprovalsApiV1BoardsBoardIdApprovalsStreamGet(
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
            buffer = buffer.replace(/\r\n/g, "\n");
            let boundary = buffer.indexOf("\n\n");
            while (boundary !== -1) {
              const raw = buffer.slice(0, boundary);
              buffer = buffer.slice(boundary + 2);
              const lines = raw.split("\n");
              let eventType = "message";
              let data = "";
              for (const line of lines) {
                if (line.startsWith("event:")) {
                  eventType = line.slice(6).trim();
                } else if (line.startsWith("data:")) {
                  data += line.slice(5).trim();
                }
              }
              if (eventType === "approval" && data) {
                try {
                  const payload = JSON.parse(data) as {
                    approval?: ApprovalRead;
                  };
                  if (payload.approval) {
                    const previous =
                      approvalsByIdRef.current.get(payload.approval.id) ?? null;
                    approvalsByIdRef.current.set(
                      payload.approval.id,
                      payload.approval,
                    );
                    pushFeedItem(
                      mapApprovalEvent(payload.approval, boardId, previous),
                    );
                  }
                } catch {
                  // Ignore malformed payloads.
                }
              }
              boundary = buffer.indexOf("\n\n");
            }
          }
        } catch {
          // Reconnect handled below.
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

      connectTimer = window.setTimeout(() => {
        connectTimer = undefined;
        void connect();
      }, boardDelay);

      cleanups.push(() => {
        abortController.abort();
        if (connectTimer !== undefined) {
          window.clearTimeout(connectTimer);
        }
        if (reconnectTimeout !== undefined) {
          window.clearTimeout(reconnectTimeout);
        }
      });
    });

    return () => {
      cancelled = true;
      cleanups.forEach((fn) => fn());
    };
  }, [
    boardIds,
    isPageActive,
    isSignedIn,
    latestTimestamp,
    mapApprovalEvent,
    pushFeedItem,
  ]);

  useEffect(() => {
    if (!isPageActive) return;
    if (!isSignedIn) return;
    if (boardIds.length === 0) return;

    let cancelled = false;
    const cleanups: Array<() => void> = [];

    boardIds.forEach((boardId, index) => {
      const boardDelay = index * STREAM_CONNECT_SPACING_MS;
      const abortController = new AbortController();
      const backoff = createExponentialBackoff(SSE_RECONNECT_BACKOFF);
      let reconnectTimeout: number | undefined;
      let connectTimer: number | undefined;

      const connect = async () => {
        try {
          const since = latestTimestamp(
            (item) =>
              item.board_id === boardId &&
              (item.event_type === "board.chat" ||
                item.event_type === "board.command"),
          );
          const params = { is_chat: true, ...(since ? { since } : {}) };
          const streamResult =
            await streamBoardMemoryApiV1BoardsBoardIdMemoryStreamGet(
              boardId,
              params,
              {
                headers: { Accept: "text/event-stream" },
                signal: abortController.signal,
              },
            );
          if (streamResult.status !== 200) {
            throw new Error("Unable to connect board chat stream.");
          }
          const response = streamResult.data as Response;
          if (!(response instanceof Response) || !response.body) {
            throw new Error("Unable to connect board chat stream.");
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
            buffer = buffer.replace(/\r\n/g, "\n");
            let boundary = buffer.indexOf("\n\n");
            while (boundary !== -1) {
              const raw = buffer.slice(0, boundary);
              buffer = buffer.slice(boundary + 2);
              const lines = raw.split("\n");
              let eventType = "message";
              let data = "";
              for (const line of lines) {
                if (line.startsWith("event:")) {
                  eventType = line.slice(6).trim();
                } else if (line.startsWith("data:")) {
                  data += line.slice(5).trim();
                }
              }
              if (eventType === "memory" && data) {
                try {
                  const payload = JSON.parse(data) as {
                    memory?: BoardMemoryRead;
                  };
                  if (payload.memory?.tags?.includes("chat")) {
                    pushFeedItem(mapBoardChat(payload.memory, boardId));
                  }
                } catch {
                  // Ignore malformed payloads.
                }
              }
              boundary = buffer.indexOf("\n\n");
            }
          }
        } catch {
          // Reconnect handled below.
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

      connectTimer = window.setTimeout(() => {
        connectTimer = undefined;
        void connect();
      }, boardDelay);

      cleanups.push(() => {
        abortController.abort();
        if (connectTimer !== undefined) {
          window.clearTimeout(connectTimer);
        }
        if (reconnectTimeout !== undefined) {
          window.clearTimeout(reconnectTimeout);
        }
      });
    });

    return () => {
      cancelled = true;
      cleanups.forEach((fn) => fn());
    };
  }, [
    boardIds,
    isPageActive,
    isSignedIn,
    latestTimestamp,
    mapBoardChat,
    pushFeedItem,
  ]);

  useEffect(() => {
    if (!isPageActive) return;
    if (!isSignedIn || !isOrgAdmin) return;

    let cancelled = false;
    const abortController = new AbortController();
    const backoff = createExponentialBackoff(SSE_RECONNECT_BACKOFF);
    let reconnectTimeout: number | undefined;

    const connect = async () => {
      try {
        const since = latestTimestamp((item) =>
          item.event_type.startsWith("agent."),
        );
        const streamResult = await streamAgentsApiV1AgentsStreamGet(
          since ? { since } : undefined,
          {
            headers: { Accept: "text/event-stream" },
            signal: abortController.signal,
          },
        );
        if (streamResult.status !== 200) {
          throw new Error("Unable to connect agent stream.");
        }
        const response = streamResult.data as Response;
        if (!(response instanceof Response) || !response.body) {
          throw new Error("Unable to connect agent stream.");
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
          buffer = buffer.replace(/\r\n/g, "\n");
          let boundary = buffer.indexOf("\n\n");
          while (boundary !== -1) {
            const raw = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            const lines = raw.split("\n");
            let eventType = "message";
            let data = "";
            for (const line of lines) {
              if (line.startsWith("event:")) {
                eventType = line.slice(6).trim();
              } else if (line.startsWith("data:")) {
                data += line.slice(5).trim();
              }
            }
            if (eventType === "agent" && data) {
              try {
                const payload = JSON.parse(data) as { agent?: AgentRead };
                if (payload.agent) {
                  const normalized = normalizeAgent(payload.agent);
                  const previous =
                    agentsByIdRef.current.get(normalized.id) ?? null;
                  agentsByIdRef.current.set(normalized.id, normalized);
                  const mapped = mapAgentEvent(normalized, previous, false);
                  if (mapped) {
                    pushFeedItem(mapped);
                  }
                }
              } catch {
                // Ignore malformed payloads.
              }
            }
            boundary = buffer.indexOf("\n\n");
          }
        }
      } catch {
        // Reconnect handled below.
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

    void connect();
    return () => {
      cancelled = true;
      abortController.abort();
      if (reconnectTimeout !== undefined) {
        window.clearTimeout(reconnectTimeout);
      }
    };
  }, [
    isOrgAdmin,
    isPageActive,
    isSignedIn,
    latestTimestamp,
    mapAgentEvent,
    pushFeedItem,
  ]);

  const orderedFeed = useMemo(() => {
    return [...feedItems].sort((a, b) => {
      const aTime = apiDatetimeToMs(a.created_at) ?? 0;
      const bTime = apiDatetimeToMs(b.created_at) ?? 0;
      return bTime - aTime;
    });
  }, [feedItems]);

  const selectedFeedItemId = useMemo(() => {
    if (!selectedEventId) return null;
    const directMatch = orderedFeed.find(
      (item) => item.source_event_id === selectedEventId,
    );
    if (directMatch) return directMatch.id;
    const fallbackMatch = orderedFeed.find(
      (item) =>
        item.id === selectedEventId || item.id === `activity:${selectedEventId}`,
    );
    return fallbackMatch?.id ?? null;
  }, [orderedFeed, selectedEventId]);

  useEffect(() => {
    if (!selectedFeedItemId) {
      setHighlightedFeedItemId(null);
      return;
    }

    setHighlightedFeedItemId(selectedFeedItemId);
    const scrollTimeout = window.setTimeout(() => {
      const element = document.getElementById(feedItemElementId(selectedFeedItemId));
      if (!element) return;
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);

    const clearHighlightTimeout = window.setTimeout(() => {
      setHighlightedFeedItemId((current) =>
        current === selectedFeedItemId ? null : current,
      );
    }, 4_000);

    return () => {
      window.clearTimeout(scrollTimeout);
      window.clearTimeout(clearHighlightTimeout);
    };
  }, [selectedFeedItemId]);

  const hasUnresolvedDeepLink = Boolean(
    selectedEventId &&
      !selectedFeedItemId &&
      !isFeedLoading &&
      !isFeedEnriching &&
      !feedError,
  );

  return (
    <DashboardShell>
      {isMounted ? (
        <>
          <SignedOut>
            <SignedOutPanel
              message="Sign in to view the feed."
              forceRedirectUrl="/activity"
              signUpForceRedirectUrl="/activity"
              mode="redirect"
              buttonTestId="activity-signin"
            />
          </SignedOut>
          <SignedIn>
            <DashboardSidebar />
            <main className="flex-1 overflow-y-auto bg-app">
              <div className="sticky top-0 z-30 border-b border-[color:var(--border)] bg-[color:var(--surface)]">
                <div className="px-8 py-6">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <ActivityIcon className="h-5 w-5 text-[color:var(--text-muted)]" />
                        <h1 className="text-2xl font-semibold tracking-tight text-strong">
                          Live feed
                        </h1>
                      </div>
                      <p className="mt-1 text-sm text-muted">
                        Realtime task, approval, agent, and board-chat activity
                        across all boards.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8">
                {hasUnresolvedDeepLink ? (
                  <div className="mb-4 rounded-lg border p-3 text-sm status-warning">
                    Requested activity item is not in the current feed window yet.
                  </div>
                ) : null}
                <ActivityFeed
                  isLoading={isFeedLoading}
                  errorMessage={feedError}
                  items={orderedFeed}
                  renderItem={(item) => (
                    <FeedCard
                      key={item.id}
                      item={item}
                      isHighlighted={highlightedFeedItemId === item.id}
                    />
                  )}
                />
              </div>
            </main>
          </SignedIn>
        </>
      ) : null}
    </DashboardShell>
  );
}

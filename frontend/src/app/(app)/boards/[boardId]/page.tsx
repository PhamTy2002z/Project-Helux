"use client";

export const dynamic = "force-dynamic";

import {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";

import { SignInButton, SignedIn, SignedOut, useAuth } from "@/auth/clerk";
import {
  Activity,
  ArrowUpRight,
  MessageSquare,
  Pause,
  Plus,
  Play,
  RefreshCcw,
  Settings,
  ShieldCheck,
} from "lucide-react";

import { StatusDot } from "@/components/atoms/StatusDot";
import { DashboardSidebar } from "@/components/organisms/DashboardSidebar";
import { TaskBoard } from "@/components/organisms/TaskBoard";
import type { DependencyBannerDependency } from "@/components/molecules/DependencyBanner";
import { DashboardShell } from "@/components/templates/DashboardShell";
import nextDynamic from "next/dynamic";
const BoardChatComposer = nextDynamic(
  () => import("@/components/BoardChatComposer").then(m => m.BoardChatComposer),
  { ssr: false }
);
const BoardChatPanel = nextDynamic(
  () => import("@/components/boards/BoardChatPanel").then(m => m.BoardChatPanel),
  { ssr: false }
);
import { TaskDetailPanel } from "./TaskDetailPanel";
import { TaskCreateDialog } from "./TaskCreateDialog";
import { TaskEditDialog } from "./TaskEditDialog";
import { TaskDeleteDialog } from "./TaskDeleteDialog";
import { AgentsControlDialog } from "./AgentsControlDialog";
import { LiveFeedPanel } from "./LiveFeedPanel";
import { BoardToasts } from "./BoardToasts";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/api/mutator";
import { streamAgentsApiV1AgentsStreamGet } from "@/api/generated/agents/agents";
import {
  streamApprovalsApiV1BoardsBoardIdApprovalsStreamGet,
  updateApprovalApiV1BoardsBoardIdApprovalsApprovalIdPatch,
} from "@/api/generated/approvals/approvals";
import { listActivityApiV1ActivityGet } from "@/api/generated/activity/activity";
import {
  createBoardMemoryApiV1BoardsBoardIdMemoryPost,
  streamBoardMemoryApiV1BoardsBoardIdMemoryStreamGet,
} from "@/api/generated/board-memory/board-memory";
import {
  type getMyMembershipApiV1OrganizationsMeMemberGetResponse,
  useGetMyMembershipApiV1OrganizationsMeMemberGet,
} from "@/api/generated/organizations/organizations";
import {
  createTaskCommentApiV1BoardsBoardIdTasksTaskIdCommentsPost,
  listTaskCommentsApiV1BoardsBoardIdTasksTaskIdCommentsGet,
  streamTasksApiV1BoardsBoardIdTasksStreamGet,
  updateTaskApiV1BoardsBoardIdTasksTaskIdPatch,
} from "@/api/generated/tasks/tasks";
import {
  type listTagsApiV1TagsGetResponse,
  useListTagsApiV1TagsGet,
} from "@/api/generated/tags/tags";
import {
  type listOrgCustomFieldsApiV1OrganizationsMeCustomFieldsGetResponse,
  useListOrgCustomFieldsApiV1OrganizationsMeCustomFieldsGet,
} from "@/api/generated/org-custom-fields/org-custom-fields";
import type {
  AgentRead,
  ApprovalRead,
  BoardGroupSnapshot,
  BoardMemoryRead,
  BoardRead,
  ActivityEventRead,
  OrganizationMemberRead,
  TaskCardRead,
  TaskCommentRead,
  TaskCustomFieldDefinitionRead,
  TagRead,
  TaskRead,
} from "@/api/generated/model";
import { useSSEStream } from "@/lib/hooks/use-sse-stream";
import {
  apiDatetimeToMs,
  parseApiDatetime,
} from "@/lib/datetime";
import {
  DEFAULT_HUMAN_LABEL,
  resolveMemberDisplayName,
} from "@/lib/display-name";
import { AGENT_EMOJI_GLYPHS } from "@/lib/agent-emoji";
import {
  applyBoardQueryStateToSearchParams,
  parseBoardQueryState,
} from "@/lib/boards/board-query-state";
import { cn } from "@/lib/utils";
import { usePageActive } from "@/hooks/usePageActive";
import { loadBoardDetailBootstrap } from "@/lib/hooks/board-detail/load-board-detail-bootstrap";
import { isBoardOverlayEnabled } from "@/lib/query-policy";
import {
  boardCustomFieldValues,
  type TaskCustomFieldValues,
} from "./custom-field-utils";
import type {
  Agent,
  Approval,
  Board,
  BoardChatMessage,
  LiveFeedEventType,
  LiveFeedItem,
  Task,
  TaskComment,
  TaskStatus,
  ToastMessage,
} from "./board-types";
import {
  isLiveFeedEventType,
  SSE_RECONNECT_BACKOFF,
} from "./board-constants";
import {
  commentElementId,
  formatActionError,
  formatShortTimestamp,
  latestAgentTimestamp,
  latestApprovalTimestamp,
  latestChatTimestamp,
  latestTaskTimestamp,
  resolveBoardAccess,
} from "./board-utils";
import {
  normalizeAgent,
  normalizeApproval,
  normalizeTagColor,
  normalizeTask,
} from "./board-normalizers";
import {
  liveFeedEventLabel,
  liveFeedEventPillClass,
  mergeCommentsById,
  toLiveFeedFromActivity,
  toLiveFeedFromAgentSnapshot,
  toLiveFeedFromAgentUpdate,
  toLiveFeedFromApproval,
  toLiveFeedFromBoardChat,
  toLiveFeedFromComment,
} from "./live-feed-utils";

const compareChatMessagesAsc = (
  left: BoardChatMessage,
  right: BoardChatMessage,
): number => {
  const leftTime = apiDatetimeToMs(left.created_at) ?? 0;
  const rightTime = apiDatetimeToMs(right.created_at) ?? 0;
  if (leftTime !== rightTime) return leftTime - rightTime;
  return left.id.localeCompare(right.id);
};

const findChatInsertionIndex = (
  items: BoardChatMessage[],
  incoming: BoardChatMessage,
): number => {
  let low = 0;
  let high = items.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (compareChatMessagesAsc(items[middle], incoming) <= 0) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
};

const appendUniqueSortedChatMessage = (
  items: BoardChatMessage[],
  incoming: BoardChatMessage,
): BoardChatMessage[] => {
  if (items.some((item) => item.id === incoming.id)) {
    return items;
  }
  const insertionIndex = findChatInsertionIndex(items, incoming);
  return [
    ...items.slice(0, insertionIndex),
    incoming,
    ...items.slice(insertionIndex),
  ];
};

export default function BoardDetailPage() {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const boardIdParam = params?.boardId;
  const boardId = Array.isArray(boardIdParam) ? boardIdParam[0] : boardIdParam;
  const { isSignedIn } = useAuth();
  const isPageActive = usePageActive();
  const taskIdFromUrl = searchParams.get("taskId");
  const commentIdFromUrl = searchParams.get("commentId");
  const panelFromUrl = searchParams.get("panel");
  const boardQueryState = useMemo(
    () => parseBoardQueryState(searchParams),
    [searchParams],
  );
  const buildUrlWithTaskAndComment = useCallback(
    (
      taskId: string | null,
      commentId: string | null,
      panel: "chat" | null = null,
    ): string => {
      const params = new URLSearchParams(searchParams.toString());
      if (taskId) {
        params.set("taskId", taskId);
      } else {
        params.delete("taskId");
      }
      if (commentId) {
        params.set("commentId", commentId);
      } else {
        params.delete("commentId");
      }
      if (panel) {
        params.set("panel", panel);
      } else {
        params.delete("panel");
      }
      const next = params.toString();
      return next ? `${pathname}?${next}` : pathname;
    },
    [pathname, searchParams],
  );
  const setBoardQueryState = useCallback(
    (nextState: ReturnType<typeof parseBoardQueryState>) => {
      const nextParams = applyBoardQueryStateToSearchParams(
        new URLSearchParams(searchParams.toString()),
        nextState,
      );
      const next = nextParams.toString();
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const membershipQuery = useGetMyMembershipApiV1OrganizationsMeMemberGet<
    getMyMembershipApiV1OrganizationsMeMemberGetResponse,
    ApiError
  >({
    query: {
      enabled: Boolean(isSignedIn),
      refetchOnMount: "always",
    },
  });
  const tagsQuery = useListTagsApiV1TagsGet<
    listTagsApiV1TagsGetResponse,
    ApiError
  >(undefined, {
    query: {
      enabled: Boolean(isSignedIn),
      refetchOnMount: "always",
    },
  });
  const tags = useMemo(
    () =>
      tagsQuery.data?.status === 200 ? (tagsQuery.data.data.items ?? []) : [],
    [tagsQuery.data],
  );
  const customFieldDefinitionsQuery =
    useListOrgCustomFieldsApiV1OrganizationsMeCustomFieldsGet<
      listOrgCustomFieldsApiV1OrganizationsMeCustomFieldsGetResponse,
      ApiError
    >({
      query: {
        enabled: Boolean(isSignedIn),
        refetchOnMount: "always",
        retry: false,
      },
    });
  const boardCustomFieldDefinitions = useMemo(() => {
    if (!boardId || customFieldDefinitionsQuery.data?.status !== 200) {
      return [] as TaskCustomFieldDefinitionRead[];
    }
    return (customFieldDefinitionsQuery.data.data ?? [])
      .filter((definition) => (definition.board_ids ?? []).includes(boardId))
      .sort((left, right) =>
        (left.label || left.field_key).localeCompare(
          right.label || right.field_key,
        ),
      );
  }, [boardId, customFieldDefinitionsQuery.data]);

  const boardAccess = useMemo(
    () =>
      resolveBoardAccess(
        membershipQuery.data?.status === 200 ? membershipQuery.data.data : null,
        boardId,
      ),
    [membershipQuery.data, boardId],
  );
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
  const canWrite = boardAccess.canWrite;

  const [board, setBoard] = useState<Board | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [groupSnapshot, setGroupSnapshot] = useState<BoardGroupSnapshot | null>(
    null,
  );
  const [groupSnapshotError, setGroupSnapshotError] = useState<string | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedBoardSnapshot, setHasLoadedBoardSnapshot] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const selectedTaskIdRef = useRef<string | null>(null);
  const openedTaskIdFromUrlRef = useRef<string | null>(null);
  const openedPanelFromUrlRef = useRef<string | null>(null);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [highlightedCommentId, setHighlightedCommentId] = useState<
    string | null
  >(null);
  const [liveFeed, setLiveFeed] = useState<LiveFeedItem[]>([]);
  const liveFeedRef = useRef<LiveFeedItem[]>([]);
  const liveFeedFlashTimersRef = useRef<Record<string, number>>({});
  const [liveFeedFlashIds, setLiveFeedFlashIds] = useState<
    Record<string, boolean>
  >({});
  const [isLiveFeedHistoryLoading, setIsLiveFeedHistoryLoading] =
    useState(false);
  const [liveFeedHistoryError, setLiveFeedHistoryError] = useState<
    string | null
  >(null);
  const liveFeedHistoryLoadedRef = useRef(false);
  const [isCommentsLoading, setIsCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [postCommentError, setPostCommentError] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const tasksRef = useRef<Task[]>([]);
  const approvalsRef = useRef<Approval[]>([]);
  const agentsRef = useRef<Agent[]>([]);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [isApprovalsLoading, setIsApprovalsLoading] = useState(false);
  const [approvalsError, setApprovalsError] = useState<string | null>(null);
  const [approvalsUpdatingId, setApprovalsUpdatingId] = useState<string | null>(
    null,
  );
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<BoardChatMessage[]>([]);
  const chatMessagesRef = useRef<BoardChatMessage[]>([]);
  const [isAgentsControlDialogOpen, setIsAgentsControlDialogOpen] =
    useState(false);
  const [agentsControlAction, setAgentsControlAction] = useState<
    "pause" | "resume"
  >("pause");
  const [viewMode, setViewMode] = useState<"board" | "list">("board");
  const overlayEnabled = useMemo(
    () =>
      isBoardOverlayEnabled({
        boardId: boardId ?? null,
        organizationId: board?.organization_id ?? null,
      }),
    [board?.organization_id, boardId],
  );
  const [isLiveFeedOpen, setIsLiveFeedOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const isLiveFeedOpenRef = useRef(false);
  const toastIdRef = useRef(0);
  const toastTimersRef = useRef<Record<number, number>>({});
  const pushLiveFeed = useCallback((item: LiveFeedItem) => {
    const alreadySeen = liveFeedRef.current.some(
      (existing) => existing.id === item.id,
    );
    setLiveFeed((prev) => {
      if (prev.some((existing) => existing.id === item.id)) {
        return prev;
      }
      const next = [item, ...prev];
      return next.slice(0, 50);
    });

    if (alreadySeen) return;
    if (!isLiveFeedOpenRef.current) return;

    setLiveFeedFlashIds((prev) =>
      prev[item.id] ? prev : { ...prev, [item.id]: true },
    );

    if (typeof window === "undefined") return;
    const existingTimer = liveFeedFlashTimersRef.current[item.id];
    if (existingTimer !== undefined) {
      window.clearTimeout(existingTimer);
    }
    liveFeedFlashTimersRef.current[item.id] = window.setTimeout(() => {
      delete liveFeedFlashTimersRef.current[item.id];
      setLiveFeedFlashIds((prev) => {
        if (!prev[item.id]) return prev;
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    }, 2200);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    const timer = toastTimersRef.current[id];
    if (timer !== undefined) {
      window.clearTimeout(timer);
      delete toastTimersRef.current[id];
    }
  }, []);

  const pushToast = useCallback(
    (message: string, tone: ToastMessage["tone"] = "error") => {
      const trimmed = message.trim();
      if (!trimmed) return;
      const id = toastIdRef.current + 1;
      toastIdRef.current = id;
      setToasts((prev) => [...prev, { id, message: trimmed, tone }]);
      if (typeof window !== "undefined") {
        toastTimersRef.current[id] = window.setTimeout(() => {
          dismissToast(id);
        }, 3500);
      }
    },
    [dismissToast],
  );

  const appendBoardChatMessage = useCallback(
    (message: BoardChatMessage) => {
      if (!message.tags?.includes("chat")) return;
      pushLiveFeed(toLiveFeedFromBoardChat(message));
      setChatMessages((prev) => {
        return appendUniqueSortedChatMessage(prev, message);
      });
    },
    [pushLiveFeed],
  );

  useEffect(() => {
    liveFeedHistoryLoadedRef.current = false;
    setIsLiveFeedHistoryLoading(false);
    setLiveFeedHistoryError(null);
    setLiveFeed([]);
    setLiveFeedFlashIds({});
    if (typeof window !== "undefined") {
      Object.values(liveFeedFlashTimersRef.current).forEach((timerId) => {
        window.clearTimeout(timerId);
      });
    }
    liveFeedFlashTimersRef.current = {};
  }, [boardId]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined") {
        Object.values(liveFeedFlashTimersRef.current).forEach((timerId) => {
          window.clearTimeout(timerId);
        });
      }
      liveFeedFlashTimersRef.current = {};
    };
  }, []);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined") {
        Object.values(toastTimersRef.current).forEach((timerId) => {
          window.clearTimeout(timerId);
        });
      }
      toastTimersRef.current = {};
    };
  }, []);

  useEffect(() => {
    if (!isLiveFeedOpen) return;
    if (!isSignedIn || !boardId) return;
    if (isLoading) return;
    if (liveFeedHistoryLoadedRef.current) return;

    let cancelled = false;
    setIsLiveFeedHistoryLoading(true);
    setLiveFeedHistoryError(null);

    const fetchHistory = async () => {
      try {
        const sourceTasks =
          tasksRef.current.length > 0 ? tasksRef.current : tasks;
        const sourceApprovals =
          approvalsRef.current.length > 0 ? approvalsRef.current : approvals;
        const sourceAgents =
          agentsRef.current.length > 0 ? agentsRef.current : agents;
        const sourceChatMessages =
          chatMessagesRef.current.length > 0
            ? chatMessagesRef.current
            : chatMessages;
        const boardTaskIds = new Set(sourceTasks.map((task) => task.id));
        const collected: LiveFeedItem[] = [];
        const seen = new Set<string>();
        const limit = 200;
        const recentChatMessages = [...sourceChatMessages]
          .sort((a, b) => {
            const aTime = apiDatetimeToMs(a.created_at) ?? 0;
            const bTime = apiDatetimeToMs(b.created_at) ?? 0;
            return bTime - aTime;
          })
          .slice(0, 50);
        for (const memory of recentChatMessages) {
          const chatItem = toLiveFeedFromBoardChat(memory);
          if (seen.has(chatItem.id)) continue;
          seen.add(chatItem.id);
          collected.push(chatItem);
          if (collected.length >= 200) break;
        }
        for (const agent of sourceAgents) {
          if (collected.length >= 200) break;
          const agentItem = toLiveFeedFromAgentSnapshot(agent);
          if (seen.has(agentItem.id)) continue;
          seen.add(agentItem.id);
          collected.push(agentItem);
          if (collected.length >= 200) break;
        }
        for (const approval of sourceApprovals) {
          if (collected.length >= 200) break;
          const approvalItem = toLiveFeedFromApproval(approval);
          if (seen.has(approvalItem.id)) continue;
          seen.add(approvalItem.id);
          collected.push(approvalItem);
          if (collected.length >= 200) break;
        }

        for (
          let offset = 0;
          collected.length < 200 && offset < 1000;
          offset += limit
        ) {
          const result = await listActivityApiV1ActivityGet({
            limit,
            offset,
          });
          if (cancelled) return;
          if (result.status !== 200) {
            throw new Error("Unable to load live feed.");
          }
          const items = result.data.items ?? [];
          for (const event of items) {
            const mapped = toLiveFeedFromActivity(event);
            if (!mapped?.task_id) continue;
            if (!boardTaskIds.has(mapped.task_id)) continue;
            if (seen.has(mapped.id)) continue;
            seen.add(mapped.id);
            collected.push(mapped);
            if (collected.length >= 200) break;
          }
          if (collected.length >= 200 || items.length < limit) {
            break;
          }
        }
        liveFeedHistoryLoadedRef.current = true;

        setLiveFeed((prev) => {
          const map = new Map<string, LiveFeedItem>();
          [...prev, ...collected].forEach((item) => map.set(item.id, item));
          const merged = [...map.values()];
          merged.sort((a, b) => {
            const aTime = apiDatetimeToMs(a.created_at) ?? 0;
            const bTime = apiDatetimeToMs(b.created_at) ?? 0;
            return bTime - aTime;
          });
          return merged.slice(0, 50);
        });
      } catch (err) {
        if (cancelled) return;
        setLiveFeedHistoryError(
          err instanceof Error ? err.message : "Unable to load live feed.",
        );
      } finally {
        if (cancelled) return;
        setIsLiveFeedHistoryLoading(false);
      }
    };

    void fetchHistory();
    return () => {
      cancelled = true;
    };
  }, [
    agents,
    approvals,
    boardId,
    chatMessages,
    isLiveFeedOpen,
    isLoading,
    isSignedIn,
    tasks,
  ]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const isSidePanelOpen = isDetailOpen || isChatOpen || isLiveFeedOpen;
  const defaultCreateCustomFieldValues = useMemo(
    () => boardCustomFieldValues(boardCustomFieldDefinitions, {}),
    [boardCustomFieldDefinitions],
  );
  const selectedTaskCustomFieldValues = useMemo(
    () =>
      boardCustomFieldValues(
        boardCustomFieldDefinitions,
        selectedTask?.custom_field_values,
      ),
    [boardCustomFieldDefinitions, selectedTask?.custom_field_values],
  );

  const titleLabel = useMemo(
    () => (board ? `${board.name} board` : "Board"),
    [board],
  );

  useEffect(() => {
    if (!isSidePanelOpen) return;

    const { body, documentElement } = document;
    const originalHtmlOverflow = documentElement.style.overflow;
    const originalBodyOverflow = body.style.overflow;
    const originalBodyPaddingRight = body.style.paddingRight;

    const scrollbarWidth = window.innerWidth - documentElement.clientWidth;

    documentElement.style.overflow = "hidden";
    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      documentElement.style.overflow = originalHtmlOverflow;
      body.style.overflow = originalBodyOverflow;
      body.style.paddingRight = originalBodyPaddingRight;
    };
  }, [isSidePanelOpen]);

  const loadBoard = useCallback(async () => {
    if (!isSignedIn || !boardId) return;
    setHasLoadedBoardSnapshot(false);
    setIsLoading(true);
    setIsApprovalsLoading(true);
    setError(null);
    setApprovalsError(null);
    setGroupSnapshotError(null);
    try {
      const bootstrap = await loadBoardDetailBootstrap(boardId);
      if (!bootstrap.snapshot) {
        throw new Error(bootstrap.snapshotError ?? "Unable to load board snapshot.");
      }

      const snapshot = bootstrap.snapshot;
      setBoard(snapshot.board);
      setTasks((snapshot.tasks ?? []).map(normalizeTask));
      setAgents((snapshot.agents ?? []).map(normalizeAgent));
      setApprovals((snapshot.approvals ?? []).map(normalizeApproval));
      setChatMessages(snapshot.chat_messages ?? []);
      setGroupSnapshot(bootstrap.groupSnapshot);
      setGroupSnapshotError(bootstrap.groupSnapshotError);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
      setApprovalsError(message);
      setGroupSnapshotError(message);
      setGroupSnapshot(null);
    } finally {
      setIsLoading(false);
      setIsApprovalsLoading(false);
      setHasLoadedBoardSnapshot(true);
    }
  }, [boardId, isSignedIn]);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    approvalsRef.current = approvals;
  }, [approvals]);

  useEffect(() => {
    agentsRef.current = agents;
  }, [agents]);

  useEffect(() => {
    selectedTaskIdRef.current = selectedTask?.id ?? null;
  }, [selectedTask?.id]);

  useEffect(() => {
    chatMessagesRef.current = chatMessages;
  }, [chatMessages]);

  useEffect(() => {
    liveFeedRef.current = liveFeed;
  }, [liveFeed]);

  useEffect(() => {
    isLiveFeedOpenRef.current = isLiveFeedOpen;
  }, [isLiveFeedOpen]);

  const lastAgentControlCommand = useMemo(() => {
    for (let i = chatMessages.length - 1; i >= 0; i -= 1) {
      const value = (chatMessages[i]?.content ?? "").trim().toLowerCase();
      if (value === "/pause" || value === "/resume") {
        return value;
      }
    }
    return null;
  }, [chatMessages]);

  const isAgentsPaused = lastAgentControlCommand === "/pause";

  useSSEStream({
    enabled: !!isPageActive && !!isSignedIn && !!boardId && !!board && (isChatOpen || isLiveFeedOpen),
    key: `chat-${boardId}`,
    backoffConfig: SSE_RECONNECT_BACKOFF,
    connect: async (signal) => {
      const since = latestChatTimestamp(chatMessagesRef.current);
      const params = { is_chat: true, ...(since ? { since } : {}) };
      const streamResult =
        await streamBoardMemoryApiV1BoardsBoardIdMemoryStreamGet(
          boardId!,
          params,
          { headers: { Accept: "text/event-stream" }, signal },
        );
      if (streamResult.status !== 200) {
        throw new Error("Unable to connect board chat stream.");
      }
      return streamResult.data as Response;
    },
    onEvent: (event) => {
      if (event.eventType === "memory" && event.data) {
        try {
          const payload = JSON.parse(event.data) as { memory?: BoardChatMessage };
          if (payload.memory?.tags?.includes("chat")) {
            appendBoardChatMessage(payload.memory);
          }
        } catch {
          // ignore malformed
        }
      }
    },
  });

  useSSEStream({
    enabled: !!isPageActive && !!isSignedIn && !!boardId && !!board,
    key: `approvals-${boardId}`,
    backoffConfig: SSE_RECONNECT_BACKOFF,
    connect: async (signal) => {
      const since = latestApprovalTimestamp(approvalsRef.current);
      const streamResult =
        await streamApprovalsApiV1BoardsBoardIdApprovalsStreamGet(
          boardId!,
          since ? { since } : undefined,
          { headers: { Accept: "text/event-stream" }, signal },
        );
      if (streamResult.status !== 200) {
        throw new Error("Unable to connect approvals stream.");
      }
      return streamResult.data as Response;
    },
    onEvent: (event) => {
      if (event.eventType !== "approval" || !event.data) return;
      try {
        const payload = JSON.parse(event.data) as {
          approval?: ApprovalRead;
          task_counts?:
            | { task_id?: string; approvals_count?: number; approvals_pending_count?: number }
            | Array<{ task_id?: string; approvals_count?: number; approvals_pending_count?: number }>;
          pending_approvals_count?: number;
        };
        if (payload.approval) {
          const normalized = normalizeApproval(payload.approval);
          const previousApproval =
            approvalsRef.current.find((item) => item.id === normalized.id) ?? null;
          pushLiveFeed(toLiveFeedFromApproval(normalized, previousApproval));
          setApprovals((prev) => {
            const index = prev.findIndex((item) => item.id === normalized.id);
            if (index === -1) return [normalized, ...prev];
            const next = [...prev];
            next[index] = { ...next[index], ...normalized };
            return next;
          });
        }
        const taskCounts = Array.isArray(payload.task_counts)
          ? payload.task_counts
          : payload.task_counts
            ? [payload.task_counts]
            : [];
        if (taskCounts.length > 0) {
          setTasks((prev) => {
            const countsByTaskId = new Map(
              taskCounts
                .filter((row) => Boolean(row.task_id))
                .map((row) => [row.task_id as string, row]),
            );
            return prev.map((task) => {
              const counts = countsByTaskId.get(task.id);
              if (!counts) return task;
              return {
                ...task,
                approvals_count: counts.approvals_count ?? task.approvals_count,
                approvals_pending_count:
                  counts.approvals_pending_count ?? task.approvals_pending_count,
              };
            });
          });
        }
      } catch {
        // Ignore malformed payloads.
      }
    },
  });

  useSSEStream({
    enabled: !!isPageActive && !!isSignedIn && !!boardId && !!board,
    key: `tasks-${boardId}`,
    backoffConfig: SSE_RECONNECT_BACKOFF,
    connect: async (signal) => {
      const since = latestTaskTimestamp(tasksRef.current);
      const streamResult = await streamTasksApiV1BoardsBoardIdTasksStreamGet(
        boardId!,
        since ? { since } : undefined,
        { headers: { Accept: "text/event-stream" }, signal },
      );
      if (streamResult.status !== 200) {
        throw new Error("Unable to connect task stream.");
      }
      return streamResult.data as Response;
    },
    onEvent: (event) => {
      if (event.eventType !== "task" || !event.data) return;
      try {
        const payload = JSON.parse(event.data) as {
          type?: string;
          activity?: ActivityEventRead;
          task?: TaskRead;
          comment?: TaskCommentRead;
        };
        const liveEvent = payload.activity
          ? toLiveFeedFromActivity(payload.activity)
          : payload.type === "task.comment" && payload.comment
            ? toLiveFeedFromComment(payload.comment)
            : null;
        if (liveEvent) {
          pushLiveFeed(liveEvent);
        }
        if (payload.comment?.task_id && payload.type === "task.comment") {
          setComments((prev) => {
            if (selectedTaskIdRef.current !== payload.comment?.task_id) {
              return prev;
            }
            return mergeCommentsById(prev, [payload.comment as TaskComment]);
          });
        } else if (payload.task) {
          const incomingTask = payload.task;
          setTasks((prev) => {
            const index = prev.findIndex((item) => item.id === incomingTask.id);
            if (index === -1) {
              const assignee = incomingTask.assigned_agent_id
                ? (agentsRef.current.find(
                    (agent) => agent.id === incomingTask.assigned_agent_id,
                  )?.name ?? null)
                : null;
              const created = normalizeTask({
                ...incomingTask,
                assignee,
                approvals_count: 0,
                approvals_pending_count: 0,
              } as TaskCardRead);
              return [created, ...prev];
            }
            const next = [...prev];
            const existing = next[index];
            const assignee = incomingTask.assigned_agent_id
              ? (agentsRef.current.find(
                  (agent) => agent.id === incomingTask.assigned_agent_id,
                )?.name ?? null)
              : null;
            const updated = normalizeTask({
              ...existing,
              ...incomingTask,
              assignee,
              approvals_count: existing.approvals_count,
              approvals_pending_count: existing.approvals_pending_count,
            } as TaskCardRead);
            next[index] = { ...existing, ...updated };
            return next;
          });
          if (selectedTaskIdRef.current === incomingTask.id) {
            setSelectedTask((prev) => {
              if (!prev || prev.id !== incomingTask.id) return prev;
              return {
                ...prev,
                ...incomingTask,
                custom_field_values:
                  incomingTask.custom_field_values !== undefined
                    ? incomingTask.custom_field_values
                    : prev.custom_field_values,
              };
            });
          }
        }
      } catch {
        // Ignore malformed payloads.
      }
    },
  });

  useSSEStream({
    enabled: !!isPageActive && !!isSignedIn && !!boardId && !!isOrgAdmin,
    key: `agents-${boardId}`,
    backoffConfig: SSE_RECONNECT_BACKOFF,
    connect: async (signal) => {
      const since = latestAgentTimestamp(agentsRef.current);
      const streamResult = await streamAgentsApiV1AgentsStreamGet(
        { board_id: boardId!, since: since ?? null },
        { headers: { Accept: "text/event-stream" }, signal },
      );
      if (streamResult.status !== 200) {
        throw new Error("Unable to connect agent stream.");
      }
      return streamResult.data as Response;
    },
    onEvent: (event) => {
      if (event.eventType !== "agent" || !event.data) return;
      try {
        const payload = JSON.parse(event.data) as { agent?: AgentRead };
        if (payload.agent) {
          const normalized = normalizeAgent(payload.agent);
          const previousAgent =
            agentsRef.current.find((item) => item.id === normalized.id) ?? null;
          const liveEvent = toLiveFeedFromAgentUpdate(normalized, previousAgent);
          if (liveEvent) {
            pushLiveFeed(liveEvent);
          }
          setAgents((prev) => {
            const index = prev.findIndex((item) => item.id === normalized.id);
            if (index === -1) return [normalized, ...prev];
            const next = [...prev];
            next[index] = { ...next[index], ...normalized };
            return next;
          });
        }
      } catch {
        // Ignore malformed payloads.
      }
    },
  });

  const postBoardChatMessage = useCallback(
    async (content: string): Promise<{ ok: boolean; error: string | null }> => {
      if (!isSignedIn || !boardId) {
        return { ok: false, error: "Sign in to send messages." };
      }
      const trimmed = content.trim();
      if (!trimmed) return { ok: false, error: null };

      try {
        const result = await createBoardMemoryApiV1BoardsBoardIdMemoryPost(
          boardId,
          {
            content: trimmed,
            tags: ["chat"],
            source: currentUserDisplayName,
          },
        );
        if (result.status !== 200) {
          throw new Error("Unable to send message.");
        }
        const created = result.data;
        appendBoardChatMessage(created);
        return { ok: true, error: null };
      } catch (err) {
        const message = formatActionError(err, "Unable to send message.");
        return { ok: false, error: message };
      }
    },
    [appendBoardChatMessage, boardId, currentUserDisplayName, isSignedIn],
  );

  const openAgentsControlDialog = (action: "pause" | "resume") => {
    setAgentsControlAction(action);
    setIsAgentsControlDialogOpen(true);
  };

  const assigneeById = useMemo(() => {
    const map = new Map<string, string>();
    agents
      .filter((agent) => !boardId || agent.board_id === boardId)
      .forEach((agent) => {
        map.set(agent.id, agent.name);
      });
    return map;
  }, [agents, boardId]);

  const taskTitleById = useMemo(() => {
    const map = new Map<string, string>();
    tasks.forEach((task) => {
      map.set(task.id, task.title);
    });
    return map;
  }, [tasks]);

  const taskById = useMemo(() => {
    const map = new Map<string, Task>();
    tasks.forEach((task) => {
      map.set(task.id, task);
    });
    return map;
  }, [tasks]);

  const boardChatMentionSuggestions = useMemo(() => {
    const options = new Set<string>(["lead"]);
    agents.forEach((agent) => {
      if (agent.name) {
        options.add(agent.name);
      }
    });
    return [...options];
  }, [agents]);

  const tagById = useMemo(() => {
    const map = new Map<string, TagRead>();
    tags.forEach((tag) => {
      map.set(tag.id, tag);
    });
    return map;
  }, [tags]);

  const pendingApprovals = useMemo(
    () => approvals.filter((approval) => approval.status === "pending"),
    [approvals],
  );

  const taskApprovals = useMemo(() => {
    if (!selectedTask) return [];
    const taskId = selectedTask.id;
    const taskIdsForApproval = (approval: Approval) => {
      const payload = approval.payload ?? {};
      const payloadValue = (key: string) => {
        const value = (payload as Record<string, unknown>)[key];
        if (typeof value === "string" || typeof value === "number") {
          return String(value);
        }
        return null;
      };
      const payloadArray = (key: string) => {
        const value = (payload as Record<string, unknown>)[key];
        if (!Array.isArray(value)) return [];
        return value.filter((item): item is string => typeof item === "string");
      };
      const linkedTaskIds = (
        approval as Approval & { task_ids?: string[] | null }
      ).task_ids;
      const singleTaskId =
        approval.task_id ??
        payloadValue("task_id") ??
        payloadValue("taskId") ??
        payloadValue("taskID");
      const merged = [
        ...(Array.isArray(linkedTaskIds) ? linkedTaskIds : []),
        ...payloadArray("task_ids"),
        ...payloadArray("taskIds"),
        ...payloadArray("taskIDs"),
        ...(singleTaskId ? [singleTaskId] : []),
      ];
      return [...new Set(merged)];
    };
    return approvals.filter((approval) =>
      taskIdsForApproval(approval).includes(taskId),
    );
  }, [approvals, selectedTask]);

  const workingAgentIds = useMemo(() => {
    const working = new Set<string>();
    tasks.forEach((task) => {
      if (task.status === "in_progress" && task.assigned_agent_id) {
        working.add(task.assigned_agent_id);
      }
    });
    return working;
  }, [tasks]);

  const sortedAgents = useMemo(() => {
    const rank = (agent: Agent) => {
      if (workingAgentIds.has(agent.id)) return 0;
      if (agent.status === "online") return 1;
      if (agent.status === "provisioning") return 2;
      return 3;
    };
    return [...agents].sort((a, b) => {
      const diff = rank(a) - rank(b);
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name);
    });
  }, [agents, workingAgentIds]);

  const boardLead = useMemo(
    () => agents.find((agent) => agent.is_board_lead) ?? null,
    [agents],
  );
  const isBoardLeadProvisioning = boardLead?.status === "provisioning";

  const loadComments = useCallback(
    async (taskId: string) => {
      if (!isSignedIn || !boardId) return;
      setIsCommentsLoading(true);
      setCommentsError(null);
      try {
        const result =
          await listTaskCommentsApiV1BoardsBoardIdTasksTaskIdCommentsGet(
            boardId,
            taskId,
          );
        if (result.status !== 200) throw new Error("Unable to load comments.");
        setComments(mergeCommentsById(result.data.items ?? []));
      } catch (err) {
        setCommentsError(
          err instanceof Error ? err.message : "Something went wrong.",
        );
      } finally {
        setIsCommentsLoading(false);
      }
    },
    [boardId, isSignedIn],
  );

  const openComments = useCallback(
    (
      task: { id: string },
      options?: {
        preserveCommentTarget?: boolean;
      },
    ) => {
      setIsChatOpen(false);
      setIsLiveFeedOpen(false);
      const fullTask = tasksRef.current.find((item) => item.id === task.id);
      if (!fullTask) return;
      const preserveCommentTarget = options?.preserveCommentTarget === true;
      const currentTaskIdFromUrl = searchParams.get("taskId");
      const currentCommentIdFromUrl = searchParams.get("commentId");
      const targetCommentId = preserveCommentTarget
        ? currentCommentIdFromUrl
        : null;
      if (
        currentTaskIdFromUrl !== fullTask.id ||
        currentCommentIdFromUrl !== targetCommentId
      ) {
        router.replace(
          buildUrlWithTaskAndComment(fullTask.id, targetCommentId),
          {
            scroll: false,
          },
        );
      }
      selectedTaskIdRef.current = fullTask.id;
      setSelectedTask(fullTask);
      setIsDetailOpen(true);
      void loadComments(task.id);
    },
    [buildUrlWithTaskAndComment, loadComments, router, searchParams],
  );

  const selectedTaskDependencies = useMemo<DependencyBannerDependency[]>(() => {
    if (!selectedTask) return [];
    const blockedDependencyIds = new Set(
      selectedTask.blocked_by_task_ids ?? [],
    );
    return (selectedTask.depends_on_task_ids ?? []).map((dependencyId) => {
      const dependencyTask = taskById.get(dependencyId);
      const statusLabel = dependencyTask?.status
        ? dependencyTask.status.replace(/_/g, " ")
        : "unknown";
      return {
        id: dependencyId,
        title: dependencyTask?.title ?? dependencyId,
        statusLabel,
        isBlocking: blockedDependencyIds.has(dependencyId),
        isDone: dependencyTask?.status === "done",
        disabled: !dependencyTask,
        onClick: dependencyTask
          ? () => {
              openComments({ id: dependencyId });
            }
          : undefined,
      };
    });
  }, [openComments, selectedTask, taskById]);

  const selectedTaskResolvedDependencies = useMemo<
    DependencyBannerDependency[]
  >(() => {
    if (!selectedTask) return [];
    return tasks
      .filter((task) => task.depends_on_task_ids?.includes(selectedTask.id))
      .map((task) => {
        const statusLabel = task.status
          ? task.status.replace(/_/g, " ")
          : "unknown";
        return {
          id: task.id,
          title: task.title,
          statusLabel,
          isBlocking: false,
          isDone: task.status === "done",
          onClick: () => {
            openComments({ id: task.id });
          },
          disabled: false,
        };
      });
  }, [openComments, selectedTask, tasks]);

  useEffect(() => {
    if (!hasLoadedBoardSnapshot) return;
    if (!taskIdFromUrl) {
      openedTaskIdFromUrlRef.current = null;
      return;
    }
    if (openedTaskIdFromUrlRef.current === taskIdFromUrl) return;
    const exists = tasks.some((task) => task.id === taskIdFromUrl);
    if (!exists) {
      router.replace(buildUrlWithTaskAndComment(null, null), {
        scroll: false,
      });
      return;
    }
    openedTaskIdFromUrlRef.current = taskIdFromUrl;
    openComments({ id: taskIdFromUrl }, { preserveCommentTarget: true });
  }, [
    hasLoadedBoardSnapshot,
    buildUrlWithTaskAndComment,
    openComments,
    router,
    taskIdFromUrl,
    tasks,
  ]);

  useEffect(() => {
    if (!hasLoadedBoardSnapshot) return;
    if (panelFromUrl !== "chat") {
      openedPanelFromUrlRef.current = null;
      return;
    }
    if (openedPanelFromUrlRef.current === "chat") return;
    openedPanelFromUrlRef.current = "chat";
    setIsDetailOpen(false);
    selectedTaskIdRef.current = null;
    setSelectedTask(null);
    setComments([]);
    setCommentsError(null);
    setPostCommentError(null);
    setIsLiveFeedOpen(false);
    setIsChatOpen(true);
  }, [hasLoadedBoardSnapshot, panelFromUrl]);

  useEffect(() => {
    if (!isDetailOpen || !commentIdFromUrl) {
      setHighlightedCommentId(null);
      return;
    }
    const target = comments.find((comment) => comment.id === commentIdFromUrl);
    if (!target) return;

    setHighlightedCommentId(target.id);
    const scrollTimer = window.setTimeout(() => {
      const element = document.getElementById(commentElementId(target.id));
      if (!element) return;
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
    const clearTimer = window.setTimeout(() => {
      setHighlightedCommentId((current) =>
        current === target.id ? null : current,
      );
    }, 4_000);
    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearTimer);
    };
  }, [commentIdFromUrl, comments, isDetailOpen]);

  const closeComments = useCallback(() => {
    openedTaskIdFromUrlRef.current = null;
    if (searchParams.get("taskId") || searchParams.get("commentId")) {
      router.replace(buildUrlWithTaskAndComment(null, null), {
        scroll: false,
      });
    }
    setIsDetailOpen(false);
    selectedTaskIdRef.current = null;
    setSelectedTask(null);
    setHighlightedCommentId(null);
    setComments([]);
    setCommentsError(null);
    setPostCommentError(null);
    setIsEditDialogOpen(false);
  }, [buildUrlWithTaskAndComment, router, searchParams]);

  const openBoardChat = useCallback(() => {
    if (isDetailOpen) {
      closeComments();
    }
    setIsLiveFeedOpen(false);
    setIsChatOpen(true);
    if (
      panelFromUrl !== "chat" ||
      taskIdFromUrl ||
      commentIdFromUrl
    ) {
      startTransition(() => {
        router.replace(buildUrlWithTaskAndComment(null, null, "chat"), {
          scroll: false,
        });
      });
    }
  }, [
    buildUrlWithTaskAndComment,
    commentIdFromUrl,
    closeComments,
    isDetailOpen,
    panelFromUrl,
    router,
    taskIdFromUrl,
  ]);

  const closeBoardChat = useCallback(() => {
    setIsChatOpen(false);
    if (panelFromUrl === "chat") {
      startTransition(() => {
        router.replace(buildUrlWithTaskAndComment(null, null, null), {
          scroll: false,
        });
      });
    }
  }, [buildUrlWithTaskAndComment, panelFromUrl, router]);

  const handleBoardChatError = useCallback(
    (message: string) => {
      pushToast(message);
    },
    [pushToast],
  );

  const openLiveFeed = () => {
    if (isDetailOpen) {
      closeComments();
    }
    if (isChatOpen) {
      closeBoardChat();
    }
    setIsLiveFeedOpen(true);
  };

  const closeLiveFeed = () => {
    setIsLiveFeedOpen(false);
  };

  const handlePostComment = async (message: string): Promise<boolean> => {
    if (!selectedTask || !boardId || !isSignedIn) return false;
    const trimmed = message.trim();
    if (!trimmed) {
      setPostCommentError("Write a message before sending.");
      return false;
    }
    setIsPostingComment(true);
    setPostCommentError(null);
    try {
      const result =
        await createTaskCommentApiV1BoardsBoardIdTasksTaskIdCommentsPost(
          boardId,
          selectedTask.id,
          { message: trimmed },
        );
      if (result.status !== 200) throw new Error("Unable to send message.");
      const created = result.data;
      setComments((prev) => mergeCommentsById([created], prev));
      return true;
    } catch (err) {
      const message = formatActionError(err, "Unable to send message.");
      setPostCommentError(message);
      pushToast(message);
      return false;
    } finally {
      setIsPostingComment(false);
    }
  };

  const handleTaskMove = useCallback(
    async (taskId: string, status: TaskStatus) => {
      if (!isSignedIn || !boardId) return;
      const currentTask = tasksRef.current.find((task) => task.id === taskId);
      if (!currentTask || currentTask.status === status) return;
      if (currentTask.is_blocked && status !== "inbox") {
        setError("Task is blocked by incomplete dependencies.");
        return;
      }
      const previousTasks = tasksRef.current;
      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId
            ? {
                ...task,
                status,
                assigned_agent_id:
                  status === "inbox" ? null : task.assigned_agent_id,
                assignee: status === "inbox" ? null : task.assignee,
              }
            : task,
        ),
      );
      try {
        const result = await updateTaskApiV1BoardsBoardIdTasksTaskIdPatch(
          boardId,
          taskId,
          { status },
        );
        if (result.status === 409) {
          const blockedIds = result.data.detail.blocked_by_task_ids ?? [];
          const blockedTitles = blockedIds
            .map((id) => taskTitleById.get(id) ?? id)
            .join(", ");
          throw new Error(
            blockedTitles
              ? `${result.data.detail.message} Blocked by: ${blockedTitles}`
              : result.data.detail.message,
          );
        }
        if (result.status === 422) {
          throw new Error(
            result.data.detail?.[0]?.msg ??
              "Validation error while moving task.",
          );
        }
        const assignee = result.data.assigned_agent_id
          ? (agentsRef.current.find(
              (agent) => agent.id === result.data.assigned_agent_id,
            )?.name ?? null)
          : null;
        const updated = normalizeTask({
          ...currentTask,
          ...result.data,
          assignee,
          approvals_count: currentTask.approvals_count,
          approvals_pending_count: currentTask.approvals_pending_count,
        } as TaskCardRead);
        setTasks((prev) =>
          prev.map((task) =>
            task.id === updated.id ? { ...task, ...updated } : task,
          ),
        );
      } catch (err) {
        setTasks(previousTasks);
        const message = formatActionError(err, "Unable to move task.");
        setError(message);
        pushToast(message);
      }
    },
    [boardId, isSignedIn, pushToast, taskTitleById],
  );

  const agentInitials = (agent: Agent) =>
    agent.name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();

  const resolveEmoji = (value?: string | null) => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (AGENT_EMOJI_GLYPHS[trimmed]) return AGENT_EMOJI_GLYPHS[trimmed];
    if (trimmed.startsWith(":") && trimmed.endsWith(":")) return null;
    return trimmed;
  };

  const agentAvatarLabel = (agent: Agent) => {
    if (agent.is_board_lead) return "⚙️";
    let emojiValue: string | null = null;
    if (agent.identity_profile && typeof agent.identity_profile === "object") {
      const rawEmoji = (agent.identity_profile as Record<string, unknown>)
        .emoji;
      emojiValue = typeof rawEmoji === "string" ? rawEmoji : null;
    }
    const emoji = resolveEmoji(emojiValue);
    return emoji ?? agentInitials(agent);
  };

  const agentRoleLabel = (agent: Agent) => {
    // Prefer the configured identity role from the API.
    if (agent.identity_profile && typeof agent.identity_profile === "object") {
      const rawRole = (agent.identity_profile as Record<string, unknown>).role;
      if (typeof rawRole === "string") {
        const trimmed = rawRole.trim();
        if (trimmed) return trimmed;
      }
    }
    if (agent.is_board_lead) return "Board lead";
    if (agent.is_gateway_main) return "Gateway main";
    return "Agent";
  };

  const formatTaskTimestamp = (value?: string | null) => {
    if (!value) return "—";
    const date = parseApiDatetime(value);
    if (!date) return "—";
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const statusBadgeClass = (value?: string) => {
    switch (value) {
      case "in_progress":
        return "bg-purple-100 text-purple-700";
      case "review":
        return "bg-indigo-100 text-indigo-700";
      case "done":
        return "bg-emerald-100 text-emerald-700";
      default:
        return "bg-slate-100 text-slate-600";
    }
  };

  const priorityBadgeClass = (value?: string) => {
    switch (value?.toLowerCase()) {
      case "high":
        return "bg-rose-100 text-rose-700";
      case "medium":
        return "bg-amber-100 text-amber-700";
      case "low":
        return "bg-emerald-100 text-emerald-700";
      default:
        return "bg-slate-100 text-slate-600";
    }
  };

  const handleApprovalDecision = useCallback(
    async (approvalId: string, status: "approved" | "rejected") => {
      if (!isSignedIn || !boardId) return;
      if (!canWrite) {
        pushToast(
          "Read-only access. You do not have permission to update approvals.",
        );
        return;
      }
      setApprovalsUpdatingId(approvalId);
      setApprovalsError(null);
      try {
        const result =
          await updateApprovalApiV1BoardsBoardIdApprovalsApprovalIdPatch(
            boardId,
            approvalId,
            { status },
          );
        if (result.status !== 200) {
          throw new Error("Unable to update approval.");
        }
        const updated = normalizeApproval(result.data);
        setApprovals((prev) =>
          prev.map((item) => (item.id === approvalId ? updated : item)),
        );
      } catch (err) {
        const message = formatActionError(err, "Unable to update approval.");
        setApprovalsError(message);
        pushToast(message);
      } finally {
        setApprovalsUpdatingId(null);
      }
    },
    [boardId, canWrite, isSignedIn, pushToast],
  );

  return (
    <DashboardShell>
      <SignedOut>
        <div className="flex h-full flex-col items-center justify-center gap-4 rounded-2xl surface-panel p-10 text-center">
          <p className="text-sm text-muted">Sign in to view boards.</p>
          <SignInButton
            mode="modal"
            forceRedirectUrl="/boards"
            signUpForceRedirectUrl="/boards"
          >
            <Button>Sign in</Button>
          </SignInButton>
        </div>
      </SignedOut>
      <SignedIn>
        <DashboardSidebar />
        <main
          className={cn(
            "flex-1 bg-gradient-to-br from-slate-50 to-slate-100",
            isSidePanelOpen ? "overflow-hidden" : "overflow-y-auto",
          )}
        >
          <div className="sticky top-0 z-30 border-b border-slate-200 bg-white shadow-sm">
            <div className="px-8 py-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="mt-2 text-2xl font-semibold text-slate-900 tracking-tight">
                    {board?.name ?? "Board"}
                  </h1>
                  <p className="mt-1 text-sm text-slate-500">
                    Keep tasks moving through your workflow.
                  </p>
                  {isBoardLeadProvisioning ? (
                    <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
                      <RefreshCcw className="h-3.5 w-3.5 animate-spin" />
                      <span>Provisioning board lead…</span>
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                    <button
                      className={cn(
                        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                        viewMode === "board"
                          ? "bg-slate-900 text-white"
                          : "text-slate-600 hover:bg-slate-200 hover:text-slate-900",
                      )}
                      onClick={() => setViewMode("board")}
                    >
                      Board
                    </button>
                    <button
                      className={cn(
                        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                        viewMode === "list"
                          ? "bg-slate-900 text-white"
                          : "text-slate-600 hover:bg-slate-200 hover:text-slate-900",
                      )}
                      onClick={() => setViewMode("list")}
                    >
                      List
                    </button>
                  </div>
                  <Button
                    onClick={() => setIsDialogOpen(true)}
                    className="h-9 w-9 p-0"
                    aria-label="New task"
                    title={canWrite ? "New task" : "Read-only access"}
                    disabled={!canWrite}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => router.push(`/boards/${boardId}/approvals`)}
                    className="relative h-9 w-9 p-0"
                    aria-label="Approvals"
                    title="Approvals"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    {pendingApprovals.length > 0 ? (
                      <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        {pendingApprovals.length}
                      </span>
                    ) : null}
                  </Button>
                  {isOrgAdmin ? (
                    <Button
                      variant="outline"
                      onClick={() =>
                        openAgentsControlDialog(
                          isAgentsPaused ? "resume" : "pause",
                        )
                      }
                      disabled={
                        !isSignedIn ||
                        !boardId ||
                        !canWrite
                      }
                      className={cn(
                        "h-9 w-9 p-0",
                        isAgentsPaused
                          ? "border-amber-200 bg-amber-50/60 text-amber-700 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800"
                          : "",
                      )}
                      aria-label={
                        isAgentsPaused ? "Resume agents" : "Pause agents"
                      }
                      title={
                        canWrite
                          ? isAgentsPaused
                            ? "Resume agents"
                            : "Pause agents"
                          : "Read-only access"
                      }
                    >
                      {isAgentsPaused ? (
                        <Play className="h-4 w-4" />
                      ) : (
                        <Pause className="h-4 w-4" />
                      )}
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    onClick={openBoardChat}
                    className="h-9 w-9 p-0"
                    aria-label="Board chat"
                    title="Board chat"
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={openLiveFeed}
                    className="h-9 w-9 p-0"
                    aria-label="Live feed"
                    title="Live feed"
                  >
                    <Activity className="h-4 w-4" />
                  </Button>
                  {isOrgAdmin ? (
                    <button
                      type="button"
                      onClick={() => router.push(`/boards/${boardId}/edit`)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                      aria-label="Board settings"
                      title="Board settings"
                    >
                      <Settings className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="relative flex gap-6 p-6">
            {isOrgAdmin ? (
              <aside className="flex h-full w-64 flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Agents
                    </p>
                    <p className="text-xs text-slate-400">
                      {sortedAgents.length} total
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push("/agents/new")}
                    className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    Add
                  </button>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto p-3">
                  {sortedAgents.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 p-3 text-xs text-slate-500">
                      No agents assigned yet.
                    </div>
                  ) : (
                    sortedAgents.map((agent) => {
                      const isWorking = workingAgentIds.has(agent.id);
                      return (
                        <button
                          key={agent.id}
                          type="button"
                          className={cn(
                            "flex w-full items-center gap-3 rounded-lg border border-transparent px-2 py-2 text-left transition hover:border-slate-200 hover:bg-slate-50",
                          )}
                          onClick={() => router.push(`/agents/${agent.id}`)}
                        >
                          <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                            {agentAvatarLabel(agent)}
                            <StatusDot
                              status={agent.status}
                              variant="agent"
                              className={cn(
                                "absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-white",
                                isWorking && "ring-2 ring-emerald-200",
                              )}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-900">
                              {agent.name}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {agentRoleLabel(agent)}
                            </p>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </aside>
            ) : null}

            <div className="min-w-0 flex-1 space-y-6">
              {error && (
                <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600 shadow-sm">
                  {error}
                </div>
              )}

              {isLoading ? (
                <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-500">
                  Loading {titleLabel}…
                </div>
              ) : (
                <>
                  {viewMode === "list" ? (
                    <>
                      {groupSnapshotError ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 shadow-sm">
                          {groupSnapshotError}
                        </div>
                      ) : null}

                      {groupSnapshot?.group ? (
                        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                          <div className="border-b border-slate-200 px-5 py-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                  Related boards
                                </p>
                                <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                                  {groupSnapshot.group.name}
                                </p>
                                {groupSnapshot.group.description ? (
                                  <p className="mt-1 max-w-3xl text-xs text-slate-500 line-clamp-2">
                                    {groupSnapshot.group.description}
                                  </p>
                                ) : null}
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    router.push(
                                      `/board-groups/${groupSnapshot.group?.id}`,
                                    )
                                  }
                                  disabled={!groupSnapshot.group?.id}
                                >
                                  View group
                                </Button>
                                {isOrgAdmin ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      router.push(`/boards/${boardId}/edit`)
                                    }
                                    disabled={!boardId}
                                  >
                                    Settings
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                          <div className="px-5 py-4">
                            {groupSnapshot.boards &&
                            groupSnapshot.boards.length ? (
                              <div className="grid gap-4 md:grid-cols-2">
                                {groupSnapshot.boards.map((item) => (
                                  <div
                                    key={item.board.id}
                                    className="rounded-xl border border-slate-200 bg-slate-50/40 p-4"
                                  >
                                    <button
                                      type="button"
                                      className="group flex w-full items-start justify-between gap-3 text-left"
                                      onClick={() =>
                                        router.push(`/boards/${item.board.id}`)
                                      }
                                    >
                                      <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-slate-900 group-hover:text-blue-600">
                                          {item.board.name}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-500">
                                          Updated{" "}
                                          {formatTaskTimestamp(
                                            item.board.updated_at,
                                          )}
                                        </p>
                                      </div>
                                      <ArrowUpRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400 group-hover:text-blue-600" />
                                    </button>

                                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                                      <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-slate-700">
                                        Inbox {item.task_counts?.inbox ?? 0}
                                      </span>
                                      <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-slate-700">
                                        In progress{" "}
                                        {item.task_counts?.in_progress ?? 0}
                                      </span>
                                      <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-slate-700">
                                        Review {item.task_counts?.review ?? 0}
                                      </span>
                                    </div>

                                    {item.tasks && item.tasks.length ? (
                                      <ul className="mt-3 space-y-2">
                                        {item.tasks.slice(0, 3).map((task) => (
                                          <li
                                            key={task.id}
                                            className="rounded-lg border border-slate-200 bg-white p-3"
                                          >
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                              <div className="flex min-w-0 items-center gap-2">
                                                <span
                                                  className={cn(
                                                    "rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide",
                                                    statusBadgeClass(
                                                      task.status,
                                                    ),
                                                  )}
                                                >
                                                  {task.status.replace(
                                                    /_/g,
                                                    " ",
                                                  )}
                                                </span>
                                                <span
                                                  className={cn(
                                                    "rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide",
                                                    priorityBadgeClass(
                                                      task.priority,
                                                    ),
                                                  )}
                                                >
                                                  {task.priority}
                                                </span>
                                                <p className="truncate text-sm font-medium text-slate-900">
                                                  {task.title}
                                                </p>
                                              </div>
                                              <p className="text-xs text-slate-500">
                                                {formatTaskTimestamp(
                                                  task.updated_at,
                                                )}
                                              </p>
                                            </div>
                                            <p className="mt-2 truncate text-xs text-slate-600">
                                              Assignee:{" "}
                                              <span className="font-medium text-slate-900">
                                                {task.assignee ?? "Unassigned"}
                                              </span>
                                            </p>
                                            {task.tags?.length ? (
                                              <div className="mt-2 flex flex-wrap gap-1.5">
                                                {task.tags
                                                  .slice(0, 3)
                                                  .map((tag) => (
                                                    <span
                                                      key={tag.id}
                                                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700"
                                                    >
                                                      <span
                                                        className="h-1.5 w-1.5 rounded-full"
                                                        style={{
                                                          backgroundColor: `#${normalizeTagColor(
                                                            tag.color,
                                                          )}`,
                                                        }}
                                                      />
                                                      {tag.name}
                                                    </span>
                                                  ))}
                                              </div>
                                            ) : null}
                                          </li>
                                        ))}
                                        {item.tasks.length > 3 ? (
                                          <li className="text-xs text-slate-500">
                                            +{item.tasks.length - 3} more…
                                          </li>
                                        ) : null}
                                      </ul>
                                    ) : (
                                      <p className="mt-3 text-sm text-slate-500">
                                        No tasks in this snapshot.
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-slate-500">
                                No other boards in this group yet.
                              </p>
                            )}
                          </div>
                        </div>
                      ) : groupSnapshot ? (
                        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
                          <p className="font-semibold text-slate-900">
                            No board group configured
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            Assign this board to a group to give agents
                            visibility into related work.
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                router.push(`/boards/${boardId}/edit`)
                              }
                              disabled={!boardId}
                            >
                              Open settings
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => router.push("/board-groups")}
                            >
                              View groups
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : null}

                  {viewMode === "board" ? (
                    <TaskBoard
                      tasks={tasks}
                      onTaskSelect={openComments}
                      onTaskMove={canWrite ? handleTaskMove : undefined}
                      readOnly={!canWrite}
                      overlayEnabled={overlayEnabled}
                      queryState={boardQueryState}
                      onQueryStateChange={setBoardQueryState}
                    />
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                      <div className="border-b border-slate-200 px-5 py-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              All tasks
                            </p>
                            <p className="text-xs text-slate-500">
                              {tasks.length} tasks in this board
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsDialogOpen(true)}
                            disabled={!canWrite}
                            title={canWrite ? "New task" : "Read-only access"}
                          >
                            New task
                          </Button>
                        </div>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {tasks.length === 0 ? (
                          <div className="px-5 py-8 text-sm text-slate-500">
                            No tasks yet. Create your first task to get started.
                          </div>
                        ) : (
                          tasks.map((task) => (
                            <button
                              key={task.id}
                              type="button"
                              className="w-full px-5 py-4 text-left transition hover:bg-slate-50"
                              onClick={() => openComments(task)}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-slate-900">
                                    {task.title}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    {task.description
                                      ? task.description
                                          .toString()
                                          .trim()
                                          .slice(0, 120)
                                      : "No description"}
                                  </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                  {task.approvals_pending_count ? (
                                    <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                      Approval needed ·{" "}
                                      {task.approvals_pending_count}
                                    </span>
                                  ) : null}
                                  <span
                                    className={cn(
                                      "rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide",
                                      statusBadgeClass(task.status),
                                    )}
                                  >
                                    {task.status.replace(/_/g, " ")}
                                  </span>
                                  <span
                                    className={cn(
                                      "rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide",
                                      priorityBadgeClass(task.priority),
                                    )}
                                  >
                                    {task.priority}
                                  </span>
                                  {task.tags?.length ? (
                                    <div className="flex flex-wrap items-center gap-1">
                                      {task.tags.slice(0, 2).map((tag) => (
                                        <span
                                          key={tag.id}
                                          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700"
                                        >
                                          <span
                                            className="h-1.5 w-1.5 rounded-full"
                                            style={{
                                              backgroundColor: `#${normalizeTagColor(
                                                tag.color,
                                              )}`,
                                            }}
                                          />
                                          {tag.name}
                                        </span>
                                      ))}
                                      {task.tags.length > 2 ? (
                                        <span className="text-[10px] font-semibold text-slate-500">
                                          +{task.tags.length - 2}
                                        </span>
                                      ) : null}
                                    </div>
                                  ) : null}
                                  <span className="text-xs text-slate-500">
                                    {task.assignee ?? "Unassigned"}
                                  </span>
                                  <span className="text-xs text-slate-500">
                                    {formatTaskTimestamp(
                                      task.updated_at ?? task.created_at,
                                    )}
                                  </span>
                                </div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </main>
      </SignedIn>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-slate-900/20 transition-opacity duration-200 ease-out",
          isSidePanelOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
        onClick={() => {
          if (!isSidePanelOpen) return;
          if (isChatOpen) {
            closeBoardChat();
          } else if (isLiveFeedOpen) {
            closeLiveFeed();
          } else {
            closeComments();
          }
        }}
      />
      <TaskDetailPanel
        selectedTask={selectedTask}
        isDetailOpen={isDetailOpen}
        onClose={closeComments}
        onEditOpen={() => setIsEditDialogOpen(true)}
        canWrite={canWrite}
        comments={comments}
        highlightedCommentId={highlightedCommentId}
        isCommentsLoading={isCommentsLoading}
        commentsError={commentsError}
        isPostingComment={isPostingComment}
        postCommentError={postCommentError}
        onPostComment={handlePostComment}
        boardChatMentionSuggestions={boardChatMentionSuggestions}
        assigneeById={assigneeById}
        currentUserDisplayName={currentUserDisplayName}
        taskApprovals={taskApprovals}
        pendingApprovals={pendingApprovals}
        approvalsError={approvalsError}
        isApprovalsLoading={isApprovalsLoading}
        approvalsUpdatingId={approvalsUpdatingId}
        onApprovalDecision={handleApprovalDecision}
        selectedTaskDependencies={selectedTaskDependencies}
        selectedTaskResolvedDependencies={selectedTaskResolvedDependencies}
        boardCustomFieldDefinitions={boardCustomFieldDefinitions}
        selectedTaskCustomFieldValues={selectedTaskCustomFieldValues}
        customFieldDefinitionsLoading={customFieldDefinitionsQuery.isLoading}
        boardId={boardId}
        onNavigate={router.push}
      />

      <BoardChatPanel
        boardId={boardId}
        isOpen={isChatOpen}
        canWrite={canWrite}
        currentUserDisplayName={currentUserDisplayName}
        mentionSuggestions={boardChatMentionSuggestions}
        onClose={closeBoardChat}
        onMessageCreated={appendBoardChatMessage}
        onError={handleBoardChatError}
      />

      <LiveFeedPanel
        isOpen={isLiveFeedOpen}
        onClose={closeLiveFeed}
        liveFeed={liveFeed}
        liveFeedFlashIds={liveFeedFlashIds}
        isLiveFeedHistoryLoading={isLiveFeedHistoryLoading}
        liveFeedHistoryError={liveFeedHistoryError}
        agents={agents}
        taskTitleById={taskTitleById}
        currentUserDisplayName={currentUserDisplayName}
        agentAvatarLabel={agentAvatarLabel}
        agentRoleLabel={agentRoleLabel}
        onViewTask={(taskId) => openComments({ id: taskId })}
      />

      <TaskEditDialog
        isOpen={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        boardId={boardId}
        isSignedIn={Boolean(isSignedIn)}
        canWrite={canWrite}
        selectedTask={selectedTask}
        tasks={tasks}
        agents={agents}
        tags={tags}
        boardCustomFieldDefinitions={boardCustomFieldDefinitions}
        customFieldDefinitionsLoading={customFieldDefinitionsQuery.isLoading}
        assigneeById={assigneeById}
        onSaved={(updated) => {
          setTasks((prev) =>
            prev.map((task) =>
              task.id === updated.id ? { ...task, ...updated } : task,
            ),
          );
          setSelectedTask(updated);
        }}
        onDeleteOpen={() => setIsDeleteDialogOpen(true)}
        onError={pushToast}
        onNavigate={router.push}
      />

      <TaskDeleteDialog
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        boardId={boardId}
        isSignedIn={Boolean(isSignedIn)}
        canWrite={canWrite}
        selectedTask={selectedTask}
        onDeleted={(taskId) => {
          setTasks((prev) => prev.filter((task) => task.id !== taskId));
          closeComments();
        }}
        onError={pushToast}
      />

      <TaskCreateDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        boardId={boardId}
        isSignedIn={Boolean(isSignedIn)}
        canWrite={canWrite}
        tags={tags}
        boardCustomFieldDefinitions={boardCustomFieldDefinitions}
        customFieldDefinitionsLoading={customFieldDefinitionsQuery.isLoading}
        defaultCreateCustomFieldValues={defaultCreateCustomFieldValues}
        assigneeById={assigneeById}
        onTaskCreated={(task) => setTasks((prev) => [task, ...prev])}
        onError={pushToast}
        boardLabel={titleLabel}
        onNavigate={router.push}
      />

      {isOrgAdmin ? (
        <AgentsControlDialog
          isOpen={isAgentsControlDialogOpen}
          onOpenChange={setIsAgentsControlDialogOpen}
          action={agentsControlAction}
          onConfirmed={async () => {
            const command =
              agentsControlAction === "pause" ? "/pause" : "/resume";
            const result = await postBoardChatMessage(command);
            if (!result.ok) {
              pushToast(result.error ?? `Unable to send ${command} command.`);
            }
            return result;
          }}
        />
      ) : null}

      <BoardToasts toasts={toasts} onDismiss={dismissToast} />

      {/* onboarding moved to board settings */}
    </DashboardShell>
  );
}

export type QueryProfile = "static" | "interactive" | "realtime";

type RefetchOnMount = boolean | "always";
type RefetchOnWindowFocus = boolean | "always";

export type QueryPolicyOptions = {
  staleTime: number;
  gcTime: number;
  refetchOnWindowFocus: RefetchOnWindowFocus;
  refetchOnReconnect: boolean;
  refetchOnMount: RefetchOnMount;
  retry: number;
  refetchInterval?: number | false;
};

export const queryPolicies: Record<QueryProfile, QueryPolicyOptions> = {
  static: {
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: false,
    retry: 1,
  },
  interactive: {
    staleTime: 15_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
    retry: 1,
  },
  realtime: {
    staleTime: 0,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: "always",
    retry: 1,
  },
};

export const withQueryPolicy = (
  profile: QueryProfile,
  overrides: Partial<QueryPolicyOptions> = {},
): QueryPolicyOptions => ({
  ...queryPolicies[profile],
  ...overrides,
});

export const visibilityAwareInterval = (
  intervalMs: number,
  isPageActive: boolean,
): number | false => (isPageActive ? intervalMs : false);

const parseEnvBoolean = (
  value: string | undefined,
  fallback = false,
): boolean => {
  if (value == null) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const parseCsvSet = (value: string | undefined): Set<string> => {
  if (!value) return new Set();
  return new Set(
    value
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
};

const OVERLAY_DEFAULT_ENABLED = parseEnvBoolean(
  process.env.NEXT_PUBLIC_BOARD_PLANNING_OVERLAY_V1,
  false,
);
const OVERLAY_CANARY_BOARD_IDS = parseCsvSet(
  process.env.NEXT_PUBLIC_BOARD_PLANNING_OVERLAY_V1_CANARY_BOARD_IDS,
);
const OVERLAY_CANARY_ORG_IDS = parseCsvSet(
  process.env.NEXT_PUBLIC_BOARD_PLANNING_OVERLAY_V1_CANARY_ORG_IDS,
);

const QUERY_V2_DEFAULT_ENABLED = parseEnvBoolean(
  process.env.NEXT_PUBLIC_BOARD_QUERY_V2,
  false,
);
const QUERY_V2_CANARY_BOARD_IDS = parseCsvSet(
  process.env.NEXT_PUBLIC_BOARD_QUERY_V2_CANARY_BOARD_IDS,
);
const QUERY_V2_CANARY_ORG_IDS = parseCsvSet(
  process.env.NEXT_PUBLIC_BOARD_QUERY_V2_CANARY_ORG_IDS,
);

type BoardFlagContext = {
  boardId?: string | null;
  organizationId?: string | null;
};

const matchesCanary = (
  context: BoardFlagContext,
  boardIds: Set<string>,
  organizationIds: Set<string>,
): boolean => {
  const normalizedBoardId = context.boardId?.trim().toLowerCase();
  const normalizedOrganizationId = context.organizationId?.trim().toLowerCase();
  return Boolean(
    (normalizedBoardId && boardIds.has(normalizedBoardId)) ||
    (normalizedOrganizationId && organizationIds.has(normalizedOrganizationId)),
  );
};

export const isBoardOverlayEnabled = (context: BoardFlagContext): boolean => {
  if (OVERLAY_DEFAULT_ENABLED) return true;
  return matchesCanary(
    context,
    OVERLAY_CANARY_BOARD_IDS,
    OVERLAY_CANARY_ORG_IDS,
  );
};

export const isBoardQueryV2Enabled = (context: BoardFlagContext): boolean => {
  if (QUERY_V2_DEFAULT_ENABLED) return true;
  return matchesCanary(
    context,
    QUERY_V2_CANARY_BOARD_IDS,
    QUERY_V2_CANARY_ORG_IDS,
  );
};

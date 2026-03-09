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

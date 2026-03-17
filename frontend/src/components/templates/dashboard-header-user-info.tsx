"use client";

import { useAuth } from "@/auth/clerk";

import { ApiError } from "@/api/mutator";
import {
  type getMeApiV1UsersMeGetResponse,
  useGetMeApiV1UsersMeGet,
} from "@/api/generated/users/users";
import { UserMenu } from "@/components/organisms/UserMenu";
import { useBillingSubscription } from "@/lib/billing";
import { planLabelFromTier } from "@/lib/plan-labels";
import { withQueryPolicy } from "@/lib/query-policy";

/**
 * Isolated header section that subscribes to user profile + billing data.
 * Prevents re-rendering the entire DashboardShell when these queries update.
 */
export function DashboardHeaderUserInfo({
  isOnboardingPath,
}: {
  isOnboardingPath: boolean;
}) {
  const { isSignedIn } = useAuth();
  const enabled = Boolean(isSignedIn) && !isOnboardingPath;

  const meQuery = useGetMeApiV1UsersMeGet<
    getMeApiV1UsersMeGetResponse,
    ApiError
  >({
    query: {
      ...withQueryPolicy("interactive"),
      enabled,
      retry: false,
    },
  });

  const profile = meQuery.data?.status === 200 ? meQuery.data.data : null;
  const displayName = profile?.name ?? profile?.preferred_name ?? "Operator";
  const displayEmail = profile?.email ?? "";

  const billingQuery = useBillingSubscription(enabled);
  const currentPlanLabel = planLabelFromTier(billingQuery.data?.plan_tier);

  return (
    <div className="flex items-center gap-3 px-6">
      <div className="hidden text-right lg:block">
        <p className="text-sm font-semibold text-strong">{displayName}</p>
        <p className="text-xs text-muted">
          Current plan:{" "}
          <span className="font-medium text-[color:var(--text)]">
            {currentPlanLabel ?? "—"}
          </span>
        </p>
      </div>
      <UserMenu displayName={displayName} displayEmail={displayEmail} />
    </div>
  );
}

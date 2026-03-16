"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  Bot,
  Boxes,
  CheckCircle2,
  Folder,
  Building2,
  LayoutGrid,
  Lock,
  Settings,
  Store,
  Tags,
} from "lucide-react";

import { useAuth } from "@/auth/clerk";
import { ApiError } from "@/api/mutator";
import { useOrganizationMembership } from "@/lib/use-organization-membership";
import { usePageActive } from "@/hooks/usePageActive";
import { visibilityAwareInterval, withQueryPolicy } from "@/lib/query-policy";
import {
  type healthzHealthzGetResponse,
  useHealthzHealthzGet,
} from "@/api/generated/default/default";
import { Button } from "@/components/ui/button";
import { useBillingSubscription } from "@/lib/billing";
import { useOnboardingProgress } from "@/lib/onboarding";
import { cn } from "@/lib/utils";
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse";

export function DashboardSidebar() {
  const { collapsed } = useSidebarCollapse();
  const pathname = usePathname();
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const isPageActive = usePageActive();
  const { isAdmin } = useOrganizationMembership(isSignedIn);
  const subscriptionQuery = useBillingSubscription(Boolean(isSignedIn));
  const onboardingQuery = useOnboardingProgress(Boolean(isSignedIn));
  const healthQuery = useHealthzHealthzGet<healthzHealthzGetResponse, ApiError>(
    {
      query: {
        ...withQueryPolicy("interactive"),
        enabled: Boolean(isSignedIn),
        refetchInterval: visibilityAwareInterval(60_000, isPageActive),
        retry: false,
      },
    },
  );

  const okValue = healthQuery.data?.data?.ok;
  const systemStatus: "unknown" | "operational" | "degraded" =
    okValue === true
      ? "operational"
      : okValue === false
        ? "degraded"
        : healthQuery.isError
          ? "degraded"
          : "unknown";
  const statusLabel =
    systemStatus === "operational"
      ? "All systems operational"
      : systemStatus === "unknown"
        ? "System status unavailable"
        : "System degraded";

  const isBlockedForPayment = subscriptionQuery.data?.status === "blocked_for_payment";
  const onboardingProgress = onboardingQuery.data ?? null;
  const onboardingPending = Boolean(onboardingProgress && !onboardingProgress.completed);
  const createBoardReady =
    onboardingProgress?.steps.find((step) => step.key === "create_first_board")?.status !==
    "pending";
  const runChatReady =
    onboardingProgress?.steps.find((step) => step.key === "run_onboarding_chat")?.status !==
    "pending";
  const inviteReady =
    onboardingProgress?.steps.find((step) => step.key === "invite_teammate")?.status !== "pending";

  const lockedNavItem = (label: string) => (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-500">
      <span className="text-sm">{label}</span>
      <span className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide">
        <Lock className="h-3 w-3" />
        Locked
      </span>
    </div>
  );

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-slate-200 bg-white transition-[width,opacity] duration-300 ease-in-out",
        collapsed ? "w-0 overflow-hidden opacity-0" : "w-64 opacity-100",
      )}
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <p className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Navigation
        </p>
        <nav className="mt-3 space-y-4 text-sm">
          {onboardingPending ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p className="text-xs font-semibold text-blue-900">Onboarding in progress</p>
              <p className="mt-1 text-xs text-blue-800">
                Finish onboarding to unlock all modules.
              </p>
              <Link href="/onboarding">
                <Button size="sm" variant="outline" className="mt-2 w-full">
                  Continue onboarding
                </Button>
              </Link>
            </div>
          ) : null}
          <div>
            <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Overview
            </p>
            <div className="mt-1 space-y-1">
              <Link
                href="/dashboard"
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-700 transition",
                  pathname === "/dashboard"
                    ? "bg-blue-100 text-blue-800 font-medium"
                    : "hover:bg-slate-100",
                )}
              >
                <BarChart3 className="h-4 w-4" />
                Dashboard
              </Link>
              <Link
                href="/activity"
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-700 transition",
                  pathname.startsWith("/activity")
                    ? "bg-blue-100 text-blue-800 font-medium"
                    : "hover:bg-slate-100",
                )}
              >
                <Activity className="h-4 w-4" />
                Live feed
              </Link>
            </div>
          </div>

          <div>
            <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Boards
            </p>
            <div className="mt-1 space-y-1">
              {!onboardingPending || createBoardReady ? (
                <Link
                  href="/board-groups"
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-700 transition",
                    pathname.startsWith("/board-groups")
                      ? "bg-blue-100 text-blue-800 font-medium"
                      : "hover:bg-slate-100",
                  )}
                >
                  <Folder className="h-4 w-4" />
                  Board groups
                </Link>
              ) : (
                lockedNavItem("Board groups")
              )}
              <Link
                href="/boards"
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-700 transition",
                  pathname.startsWith("/boards")
                    ? "bg-blue-100 text-blue-800 font-medium"
                    : "hover:bg-slate-100",
                )}
              >
                <LayoutGrid className="h-4 w-4" />
                Boards
              </Link>
              {!onboardingPending || runChatReady ? (
                <>
                  <Link
                    href="/tags"
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-700 transition",
                      pathname.startsWith("/tags")
                        ? "bg-blue-100 text-blue-800 font-medium"
                        : "hover:bg-slate-100",
                    )}
                  >
                    <Tags className="h-4 w-4" />
                    Tags
                  </Link>
                  <Link
                    href="/approvals"
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-700 transition",
                      pathname.startsWith("/approvals")
                        ? "bg-blue-100 text-blue-800 font-medium"
                        : "hover:bg-slate-100",
                    )}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Approvals
                  </Link>
                </>
              ) : (
                <>
                  {lockedNavItem("Tags")}
                  {lockedNavItem("Approvals")}
                </>
              )}
              {isAdmin && (!onboardingPending || inviteReady) ? (
                <Link
                  href="/custom-fields"
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-700 transition",
                    pathname.startsWith("/custom-fields")
                      ? "bg-blue-100 text-blue-800 font-medium"
                      : "hover:bg-slate-100",
                  )}
                >
                  <Settings className="h-4 w-4" />
                  Custom fields
                </Link>
              ) : isAdmin ? (
                lockedNavItem("Custom fields")
              ) : null}
            </div>
          </div>

          <div>
            {isAdmin && (!onboardingPending || inviteReady) ? (
              <>
                <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Skills
                </p>
                <div className="mt-1 space-y-1">
                  <Link
                    href="/skills/marketplace"
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-700 transition",
                      pathname === "/skills" ||
                        pathname.startsWith("/skills/marketplace")
                        ? "bg-blue-100 text-blue-800 font-medium"
                        : "hover:bg-slate-100",
                    )}
                  >
                    <Store className="h-4 w-4" />
                    Marketplace
                  </Link>
                  <Link
                    href="/skills/packs"
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-700 transition",
                      pathname.startsWith("/skills/packs")
                        ? "bg-blue-100 text-blue-800 font-medium"
                        : "hover:bg-slate-100",
                    )}
                  >
                    <Boxes className="h-4 w-4" />
                    Packs
                  </Link>
                </div>
              </>
            ) : isAdmin ? (
              <div className="space-y-1">
                <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Skills
                </p>
                {lockedNavItem("Marketplace")}
                {lockedNavItem("Packs")}
              </div>
            ) : null}
          </div>

          <div>
            <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Administration
            </p>
            <div className="mt-1 space-y-1">
              <Link
                href="/organization"
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-700 transition",
                  pathname.startsWith("/organization")
                    ? "bg-blue-100 text-blue-800 font-medium"
                    : "hover:bg-slate-100",
                )}
              >
                <Building2 className="h-4 w-4" />
                Organization
              </Link>
              {/* Gateways tab hidden - auto-provisioned via OpenClaw */}
              {isAdmin ? (
                !onboardingPending || runChatReady ? (
                  <Link
                    href="/agents"
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-700 transition",
                      pathname.startsWith("/agents")
                        ? "bg-blue-100 text-blue-800 font-medium"
                        : "hover:bg-slate-100",
                    )}
                  >
                    <Bot className="h-4 w-4" />
                    Agents
                  </Link>
                ) : (
                  lockedNavItem("Agents")
                )
              ) : null}
              <Link
                href="/settings"
                className={cn(
                  "flex items-center rounded-lg px-3 py-2.5 text-slate-700 transition",
                  pathname.startsWith("/settings")
                    ? "bg-blue-100 text-blue-800 font-medium"
                    : "hover:bg-slate-100",
                )}
              >
                <span className="flex items-center gap-3">
                  <Settings className="h-4 w-4" />
                  Settings
                </span>
              </Link>
            </div>
          </div>
        </nav>
      </div>
      <div className="shrink-0 border-t border-slate-200 p-4">
        {isBlockedForPayment ? (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-semibold text-amber-900">Trial expired</p>
            <p className="mt-1 text-xs text-amber-800">
              Runtime actions are blocked. Upgrade to continue.
            </p>
            <Button
              type="button"
              className="mt-2 h-8 w-full"
              size="sm"
              onClick={() => router.push("/settings")}
            >
              Upgrade now
            </Button>
          </div>
        ) : null}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              systemStatus === "operational" && "bg-emerald-500",
              systemStatus === "degraded" && "bg-rose-500",
              systemStatus === "unknown" && "bg-slate-300",
            )}
          />
          {statusLabel}
        </div>
      </div>
    </aside>
  );
}

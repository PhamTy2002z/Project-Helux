"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { SignedIn } from "@/auth/clerk";

import { BrandMark } from "@/components/atoms/BrandMark";
import { OrgSwitcher } from "@/components/organisms/OrgSwitcher";
import { DashboardHeaderUserInfo } from "./dashboard-header-user-info";
import { useOnboardingGuard } from "./use-onboarding-guard";
import {
  SidebarCollapseProvider,
  useSidebarCollapse,
} from "@/hooks/useSidebarCollapse";

function ShellInner({ children }: { children: ReactNode }) {
  const { collapsed } = useSidebarCollapse();

  return (
    <div className="min-h-screen bg-app text-strong">
      <header className="sticky top-0 z-40 border-b border-[color:var(--border)] bg-[color:var(--surface)] shadow-sm">
        <div
          className="grid items-center gap-0 py-3 transition-[grid-template-columns] duration-300 ease-in-out"
          style={{
            gridTemplateColumns: collapsed ? "64px 1fr auto" : "260px 1fr auto",
          }}
        >
          <div className="flex items-center px-3">
            <BrandMark />
          </div>
          <SignedIn>
            <div className="flex items-center">
              <div className="max-w-[220px]">
                <OrgSwitcher />
              </div>
            </div>
          </SignedIn>
          <SignedIn>
            <div className="flex items-center gap-2 pr-4">
              <DashboardHeaderUserInfo isOnboardingPath={false} />
            </div>
          </SignedIn>
        </div>
      </header>
      <div
        className="grid h-[calc(100vh-64px)] bg-app transition-[grid-template-columns] duration-300 ease-in-out"
        style={{
          gridTemplateColumns: collapsed ? "0px 1fr" : "260px 1fr",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isOnboardingPath = pathname.startsWith("/onboarding");

  useOnboardingGuard(isOnboardingPath);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== "openclaw_org_switch" || !event.newValue) return;
      window.location.reload();
    };

    window.addEventListener("storage", handleStorage);

    let channel: BroadcastChannel | null = null;
    if ("BroadcastChannel" in window) {
      channel = new BroadcastChannel("org-switch");
      channel.onmessage = () => {
        window.location.reload();
      };
    }

    return () => {
      window.removeEventListener("storage", handleStorage);
      channel?.close();
    };
  }, []);

  return (
    <SidebarCollapseProvider>
      <ShellInner>{children}</ShellInner>
    </SidebarCollapseProvider>
  );
}

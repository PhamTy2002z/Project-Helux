"use client";

export const dynamic = "force-dynamic";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { useAuth, useUser } from "@/auth/clerk";
import { useQueryClient } from "@tanstack/react-query";
import {
  Globe,
  Mail,
  RotateCcw,
  Save,
  Shield,
  Trash2,
  User,
} from "lucide-react";

import {
  useDeleteMeApiV1UsersMeDelete,
  getGetMeApiV1UsersMeGetQueryKey,
  type getMeApiV1UsersMeGetResponse,
  useGetMeApiV1UsersMeGet,
  useUpdateMeApiV1UsersMePatch,
} from "@/api/generated/users/users";
import { useQuotaUsageApiV1MetricsQuotasGet } from "@/api/generated/metrics/metrics";
import { ApiError } from "@/api/mutator";
import { BillingSettingsSection } from "@/components/billing/billing-settings-section";
import { QuotaSummary } from "@/components/billing/quota-summary";
import { DashboardPageLayout } from "@/components/templates/DashboardPageLayout";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";
import { Input } from "@/components/ui/input";
import SearchableSelect from "@/components/ui/searchable-select";
import { withQueryPolicy } from "@/lib/query-policy";
import { getSupportedTimezones } from "@/lib/timezones";
import { cn } from "@/lib/utils";

type ClerkGlobal = {
  signOut?: (options?: { redirectUrl?: string }) => Promise<void> | void;
};

type SettingsSectionId = "account" | "billing" | "usage";

type SettingsSection = {
  id: SettingsSectionId;
  label: string;
  description: string;
};

const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: "account",
    label: "Account",
    description: "Profile, preferences, and account security.",
  },
  {
    id: "billing",
    label: "Billing & Subscription",
    description: "Review plan, invoices, and subscription operations.",
  },
  {
    id: "usage",
    label: "Usage",
    description: "Monitor current quota consumption across your workspace.",
  },
];

function UsageSection({ isSignedIn }: { isSignedIn: boolean }) {
  const quotaQuery = useQuotaUsageApiV1MetricsQuotasGet({
    query: { ...withQueryPolicy("interactive"), enabled: isSignedIn, retry: false },
  });
  const quotas = quotaQuery.data?.data?.quotas;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">Quota Usage</h2>
      <p className="mt-1 text-sm text-slate-500">
        Current resource consumption across your workspace.
      </p>
      {quotas?.length ? (
        <QuotaSummary quotas={quotas} className="mt-4 border-0 p-0" />
      ) : (
        <p className="mt-4 text-sm text-slate-400">No quota data available.</p>
      )}
    </section>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("billing");

  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState<string | null>(null);
  const [nameEdited, setNameEdited] = useState(false);
  const [timezoneEdited, setTimezoneEdited] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const meQuery = useGetMeApiV1UsersMeGet<
    getMeApiV1UsersMeGetResponse,
    ApiError
  >({
    query: {
      enabled: Boolean(isSignedIn),
      retry: false,
      refetchOnMount: "always",
    },
  });
  const meQueryKey = getGetMeApiV1UsersMeGetQueryKey();

  const profile = meQuery.data?.status === 200 ? meQuery.data.data : null;
  const displayEmail =
    profile?.email ?? user?.primaryEmailAddress?.emailAddress ?? "";
  const resolvedName = nameEdited
    ? name
    : (profile?.name ?? profile?.preferred_name ?? "");
  const resolvedTimezone = timezoneEdited
    ? (timezone ?? "")
    : (profile?.timezone ?? "");

  const timezones = useMemo(() => getSupportedTimezones(), []);
  const timezoneOptions = useMemo(
    () => timezones.map((value) => ({ value, label: value })),
    [timezones],
  );

  const updateMeMutation = useUpdateMeApiV1UsersMePatch<ApiError>({
    mutation: {
      onSuccess: async () => {
        setSaveError(null);
        setSaveSuccess("Settings saved.");
        await queryClient.invalidateQueries({ queryKey: meQueryKey });
      },
      onError: (error) => {
        setSaveSuccess(null);
        setSaveError(error.message || "Unable to save settings.");
      },
    },
  });

  const deleteAccountMutation = useDeleteMeApiV1UsersMeDelete<ApiError>({
    mutation: {
      onSuccess: async () => {
        setDeleteError(null);
        if (typeof window !== "undefined") {
          const clerk = (window as Window & { Clerk?: ClerkGlobal }).Clerk;
          if (clerk?.signOut) {
            try {
              await clerk.signOut({ redirectUrl: "/sign-in" });
              return;
            } catch {
              // Fall through to local redirect.
            }
          }
        }
        router.replace("/sign-in");
      },
      onError: (error) => {
        setDeleteError(error.message || "Unable to delete account.");
      },
    },
  });

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isSignedIn) return;
    if (!resolvedName.trim() || !resolvedTimezone.trim()) {
      setSaveSuccess(null);
      setSaveError("Name and timezone are required.");
      return;
    }
    setSaveError(null);
    setSaveSuccess(null);
    await updateMeMutation.mutateAsync({
      data: {
        name: resolvedName.trim(),
        timezone: resolvedTimezone.trim(),
      },
    });
  };

  const handleReset = () => {
    setName("");
    setTimezone(null);
    setNameEdited(false);
    setTimezoneEdited(false);
    setSaveError(null);
    setSaveSuccess(null);
  };

  const isSaving = updateMeMutation.isPending;

  return (
    <>
      <DashboardPageLayout
        signedOut={{
          message: "Sign in to manage your settings.",
          forceRedirectUrl: "/settings",
          signUpForceRedirectUrl: "/settings",
        }}
        title="Settings"
        description="Manage account, billing, security, and workspace controls."
      >
        <div className="space-y-6">
          {/* Tab switcher */}
          <nav className="flex gap-1 border-b border-slate-200">
            {SETTINGS_SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  "relative px-4 py-2.5 text-sm font-medium transition-colors",
                  activeSection === section.id
                    ? "text-slate-900 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-slate-900"
                    : "text-slate-500 hover:text-slate-700",
                )}
              >
                {section.label}
              </button>
            ))}
          </nav>

          {/* Account section: profile + danger zone */}
          {activeSection === "account" ? (
            <>
              <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-base font-semibold text-slate-900">Profile</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Keep your identity and preferences up to date.
                </p>

                <form onSubmit={handleSave} className="mt-6 space-y-5">
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                        <User className="h-4 w-4 text-slate-500" />
                        Name
                      </label>
                      <Input
                        value={resolvedName}
                        onChange={(event) => {
                          setName(event.target.value);
                          setNameEdited(true);
                        }}
                        placeholder="Your name"
                        disabled={isSaving}
                        className="border-slate-300 text-slate-900 focus-visible:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                        <Globe className="h-4 w-4 text-slate-500" />
                        Timezone
                      </label>
                      <SearchableSelect
                        ariaLabel="Select timezone"
                        value={resolvedTimezone}
                        onValueChange={(value) => {
                          setTimezone(value);
                          setTimezoneEdited(true);
                        }}
                        options={timezoneOptions}
                        placeholder="Select timezone"
                        searchPlaceholder="Search timezones..."
                        emptyMessage="No matching timezones."
                        disabled={isSaving}
                        triggerClassName="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                        contentClassName="rounded-xl border border-slate-200 shadow-lg"
                        itemClassName="px-4 py-3 text-sm text-slate-700 data-[selected=true]:bg-slate-50 data-[selected=true]:text-slate-900"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <Mail className="h-4 w-4 text-slate-500" />
                      Email
                    </label>
                    <Input
                      value={displayEmail}
                      readOnly
                      disabled
                      className="border-slate-200 bg-slate-50 text-slate-600"
                    />
                  </div>

                  {saveError ? (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                      {saveError}
                    </div>
                  ) : null}
                  {saveSuccess ? (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                      {saveSuccess}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-3">
                    <Button type="submit" disabled={isSaving}>
                      <Save className="h-4 w-4" />
                      {isSaving ? "Saving..." : "Save settings"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleReset}
                      disabled={isSaving}
                    >
                      <RotateCcw className="h-4 w-4" />
                      Reset
                    </Button>
                  </div>
                </form>
              </section>

              {/* Danger zone */}
              <section className="rounded-xl border border-rose-200 bg-rose-50/70 p-6 shadow-sm">
                <h2 className="flex items-center gap-2 text-base font-semibold text-rose-900">
                  <Shield className="h-4 w-4" />
                  Delete account
                </h2>
                <p className="mt-1 text-sm text-rose-800">
                  This permanently removes your FlowGrid account and related
                  personal data. This action cannot be undone.
                </p>
                <div className="mt-4">
                  <Button
                    type="button"
                    className="bg-rose-600 text-white hover:bg-rose-700"
                    onClick={() => {
                      setDeleteError(null);
                      setDeleteDialogOpen(true);
                    }}
                    disabled={deleteAccountMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete account
                  </Button>
                </div>
              </section>
            </>
          ) : null}

          {/* Billing section */}
          {activeSection === "billing" ? (
            <BillingSettingsSection isSignedIn={Boolean(isSignedIn)} />
          ) : null}

          {/* Usage section */}
          {activeSection === "usage" ? (
            <UsageSection isSignedIn={Boolean(isSignedIn)} />
          ) : null}
        </div>
      </DashboardPageLayout>

      <ConfirmActionDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete your account?"
        description="Your account and personal data will be permanently deleted."
        onConfirm={() => deleteAccountMutation.mutate()}
        isConfirming={deleteAccountMutation.isPending}
        errorMessage={deleteError}
        confirmLabel="Delete account"
        confirmingLabel="Deleting account..."
        ariaLabel="Delete account confirmation"
      />
    </>
  );
}

"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { CheckCircle2, Loader2, Mail } from "lucide-react";

import { SignInButton, SignedIn, SignedOut, useAuth } from "@/auth/clerk";

import { ApiError } from "@/api/mutator";
import { useAcceptOrgInviteApiV1OrganizationsInvitesAcceptPost } from "@/api/generated/organizations/organizations";

function InviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSignedIn } = useAuth();

  const tokenFromQuery = (searchParams.get("token") ?? "").trim();
  const [token, setToken] = useState(tokenFromQuery);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    setToken(tokenFromQuery);
  }, [tokenFromQuery]);

  const acceptInviteMutation =
    useAcceptOrgInviteApiV1OrganizationsInvitesAcceptPost<ApiError>({
      mutation: {
        onSuccess: (result) => {
          if (result.status === 200) {
            setAccepted(true);
            setError(null);
            setTimeout(() => router.push("/organization"), 800);
          }
        },
        onError: (err) => {
          setError(err.message || "Unable to accept invite.");
        },
      },
    });

  const handleAccept = (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!isSignedIn) return;
    const trimmed = token.trim();
    if (!trimmed) {
      setError("Invite token is required.");
      return;
    }
    setError(null);
    acceptInviteMutation.mutate({ data: { token: trimmed } });
  };

  const isSubmitting = acceptInviteMutation.isPending;
  const isReady = Boolean(token.trim());
  const helperText = useMemo(() => {
    if (accepted) {
      return "Invite accepted. Redirecting to your organization\u2026";
    }
    if (!token.trim()) {
      return "Paste the invite token or open the invite link you were sent.";
    }
    return "Accept the invite to join the organization.";
  }, [accepted, token]);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-black text-white">
      {/* Background gradient blurs — matches sign-in page */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -left-28 top-20 h-72 w-72 rounded-full bg-[rgba(255,91,53,0.2)] blur-3xl" />
        <div className="absolute -right-24 bottom-20 h-80 w-80 rounded-full bg-[rgba(56,189,248,0.18)] blur-3xl" />
      </div>

      <main className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-12 sm:px-6 lg:px-10">
        <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(420px,460px)] lg:items-center">
          {/* Left: context */}
          <section className="space-y-6">
            <Link
              href="/"
              prefetch={false}
              className="inline-flex min-h-[44px] items-center rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Back to Home
            </Link>
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/55">
                FlowGrid
              </p>
              <h1 className="text-balance font-[var(--font-display)] text-4xl leading-tight text-white sm:text-5xl">
                You&apos;re Invited to Join a Team.
              </h1>
              <p className="max-w-xl text-base leading-relaxed text-white/70 sm:text-lg">
                Sign in and accept your invite to start collaborating on boards, approvals, and workflows.
              </p>
            </div>
            <ul className="space-y-3">
              {[
                "Sign in or create an account to continue.",
                "Accept the invite to join the organization.",
                "Start collaborating on shared boards instantly.",
              ].map((step) => (
                <li key={step} className="flex items-start gap-3 text-sm text-white/75 sm:text-base">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-white/80" aria-hidden="true" />
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Right: invite card */}
          <section className="rounded-3xl border border-white/15 bg-white/[0.04] p-6 backdrop-blur-sm sm:p-8">
            <div className="mb-6 flex items-center gap-3">
              <Image
                src="/images/brand/flowgrid-favicon.svg"
                alt="FlowGrid logo"
                width={36}
                height={36}
                className="h-9 w-9"
              />
              <div>
                <p className="text-sm font-semibold text-white">Organization Invite</p>
                <p className="text-xs text-white/50">{helperText}</p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label
                  htmlFor="invite-token"
                  className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-white/55"
                >
                  Invite Token
                </label>
                <input
                  id="invite-token"
                  type="text"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  placeholder="Paste invite token"
                  disabled={accepted || isSubmitting}
                  className="h-11 w-full rounded-xl border border-white/15 bg-white/[0.03] px-4 text-sm text-white placeholder:text-white/40 focus:outline-none disabled:opacity-50"
                />
              </div>

              {error ? (
                <div className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-300">
                  {error}
                </div>
              ) : null}

              {accepted ? (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">
                  <CheckCircle2 size={16} />
                  Invite accepted. Redirecting&hellip;
                </div>
              ) : null}

              <SignedOut>
                <div className="flex flex-col gap-3 rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-4">
                  <div className="flex items-center gap-2 text-sm text-white/60">
                    <Mail size={16} className="shrink-0" />
                    <span>Sign in to accept your invite.</span>
                  </div>
                  <SignInButton mode="modal" forceRedirectUrl={`/invite${token ? `?token=${encodeURIComponent(token)}` : ""}`}>
                    <button
                      type="button"
                      className="h-11 w-full cursor-pointer rounded-xl border border-white/20 bg-white text-sm font-semibold text-black transition-colors hover:bg-white/90"
                    >
                      Sign in
                    </button>
                  </SignInButton>
                </div>
              </SignedOut>

              <SignedIn>
                <form
                  className="flex flex-col gap-3"
                  onSubmit={handleAccept}
                >
                  <button
                    type="submit"
                    disabled={!isReady || isSubmitting || accepted}
                    className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/20 bg-white text-sm font-semibold text-black transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Accepting&hellip;
                      </>
                    ) : accepted ? (
                      "Invite accepted"
                    ) : (
                      "Accept invite"
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push("/")}
                    disabled={isSubmitting}
                    className="h-11 w-full cursor-pointer rounded-xl bg-transparent text-sm font-medium text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
                  >
                    Go back
                  </button>
                </form>
              </SignedIn>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense
      fallback={
        <div className="relative min-h-screen overflow-x-hidden bg-black text-white">
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div className="absolute -left-28 top-20 h-72 w-72 rounded-full bg-[rgba(255,91,53,0.2)] blur-3xl" />
            <div className="absolute -right-24 bottom-20 h-80 w-80 rounded-full bg-[rgba(56,189,248,0.18)] blur-3xl" />
          </div>
          <main className="relative flex min-h-screen items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-white/60">
              <Loader2 size={18} className="animate-spin" />
              Loading invite&hellip;
            </div>
          </main>
        </div>
      }
    >
      <InviteContent />
    </Suspense>
  );
}

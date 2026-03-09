"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ScrollReveal } from "./scroll-reveal";

const FEATURE_SPOTLIGHTS = [
  {
    id: "boards",
    eyebrow: "Execution clarity",
    title: "Plan and run board operations without context switching",
    description:
      "Coordinate tasks, approvals, and delivery updates in one surface where operators and agents work from the same source of truth.",
    ctaLabel: "Open Boards",
    ctaHref: "/boards",
    placeholderTitle: "Board workspace preview",
    placeholderHint: "Replace with your board screenshot or walkthrough video",
  },
  {
    id: "agents",
    eyebrow: "Autonomous workflows",
    title: "Ship faster with agent execution that stays reviewable",
    description:
      "Delegate implementation, testing, and follow-up actions while preserving explicit review checkpoints for every critical decision.",
    ctaLabel: "Explore Agents",
    ctaHref: "/agents",
    placeholderTitle: "Agent run timeline",
    placeholderHint: "Replace with your agent activity screenshot or demo clip",
  },
  {
    id: "gateways",
    eyebrow: "Distributed control",
    title: "Operate gateways, environments, and routing from one console",
    description:
      "Track activation health, provisioning states, and remote runtime connectivity with full auditability across every connected node.",
    ctaLabel: "Manage Gateways",
    ctaHref: "/gateways",
    placeholderTitle: "Gateway operations panel",
    placeholderHint: "Replace with your gateway dashboard screenshot or video",
  },
  {
    id: "approvals",
    eyebrow: "Governance built-in",
    title: "Keep approvals and audit trails inside the execution loop",
    description:
      "Move sensitive actions through clear approval gates and preserve traceability from request to resolution in one timeline.",
    ctaLabel: "Start Onboarding",
    ctaHref: "/onboarding",
    placeholderTitle: "Approval and audit stream",
    placeholderHint: "Replace with your approval flow screenshot or recording",
  },
];

export default function FeatureCards() {
  return (
    <section id="features" className="relative overflow-hidden bg-black px-[5%] py-24">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/4 h-72 w-72 rounded-full bg-white/[0.06] blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-white/[0.05] blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl">
        <ScrollReveal className="mb-14 text-center">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-white/45">
            Core capabilities
          </p>
          <h2
            className="text-balance text-white"
            style={{ fontSize: "clamp(28px, 4vw, 56px)" }}
          >
            One platform for every operational surface
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-balance text-sm leading-relaxed text-white/55 md:text-base">
            Cursor-inspired feature spotlight layout with media placeholders.
            Swap each placeholder with your final screenshot or video.
          </p>
        </ScrollReveal>

        <div className="space-y-6">
          {FEATURE_SPOTLIGHTS.map((feature, index) => {
            const textPanel = (
              <div className="flex h-full flex-col justify-center p-7 md:p-10">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/45">
                  {feature.eyebrow}
                </p>
                <h3 className="mt-3 text-balance text-2xl font-semibold leading-tight text-white md:text-3xl">
                  {feature.title}
                </h3>
                <p className="mt-4 text-sm leading-relaxed text-white/65 md:text-base">
                  {feature.description}
                </p>
                <Link
                  href={feature.ctaHref}
                  className="mt-7 inline-flex w-fit items-center gap-2 text-sm font-medium text-[#f97316] transition-colors hover:text-[#fb923c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                >
                  {feature.ctaLabel}
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
            );

            const mediaPanel = (
              <div className="relative h-full min-h-[280px] p-4 md:p-6">
                <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
                    <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
                    <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
                  </div>
                  <div className="flex flex-1 flex-col rounded-xl border border-dashed border-white/20 bg-black/35 p-4">
                    <p className="text-sm font-semibold text-white/90">
                      {feature.placeholderTitle}
                    </p>
                    <p className="mt-2 max-w-sm text-xs leading-relaxed text-white/55">
                      {feature.placeholderHint}
                    </p>
                    <div className="mt-5 grid flex-1 grid-cols-2 gap-3">
                      <div className="rounded-lg border border-white/10 bg-white/[0.04]" />
                      <div className="rounded-lg border border-white/10 bg-white/[0.03]" />
                      <div className="rounded-lg border border-white/10 bg-white/[0.03]" />
                      <div className="rounded-lg border border-white/10 bg-white/[0.04]" />
                    </div>
                  </div>
                </div>
              </div>
            );

            const textFirst = index % 2 === 0;

            return (
              <ScrollReveal key={feature.title} delay={index * 0.1}>
                <article className="group overflow-hidden rounded-[30px] border border-white/12 bg-[#12110e] shadow-[0_16px_45px_rgba(0,0,0,0.4)] transition-colors duration-300 hover:border-white/20">
                  <div className="grid lg:grid-cols-[1.05fr_1.25fr]">
                    {textFirst ? (
                      <>
                        {textPanel}
                        {mediaPanel}
                      </>
                    ) : (
                      <>
                        {mediaPanel}
                        {textPanel}
                      </>
                    )}
                  </div>
                </article>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

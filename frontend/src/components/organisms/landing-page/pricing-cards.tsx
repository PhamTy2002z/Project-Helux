"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ScrollReveal } from "./scroll-reveal";

type BillingPeriod = "monthly" | "annual";

type PlanPrice =
  | { type: "free"; label: string }
  | {
      type: "paid";
      monthly: number;
      annual: number;
      unit?: string; /* e.g. "/seat" */
    };

type Plan = {
  name: string;
  pricing: PlanPrice;
  priceNote: { monthly: string; annual: string };
  bestFor: string;
  intro: string;
  features: string[];
  cta: { label: string; href: string };
  highlighted: boolean;
  disabled: boolean;
};

const INDIVIDUAL_PLANS: Plan[] = [
  {
    name: "Basic",
    pricing: { type: "free", label: "Free" },
    priceNote: { monthly: "No cost to start", annual: "No cost to start" },
    bestFor: "Solo builders validating their first board workflow",
    intro: "Includes:",
    features: [
      "No credit card required",
      "1 board group, 1 board",
      "3 agents, 3 per board",
      "20M trial tokens, ~500 runs / day",
      "8k tokens per run",
    ],
    cta: { label: "Get Started", href: "/onboarding" },
    highlighted: false,
    disabled: false,
  },
  {
    name: "Professional",
    pricing: { type: "paid", monthly: 25, annual: 19 },
    priceNote: {
      monthly: "Most teams choose this",
      annual: "Most teams choose this",
    },
    bestFor: "Growing teams running multiple production boards",
    intro: "Everything in Basic, plus:",
    features: [
      "2 board groups, 3 boards",
      "15 agents, 5 per board",
      "20M tokens / agent / day",
      "200M org tokens / month, 16k per run",
    ],
    cta: { label: "Get Pro", href: "/checkout/pro" },
    highlighted: true,
    disabled: false,
  },
  {
    name: "Enterprise",
    pricing: { type: "paid", monthly: 99, annual: 79, unit: "/seat" },
    priceNote: {
      monthly: "Custom volume discounts available",
      annual: "Custom volume discounts available",
    },
    bestFor: "Large orgs that need SSO, audit logs, and dedicated support",
    intro: "Everything in Pro, plus:",
    features: [
      "SSO / SAML authentication",
      "Audit log and compliance reporting",
      "Custom SLA — 99.99% uptime",
      "Dedicated onboarding and CSM",
      "Higher model and token limits",
    ],
    cta: { label: "Get Custom Quote", href: "/onboarding" },
    highlighted: false,
    disabled: false,
  },
];

/** Renders the price block for a card based on the current billing period. */
function PriceDisplay({
  pricing,
  period,
}: {
  pricing: PlanPrice;
  period: BillingPeriod;
}) {
  if (pricing.type === "free") {
    return (
      <p className="text-3xl font-bold tracking-tight text-white md:text-4xl">
        {pricing.label}
      </p>
    );
  }

  const activePrice = period === "annual" ? pricing.annual : pricing.monthly;
  const unit = pricing.unit ?? "";

  return (
    <div className="flex flex-col gap-1">
      {period === "annual" && (
        <p className="text-sm text-white/40 line-through">
          ${pricing.monthly}
          {unit}/mo
        </p>
      )}
      <div className="flex items-end gap-1.5">
        <p className="text-3xl font-bold tracking-tight text-white md:text-4xl">
          ${activePrice}
        </p>
        <p className="pb-1 text-xs text-white/55 md:text-sm">{unit}/mo</p>
      </div>
    </div>
  );
}

/** Centered pill toggle for billing period selection. */
function BillingToggle({
  period,
  onChange,
}: {
  period: BillingPeriod;
  onChange: (p: BillingPeriod) => void;
}) {
  return (
    <div className="mb-10 flex justify-center">
      <div className="relative inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] p-1 text-sm">
        <button
          type="button"
          onClick={() => onChange("monthly")}
          className={`relative z-10 rounded-full px-5 py-1.5 font-medium transition-colors duration-200 ${
            period === "monthly"
              ? "bg-white text-black shadow-sm"
              : "text-white/55 hover:text-white/80"
          }`}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => onChange("annual")}
          className={`relative z-10 flex items-center gap-2 rounded-full px-5 py-1.5 font-medium transition-colors duration-200 ${
            period === "annual"
              ? "bg-white text-black shadow-sm"
              : "text-white/55 hover:text-white/80"
          }`}
        >
          Annual
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors duration-200 ${
              period === "annual"
                ? "bg-emerald-500 text-white"
                : "bg-emerald-500/20 text-emerald-400"
            }`}
          >
            Save 20%
          </span>
        </button>
      </div>
    </div>
  );
}

export default function PricingCards() {
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("monthly");

  return (
    <section
      id="pricing"
      className="relative overflow-hidden bg-black px-[5%] pb-16 pt-8 sm:pb-20 sm:pt-10"
    >
      {/* Hero-style background image with overlay + blur */}
      <div className="pointer-events-none absolute inset-0">
        <Image
          src="/videos/hero-animation-poster.jpg"
          alt=""
          fill
          sizes="100vw"
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
        <div className="absolute -left-28 top-6 h-72 w-72 rounded-full bg-white/10 blur-[120px]" />
        <div className="absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-white/5 blur-[130px]" />
      </div>

      <div className="relative mx-auto max-w-7xl">
        <ScrollReveal className="mb-10 text-center">
          <h2 className="text-balance text-3xl font-bold leading-[1.05] tracking-tight text-white sm:text-4xl md:text-5xl lg:text-6xl">
            Simple pricing. Scale when ready.
          </h2>
        </ScrollReveal>

        <BillingToggle period={billingPeriod} onChange={setBillingPeriod} />

        <div className="grid gap-5 lg:grid-cols-3 lg:gap-6">
          {INDIVIDUAL_PLANS.map((plan, index) => {
            return (
              <ScrollReveal key={plan.name} delay={index * 0.1}>
                <div
                  className={`relative flex h-full flex-col overflow-hidden rounded-[24px] border p-6 transition-all duration-200 md:p-7 ${
                    plan.highlighted
                      ? "hero-glass-card border-white/30 bg-white/[0.12] ring-1 ring-white/25 lg:-translate-y-2"
                      : "hero-glass-card border-white/10 bg-white/[0.04] hover:border-white/20"
                  }`}
                >
                  {plan.highlighted ? (
                    <span className="absolute right-5 top-5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/85">
                      Most used
                    </span>
                  ) : null}

                  <div className="mb-6">
                    <span
                      className={`mb-4 block h-[2px] w-12 rounded-full ${
                        plan.highlighted ? "bg-white/80" : "bg-white/35"
                      }`}
                    />
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/45">
                      Plan
                    </p>
                    <h3 className="mt-3 text-xl font-semibold text-white md:text-2xl">
                      {plan.name}
                    </h3>
                    <div className="mt-4 flex items-end gap-2.5">
                      <PriceDisplay
                        pricing={plan.pricing}
                        period={billingPeriod}
                      />
                      <p className="pb-1 text-xs text-white/55 md:text-sm">
                        {plan.priceNote[billingPeriod]}
                      </p>
                    </div>
                  </div>

                  <div className="mb-5 rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
                      Best for
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-white/75">
                      {plan.bestFor}
                    </p>
                  </div>

                  <p className="mb-4 text-sm font-medium text-white/65">
                    {plan.intro}
                  </p>
                  <ul className="mb-7 flex-1 space-y-3">
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2.5 text-sm leading-relaxed text-white/75"
                      >
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white/45" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  {plan.disabled ? (
                    <span className="block cursor-not-allowed text-center opacity-50 hero-btn-secondary">
                      {plan.cta.label}
                    </span>
                  ) : (
                    <Link
                      href={plan.cta.href}
                      className={`block text-center ${
                        plan.highlighted
                          ? "hero-btn-primary"
                          : "hero-btn-secondary"
                      }`}
                    >
                      {plan.cta.label}
                    </Link>
                  )}
                </div>
              </ScrollReveal>
            );
          })}
        </div>

        {/* Trust badges */}
        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-white/40">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-4 w-4 shrink-0"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z"
              clipRule="evenodd"
            />
          </svg>
          <span>Stripe Verified</span>
          <span className="text-white/20">|</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-4 w-4 shrink-0"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M12 1.5a.75.75 0 01.696.47l1.83 4.42 4.755.692a.75.75 0 01.416 1.28l-3.44 3.352.812 4.732a.75.75 0 01-1.088.791L12 14.347l-4.25 2.235a.75.75 0 01-1.09-.79l.814-4.733-3.44-3.35a.75.75 0 01.416-1.28l4.756-.693 1.83-4.42A.75.75 0 0112 1.5z"
              clipRule="evenodd"
            />
          </svg>
          <span>SOC 2 Certified</span>
        </div>
      </div>
    </section>
  );
}

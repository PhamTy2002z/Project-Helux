"use client";

import Link from "next/link";
import { ScrollReveal } from "./scroll-reveal";

const INDIVIDUAL_PLANS = [
  {
    name: "Basic",
    price: "Free",
    priceNote: "No cost to start",
    bestFor: "Solo builders validating their first board workflow",
    intro: "Includes:",
    features: [
      "No credit card required",
      "1 board group, 1 board",
      "3 agents total, 3 agents / board",
      "40k org tokens / day",
    ],
    cta: { label: "Download", href: "/onboarding" },
    highlighted: false,
  },
  {
    name: "Professional",
    price: "25$/month",
    priceNote: "Most teams choose this",
    bestFor: "Growing teams running multiple production boards",
    intro: "Everything in Basic, plus:",
    features: [
      "1 board group, 3 boards",
      "15 agents total, 5 agents / board",
      "300k org tokens / day",
      "8M org tokens / month + 8k max tokens / run",
    ],
    cta: { label: "Get Pro", href: "/onboarding" },
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    priceNote: "Contract and governance controls",
    bestFor: "Large orgs with custom policy and support requirements",
    intro: "Everything in Pro, plus:",
    features: [
      "Higher model and token limits",
      "Priority access to new platform features",
      "Dedicated onboarding assistance",
    ],
    cta: { label: "Get Enterprise", href: "/onboarding" },
    highlighted: false,
  },
];

export default function PricingCards() {
  return (
    <section id="pricing" className="relative overflow-hidden bg-black px-[5%] pb-16 pt-8 sm:pb-20 sm:pt-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-28 top-6 h-72 w-72 rounded-full bg-white/10 blur-[120px]" />
        <div className="absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-white/5 blur-[130px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black via-black to-[var(--slide-bg-alt,#131318)]" />
      </div>

      <div className="relative mx-auto max-w-7xl">
        <ScrollReveal className="mb-10 text-center">
          <h2 className="text-balance text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
            Pick the Plan for Your Mission
          </h2>
        </ScrollReveal>

        <div className="grid gap-5 lg:grid-cols-3 lg:gap-6">
          {INDIVIDUAL_PLANS.map((plan, index) => {
            return (
              <ScrollReveal key={plan.name} delay={index * 0.1}>
                <div
                  className={`relative flex h-full flex-col overflow-hidden rounded-[30px] border p-7 transition-all duration-200 md:p-8 ${
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
                    <h3 className="mt-3 text-2xl font-semibold text-white md:text-[30px]">
                      {plan.name}
                    </h3>
                    <div className="mt-4 flex items-end gap-2.5">
                      <p className="text-4xl font-bold tracking-tight text-white md:text-5xl">
                        {plan.price}
                      </p>
                      <p className="pb-1 text-xs text-white/55 md:text-sm">
                        {plan.priceNote}
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
                  <Link
                    href={plan.cta.href}
                    className={`block text-center ${
                      plan.highlighted ? "hero-btn-primary" : "hero-btn-secondary"
                    }`}
                  >
                    {plan.cta.label}
                  </Link>
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

"use client";

import Link from "next/link";
import { CheckCircle2, Rocket, Sparkles, Zap } from "lucide-react";
import { ScrollReveal } from "./scroll-reveal";

const INDIVIDUAL_PLANS = [
  {
    icon: Sparkles,
    name: "Basic",
    price: "Free",
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
    icon: Rocket,
    name: "Professional",
    price: "Pro",
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
    icon: Zap,
    name: "Ultra",
    price: "Preview",
    intro: "Everything in Pro, plus:",
    features: [
      "Higher model and token limits (roadmap)",
      "Priority access to new platform features",
      "Dedicated onboarding assistance",
    ],
    cta: { label: "Get Ultra", href: "/onboarding" },
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
          <p className="mx-auto mt-4 max-w-2xl text-center text-base leading-relaxed text-white/60 md:text-lg">
            Select the plan that matches your board complexity, agent volume,
            and runtime throughput needs.
          </p>
        </ScrollReveal>

        <div className="grid gap-6 lg:grid-cols-3">
          {INDIVIDUAL_PLANS.map((plan, index) => {
            const Icon = plan.icon;
            return (
              <ScrollReveal key={plan.name} delay={index * 0.1}>
                <div
                  className={`flex h-full flex-col rounded-3xl border p-8 transition-all duration-200 ${
                    plan.highlighted
                      ? "hero-glass-card border-white/30 bg-white/[0.12] ring-1 ring-white/25"
                      : "hero-glass-card border-white/10 bg-white/[0.04] hover:border-white/20"
                  }`}
                >
                  <div className="mb-6 flex items-center justify-between gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/10">
                      <Icon size={22} className="text-white/85" />
                    </div>
                    {plan.highlighted ? (
                      <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
                        Most used
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mb-1 text-2xl font-semibold text-white">
                    {plan.name}
                  </h3>
                  <p className="mb-4 text-3xl font-bold tracking-tight text-white">
                    {plan.price}
                  </p>
                  <p className="mb-4 text-sm font-medium text-white/65">
                    {plan.intro}
                  </p>
                  <ul className="mb-8 flex-1 space-y-3">
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2 text-sm text-white/75"
                      >
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-white/80" />
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

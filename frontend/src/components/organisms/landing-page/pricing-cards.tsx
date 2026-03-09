"use client";

import Link from "next/link";
import { CheckCircle2, Rocket, Shield, Sparkles } from "lucide-react";
import { ScrollReveal } from "./scroll-reveal";

const TIERS = [
  {
    icon: Sparkles,
    name: "Basic",
    badge: "Starter",
    description: "Best for solo teams validating workflows.",
    bullets: [
      "1 board group, 1 board",
      "3 agents total, 3 agents / board",
      "40k org tokens / day",
    ],
    cta: { label: "Start Basic", href: "/onboarding" },
    highlighted: false,
  },
  {
    icon: Rocket,
    name: "Professional",
    badge: "Most used",
    description: "For scaling product teams running multiple boards.",
    bullets: [
      "1 board group, 3 boards",
      "15 agents total, 5 agents / board",
      "300k org tokens / day",
    ],
    cta: { label: "Upgrade to Professional", href: "/onboarding" },
    highlighted: true,
  },
  {
    icon: Shield,
    name: "Enterprise",
    badge: "Placeholder",
    description: "Temporary template for enterprise package details.",
    bullets: [
      "Custom limits and governance controls (placeholder)",
      "Dedicated deployment and support model (placeholder)",
      "Security/compliance options (placeholder)",
    ],
    cta: { label: "Talk to Sales", href: "/onboarding" },
    highlighted: false,
    isPlaceholder: true,
  },
];

export default function PricingCards() {
  return (
    <section id="pricing" className="relative overflow-hidden bg-black px-[5%] py-24">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-28 top-12 h-72 w-72 rounded-full bg-white/10 blur-[120px]" />
        <div className="absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-white/5 blur-[130px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black via-black to-[var(--slide-bg-alt,#131318)]" />
      </div>

      <div className="relative mx-auto max-w-7xl">
        <ScrollReveal className="mb-16 text-center">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-white/40">
            Pricing
          </p>
          <h2 className="text-balance text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
            Pick the Plan for Your Mission
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-center text-base leading-relaxed text-white/60 md:text-lg">
            Built from the current in-app upgrade modal limits, now aligned to
            Basic, Professional, and Enterprise tiers.
          </p>
        </ScrollReveal>

        <div className="grid gap-6 lg:grid-cols-3">
          {TIERS.map((tier, index) => {
            const Icon = tier.icon;
            return (
              <ScrollReveal key={tier.name} delay={index * 0.1}>
                <div
                  className={`flex h-full flex-col rounded-3xl border p-8 transition-all duration-200 ${
                    tier.highlighted
                      ? "hero-glass-card border-white/25 bg-white/[0.1] ring-1 ring-white/20"
                      : "hero-glass-card border-white/10 bg-white/[0.04] hover:border-white/20"
                  }`}
                >
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/10">
                      <Icon size={22} className="text-white/85" />
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/70">
                      {tier.badge}
                    </span>
                  </div>
                  <h3 className="mb-1 text-2xl font-semibold text-white">
                    {tier.name}
                  </h3>
                  <p className="mb-6 flex-1 text-sm leading-relaxed text-white/60">
                    {tier.description}
                  </p>
                  <ul className="mb-8 space-y-3">
                    {tier.bullets.map((bullet) => (
                      <li
                        key={bullet}
                        className="flex items-start gap-2 text-sm text-white/75"
                      >
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-white/80" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                  {tier.isPlaceholder ? (
                    <p className="mb-4 text-xs text-white/45">
                      Enterprise content is temporary and will be updated.
                    </p>
                  ) : null}
                  <Link
                    href={tier.cta.href}
                    className={`block text-center ${
                      tier.highlighted
                        ? "hero-btn-primary"
                        : "hero-btn-secondary"
                    }`}
                  >
                    {tier.cta.label}
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

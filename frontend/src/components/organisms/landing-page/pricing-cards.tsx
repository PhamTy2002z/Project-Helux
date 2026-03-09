"use client";

import Link from "next/link";
import { Cloud, Hexagon, Server } from "lucide-react";
import { ScrollReveal } from "./scroll-reveal";

const TIERS = [
  {
    icon: Cloud,
    name: "Free",
    description:
      "Get started with boards, basic agents, and community support. No credit card required.",
    cta: { label: "Start Free", href: "/onboarding" },
    highlighted: false,
  },
  {
    icon: Hexagon,
    name: "Pro",
    description:
      "Advanced agents, gateways, priority support, and cross-board analytics for growing teams.",
    cta: { label: "Upgrade", href: "/pricing" },
    highlighted: true,
  },
  {
    icon: Server,
    name: "Self-hosted",
    description:
      "Full control on your infrastructure — Docker, Kubernetes, or private cloud deployment.",
    cta: { label: "Contact Us", href: "/contact" },
    highlighted: false,
  },
];

export default function PricingCards() {
  return (
    <section id="pricing" className="bg-black px-[5%] py-24">
      <div className="mx-auto max-w-7xl">
        <ScrollReveal className="mb-16 text-center">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-white/40">
            Get started
          </p>
          <h2
            className="text-balance text-white"
            style={{ fontSize: "clamp(28px, 4vw, 56px)" }}
          >
            Ready to get started?
          </h2>
        </ScrollReveal>

        <div className="grid gap-6 md:grid-cols-3">
          {TIERS.map((tier, index) => {
            const Icon = tier.icon;
            return (
              <ScrollReveal key={tier.name} delay={index * 0.1}>
                <div
                  className={`flex h-full flex-col rounded-2xl border p-8 transition-all duration-200 ${
                    tier.highlighted
                      ? "border-white/20 bg-white/10 ring-1 ring-white/10"
                      : "border-white/10 bg-white/5 hover:border-white/20"
                  }`}
                >
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-white/10">
                    <Icon size={24} className="text-white/80" />
                  </div>
                  <h3 className="mb-2 text-xl font-semibold text-white">
                    {tier.name}
                  </h3>
                  <p className="mb-8 flex-1 text-sm leading-relaxed text-white/60">
                    {tier.description}
                  </p>
                  <Link
                    href={tier.cta.href}
                    className={`block cursor-pointer rounded-full border px-6 py-3 text-center text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                      tier.highlighted
                        ? "border-white/30 bg-white text-black hover:bg-white/90"
                        : "border-white/20 bg-white/10 text-white hover:bg-white/20"
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

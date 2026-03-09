"use client";

import { LayoutDashboard, Bot, Router } from "lucide-react";
import { ScrollReveal } from "./scroll-reveal";

const FEATURES = [
  {
    icon: LayoutDashboard,
    title: "Boards",
    description: "Unified task dashboard with real-time sync",
    bullets: [
      "Visual task management with fewer tool switches",
      "Real-time approval routing",
      "Live execution signals across teams",
    ],
  },
  {
    icon: Bot,
    title: "Agents",
    description: "Coordinate humans and agents in one loop",
    bullets: [
      "Automated workflow orchestration",
      "Approval workflows built in",
      "Full execution visibility and audit trails",
    ],
  },
  {
    icon: Router,
    title: "Gateways",
    description: "Track execution momentum across boards",
    bullets: [
      "Gateway routing and skill packs",
      "Historical performance analytics",
      "Role-based access control",
    ],
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
        <ScrollReveal className="mb-16 text-center">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-white/45">
            Core capabilities
          </p>
          <h2
            className="text-balance text-white"
            style={{ fontSize: "clamp(28px, 4vw, 56px)" }}
          >
            Everything you need to run operations
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-balance text-sm leading-relaxed text-white/55 md:text-base">
            Run boards, agents, and gateways from one interface with clear
            ownership, approval controls, and live execution visibility.
          </p>
        </ScrollReveal>

        <div className="grid gap-6 md:grid-cols-3">
          {FEATURES.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <ScrollReveal key={feature.title} delay={index * 0.1}>
                <article className="hero-glass-card group relative h-full rounded-3xl p-8 transition-all duration-300 hover:border-white/20 hover:bg-white/[0.08]">
                  <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 bg-white/10">
                    <Icon size={24} className="text-white/85" />
                  </div>
                  <h3 className="mb-2 text-xl font-semibold text-white">
                    {feature.title}
                  </h3>
                  <p className="mb-5 text-sm leading-relaxed text-white/65">
                    {feature.description}
                  </p>
                  <ul className="space-y-3">
                    {feature.bullets.map((bullet) => (
                      <li
                        key={bullet}
                        className="flex items-start gap-2 text-sm text-white/55"
                      >
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white/40" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </article>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

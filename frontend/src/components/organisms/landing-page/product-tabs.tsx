"use client";

import { useCallback, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { LayoutDashboard, Bot, Router, Boxes } from "lucide-react";
import { ScrollReveal } from "./scroll-reveal";

const TABS = [
  {
    id: "boards",
    label: "Boards",
    icon: LayoutDashboard,
    tags: ["Tasks", "Approvals", "Realtime"],
    description:
      "Manage tasks, approvals, and real-time execution signals from a unified command surface. No more context switching between tools.",
  },
  {
    id: "agents",
    label: "Agents",
    icon: Bot,
    tags: ["Workflows", "Health", "Logs"],
    description:
      "Coordinate humans and AI agents in one execution loop. Monitor agent health, review logs, and manage automated workflows.",
  },
  {
    id: "gateways",
    label: "Gateways",
    icon: Router,
    tags: ["Routing", "Config", "Webhooks"],
    description:
      "Configure gateway routing, manage webhooks, and control how data flows between your boards, agents, and external services.",
  },
  {
    id: "skills",
    label: "Skills",
    icon: Boxes,
    tags: ["Packs", "Marketplace", "Deploy"],
    description:
      "Browse the skill marketplace, deploy capability packs to your agents, and extend your platform with community contributions.",
  },
];

export default function ProductTabs() {
  const [activeTab, setActiveTab] = useState(0);
  const shouldReduceMotion = useReducedMotion();

  /* WAI-ARIA tabs: arrow-key navigation between tabs */
  const handleTabKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      let next = activeTab;
      if (e.key === "ArrowRight") next = (activeTab + 1) % TABS.length;
      else if (e.key === "ArrowLeft") next = (activeTab - 1 + TABS.length) % TABS.length;
      else return;
      e.preventDefault();
      setActiveTab(next);
      /* Focus the newly active tab button */
      const tablist = e.currentTarget;
      const buttons = tablist.querySelectorAll<HTMLButtonElement>('[role="tab"]');
      buttons[next]?.focus();
    },
    [activeTab]
  );

  return (
    <section id="product" className="relative overflow-hidden bg-black px-[5%] py-24">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 right-1/4 h-64 w-64 rounded-full bg-white/[0.05] blur-3xl" />
        <div className="absolute bottom-0 left-[-6rem] h-80 w-80 rounded-full bg-white/[0.04] blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl">
        <ScrollReveal className="mb-16 text-center">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-white/45">
            Platform
          </p>
          <h2
            className="text-balance text-white"
            style={{ fontSize: "clamp(28px, 4vw, 56px)" }}
          >
            The Mission Control Platform
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-balance text-sm leading-relaxed text-white/55 md:text-base">
            Keep every operational surface in one cohesive system without losing
            clarity or control.
          </p>
        </ScrollReveal>

        {/* Tab bar */}
        <ScrollReveal>
          <div
            className="mb-12 flex flex-wrap justify-center gap-2.5"
            role="tablist"
            aria-label="Product areas"
            onKeyDown={handleTabKeyDown}
          >
            {TABS.map((tab, index) => {
              const Icon = tab.icon;
              const isActive = activeTab === index;
              return (
                <button
                  key={tab.id}
                  id={`${tab.id}-tab`}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`panel-${tab.id}`}
                  tabIndex={isActive ? 0 : -1}
                  className={`flex cursor-pointer items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                    isActive
                      ? "border-white/80 bg-white text-black shadow-[0_10px_30px_rgba(255,255,255,0.16)]"
                      : "hero-glass-card border-white/15 text-white/70 hover:border-white/30 hover:text-white"
                  }`}
                  onClick={() => setActiveTab(index)}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </ScrollReveal>

        {/* Tab content */}
        <div className="relative min-h-[280px]">
          <AnimatePresence mode="wait">
            {TABS.map(
              (tab, index) =>
                activeTab === index && (
                  <motion.div
                    key={tab.id}
                    id={`panel-${tab.id}`}
                    role="tabpanel"
                    aria-labelledby={`${tab.id}-tab`}
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={shouldReduceMotion ? undefined : { opacity: 0, y: -10 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="hero-glass-card mx-auto flex w-full max-w-5xl flex-col items-center rounded-3xl border border-white/15 px-6 py-8 md:px-10 md:py-10"
                  >
                    {/* Tags */}
                    <div className="mb-6 flex flex-wrap justify-center gap-2">
                      {tab.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-white/15 bg-black/30 px-3 py-1 text-xs text-white/70"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    {/* Screenshot placeholder */}
                    <div className="mb-8 flex h-[320px] w-full max-w-4xl items-center justify-center rounded-2xl border border-white/15 bg-gradient-to-b from-white/[0.08] to-white/[0.02]">
                      <div className="text-center">
                        <tab.icon size={48} className="mx-auto mb-3 text-white/30" />
                        <p className="text-sm text-white/45">
                          {tab.label} screenshot
                        </p>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="max-w-2xl text-center text-base leading-relaxed text-white/70">
                      {tab.description}
                    </p>
                  </motion.div>
                )
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

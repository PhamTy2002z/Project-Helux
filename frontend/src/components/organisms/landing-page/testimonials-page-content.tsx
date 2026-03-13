"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Quote, Star } from "lucide-react";
import { ScrollReveal } from "./scroll-reveal";
import {
  TESTIMONIALS,
  TESTIMONIAL_STATS,
  type Testimonial,
} from "./testimonials-data";

const CATEGORY_LABELS: Record<Testimonial["category"], string> = {
  engineering: "Engineering",
  devops: "DevOps",
  leadership: "Leadership",
  platform: "Platform",
};

const CATEGORIES = ["engineering", "devops", "leadership", "platform"] as const;
const ALL_CATEGORIES = ["all", ...CATEGORIES] as const;
type CategoryFilter = (typeof ALL_CATEGORIES)[number];
const CATEGORY_COUNTS: Record<Testimonial["category"], number> = TESTIMONIALS.reduce(
  (acc, testimonial) => {
    acc[testimonial.category] += 1;
    return acc;
  },
  { engineering: 0, devops: 0, leadership: 0, platform: 0 }
);

export default function TestimonialsPageContent() {
  const [filter, setFilter] = useState<CategoryFilter>("all");
  const shouldReduceMotion = useReducedMotion();

  const filtered =
    filter === "all"
      ? TESTIMONIALS
      : TESTIMONIALS.filter((t) => t.category === filter);
  const filterLabel = filter === "all" ? "All testimonials" : CATEGORY_LABELS[filter];

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden px-[5%] pb-16 pt-32 sm:pt-36 lg:pt-40">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-[-18rem] h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-white/[0.07] blur-3xl" />
          <div className="absolute bottom-[-12rem] right-[10%] h-[20rem] w-[20rem] rounded-full bg-white/[0.03] blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-5xl text-center">
          <ScrollReveal>
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.05] px-4 py-2 text-xs font-medium uppercase tracking-[0.16em] text-white/80">
              <span className="h-1.5 w-1.5 rounded-full bg-white/75" />
              Verified production operators
            </div>
            <h1
              className="mt-6 text-balance text-white"
              style={{ fontSize: "clamp(32px, 4vw, 64px)", lineHeight: 1 }}
            >
              Trusted by teams building the future
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-balance text-base leading-relaxed text-white/55 sm:text-lg">
              Hear from engineering leaders, DevOps teams, and operators who
              run production workloads on FlowGrid every day.
            </p>
          </ScrollReveal>

          {/* Stats row */}
          <ScrollReveal className="mt-14">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {TESTIMONIAL_STATS.map((stat) => (
                <div
                  key={stat.label}
                  className="group rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.02] px-4 py-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20"
                >
                  <div className="mb-4 h-px w-full bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                  <p className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-xs text-white/45 sm:text-sm">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Filter tabs */}
      <section className="px-[5%] pb-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-white/55">
              <span className="font-medium text-white/85">{filterLabel}</span>
              {" • "}
              {filtered.length} review{filtered.length === 1 ? "" : "s"}
            </p>
          </div>
          <div
            className="hero-glass-card flex flex-wrap gap-2 rounded-2xl border border-white/10 p-3"
            role="tablist"
            aria-label="Filter testimonials by category"
          >
            {ALL_CATEGORIES.map((cat) => {
              const isActive = filter === cat;
              const label =
                cat === "all" ? "All" : CATEGORY_LABELS[cat];
              const count = cat === "all" ? TESTIMONIALS.length : CATEGORY_COUNTS[cat];

              return (
                <button
                  key={cat}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setFilter(cat)}
                  className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                    isActive
                      ? "border-white/30 bg-white text-black shadow-[0_10px_30px_rgba(255,255,255,0.18)]"
                      : "border-white/10 bg-white/[0.04] text-white/60 hover:border-white/25 hover:bg-white/[0.08] hover:text-white/85"
                  }`}
                >
                  {label}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      isActive ? "bg-black/10 text-black/70" : "bg-white/10 text-white/65"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Testimonial grid */}
      <section className="px-[5%] pb-24">
        <div className="mx-auto max-w-5xl">
          <AnimatePresence mode="popLayout">
            <motion.div
              layout
              className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
            >
              {filtered.map((t, index) => (
                <motion.blockquote
                  key={`${t.author}-${t.company}`}
                  layout
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0, y: -8 }}
                  transition={{
                    duration: 0.3,
                    ease: "easeOut",
                    delay: shouldReduceMotion ? 0 : index * 0.03,
                  }}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-white/25"
                >
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-white/[0.08] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  <div>
                    <div className="mb-4 flex items-center justify-between">
                      <span className="rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-white/65">
                        {CATEGORY_LABELS[t.category]}
                      </span>
                      <div className="flex items-center gap-0.5 text-white/70" aria-label="Rated 5 out of 5">
                        {Array.from({ length: 5 }).map((_, starIndex) => (
                          <Star key={`${t.author}-star-${starIndex}`} size={12} fill="currentColor" />
                        ))}
                      </div>
                    </div>
                    <Quote size={20} className="mb-4 text-white/25" aria-hidden="true" />
                    <p className="text-[15px] leading-relaxed text-white/85">
                      &ldquo;{t.quote}&rdquo;
                    </p>
                  </div>
                  <footer className="mt-6 border-t border-white/[0.08] pt-4">
                    <p className="text-sm font-semibold text-white/90">
                      {t.author}
                    </p>
                    <p className="mt-0.5 text-xs text-white/45">
                      {t.role}, {t.company}
                    </p>
                  </footer>
                </motion.blockquote>
              ))}
            </motion.div>
          </AnimatePresence>

          {filtered.length === 0 && (
            <div className="hero-glass-card rounded-2xl border border-white/10 px-6 py-16 text-center text-sm text-white/40">
              No testimonials in this category yet.
            </div>
          )}
        </div>
      </section>
    </>
  );
}

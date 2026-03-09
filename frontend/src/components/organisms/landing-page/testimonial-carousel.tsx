"use client";

import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ScrollReveal } from "./scroll-reveal";

const TESTIMONIALS = [
  {
    quote:
      "OpenClaw unified our board operations. Approvals that took days now take minutes.",
    author: "Engineering Lead",
    company: "Series B Startup",
  },
  {
    quote:
      "The agent health dashboard gives us real-time visibility we never had before.",
    author: "DevOps Manager",
    company: "Enterprise SaaS",
  },
  {
    quote:
      "Finally, one place to track tasks, agents, and decisions across all our teams.",
    author: "CTO",
    company: "Growth-stage Platform",
  },
];

export default function TestimonialCarousel() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const next = useCallback(() => {
    setActive((prev) => (prev + 1) % TESTIMONIALS.length);
  }, []);

  // Auto-advance every 5s unless paused or reduced-motion
  useEffect(() => {
    if (paused || shouldReduceMotion) return;
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [paused, shouldReduceMotion, next]);

  return (
    <section
      id="testimonials"
      className="relative overflow-hidden bg-black px-[5%] py-24"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-10 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-white/[0.05] blur-3xl" />
      </div>

      <div className="mx-auto max-w-4xl">
        <ScrollReveal className="mb-16 text-center">
          <h2
            className="text-balance text-white"
            style={{ fontSize: "clamp(28px, 4vw, 56px)" }}
          >
            Loved by teams worldwide
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-balance text-sm leading-relaxed text-white/55 md:text-base">
            Proof from operators running real boards, real agents, and real
            approvals in production.
          </p>
        </ScrollReveal>

        {/* Quote area */}
        <div className="relative min-h-[200px]" aria-live="polite">
          <AnimatePresence mode="wait">
            <motion.blockquote
              key={active}
              initial={shouldReduceMotion ? false : { opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={shouldReduceMotion ? undefined : { opacity: 0, x: -40 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="hero-glass-card rounded-3xl border border-white/15 px-6 py-10 text-center md:px-10"
            >
              <p
                className="mb-8 text-balance text-white/90"
                style={{ fontSize: "clamp(18px, 2.5vw, 28px)", lineHeight: 1.5 }}
              >
                &ldquo;{TESTIMONIALS[active].quote}&rdquo;
              </p>
              <footer className="text-sm text-white/60">
                <span className="font-medium text-white/80">
                  {TESTIMONIALS[active].author}
                </span>
                {" — "}
                {TESTIMONIALS[active].company}
              </footer>
            </motion.blockquote>
          </AnimatePresence>
        </div>

        {/* Dots */}
        <div
          className="mt-10 flex justify-center gap-2"
          role="tablist"
          aria-label="Testimonials"
          onKeyDown={(e) => {
            let next = active;
            if (e.key === "ArrowRight") next = (active + 1) % TESTIMONIALS.length;
            else if (e.key === "ArrowLeft") next = (active - 1 + TESTIMONIALS.length) % TESTIMONIALS.length;
            else return;
            e.preventDefault();
            setActive(next);
            const buttons = e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]');
            buttons[next]?.focus();
          }}
        >
          {TESTIMONIALS.map((_, index) => (
            <button
              key={index}
              type="button"
              role="tab"
              aria-selected={active === index}
              aria-label={`Testimonial ${index + 1}`}
              tabIndex={active === index ? 0 : -1}
              className={`cursor-pointer rounded-full border transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                active === index
                  ? "h-2 w-7 border-white bg-white"
                  : "h-2 w-2 border-white/30 bg-white/20 hover:border-white/50 hover:bg-white/40"
              }`}
              onClick={() => setActive(index)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

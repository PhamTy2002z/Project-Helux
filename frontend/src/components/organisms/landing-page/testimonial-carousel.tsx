"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ScrollReveal } from "./scroll-reveal";
import { TESTIMONIALS } from "./testimonials-data";

/** Landing carousel shows first 3 testimonials; full list on /testimonials */
const CAROUSEL_ITEMS = TESTIMONIALS.slice(0, 3);

export default function TestimonialCarousel() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const sectionRef = useRef<HTMLElement | null>(null);

  const next = useCallback(() => {
    setActive((prev) => (prev + 1) % CAROUSEL_ITEMS.length);
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      (entries) => {
        setIsVisible(entries.some((entry) => entry.isIntersecting));
      },
      { threshold: 0.2 }
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  // Auto-advance every 5s unless paused or reduced-motion
  useEffect(() => {
    if (paused || shouldReduceMotion || !isVisible) return;
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [paused, shouldReduceMotion, isVisible, next]);

  return (
    <section
      id="testimonials"
      ref={sectionRef}
      className="landing-deferred-section relative scroll-mt-24 overflow-hidden bg-black px-4 py-24 sm:px-6 lg:scroll-mt-28 lg:px-10 fhd:px-14 qhd:px-16 uhd:px-20"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-white/[0.03] to-transparent" />
      </div>

      <div className="mx-auto w-full max-w-4xl fhd:max-w-[1040px] qhd:max-w-[1160px]">
        <ScrollReveal className="mb-16 text-center">
          <h2
            className="text-balance text-white"
            style={{ fontSize: "clamp(26px, 3.5vw, 52px)" }}
          >
            Loved by teams worldwide
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-balance text-[13px] leading-relaxed text-white/55 sm:text-sm fhd:text-base">
            Proof from operators running real boards, real agents, and real
            approvals in production.
          </p>
        </ScrollReveal>

        {/* Quote area */}
        <div className="relative min-h-[220px] md:min-h-[240px] fhd:min-h-[280px]" aria-live="polite">
          <AnimatePresence mode="wait">
            <motion.blockquote
              key={active}
              initial={shouldReduceMotion ? false : { opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={shouldReduceMotion ? undefined : { opacity: 0, x: -40 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="hero-glass-card rounded-3xl border border-white/15 px-5 py-8 text-center sm:px-6 md:px-10 md:py-10"
            >
              <p
                className="mb-8 text-balance text-white/90"
                style={{ fontSize: "clamp(18px, 2.2vw, 28px)", lineHeight: 1.5 }}
              >
                &ldquo;{CAROUSEL_ITEMS[active].quote}&rdquo;
              </p>
              <footer className="text-sm text-white/60 sm:text-base">
                <span className="font-medium text-white/80">
                  {CAROUSEL_ITEMS[active].author}
                </span>
                {", "}
                {CAROUSEL_ITEMS[active].role}
                {" — "}
                {CAROUSEL_ITEMS[active].company}
              </footer>
            </motion.blockquote>
          </AnimatePresence>
        </div>

        {/* View all link */}
        <div className="mt-8 text-center">
          <Link
            href="/testimonials"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-white/55 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            View all testimonials
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>

        {/* Dots */}
        <div
          className="mt-10 flex justify-center gap-2"
          role="tablist"
          aria-label="Testimonials"
          onKeyDown={(e) => {
            let next = active;
            if (e.key === "ArrowRight") next = (active + 1) % CAROUSEL_ITEMS.length;
            else if (e.key === "ArrowLeft") next = (active - 1 + CAROUSEL_ITEMS.length) % CAROUSEL_ITEMS.length;
            else return;
            e.preventDefault();
            setActive(next);
            const buttons = e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]');
            buttons[next]?.focus();
          }}
        >
          {CAROUSEL_ITEMS.map((_, index) => (
            <button
              key={index}
              type="button"
              role="tab"
              aria-selected={active === index}
              aria-label={`Testimonial ${index + 1}`}
              tabIndex={active === index ? 0 : -1}
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              onClick={() => setActive(index)}
            >
              <span
                className={`block rounded-full border transition-all duration-300 ${
                  active === index
                    ? "h-2 w-7 border-white bg-white"
                    : "h-2 w-2 border-white/30 bg-white/20 hover:border-white/50 hover:bg-white/40"
                }`}
              />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

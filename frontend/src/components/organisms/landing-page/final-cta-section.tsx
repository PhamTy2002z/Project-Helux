"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ScrollReveal } from "./scroll-reveal";

/**
 * Full-width CTA section placed between TestimonialCarousel and LandingFooter.
 * Reinforces conversion with a warm orange ambient glow and dual CTAs.
 */
export default function FinalCtaSection() {
  return (
    <section className="landing-deferred-section relative overflow-hidden bg-black px-4 py-24 sm:px-6 lg:px-10 fhd:px-14 qhd:px-16 uhd:px-20">
      <div className="pointer-events-none absolute inset-0">
        <div className="landing-section-glow left-1/2 top-1/2 h-[30vw] max-h-[500px] w-[50vw] max-w-[700px] -translate-x-1/2 -translate-y-1/2 bg-orange-600/[0.06]" />
      </div>
      <ScrollReveal className="relative mx-auto max-w-3xl text-center">
        <h2
          className="text-balance font-light tracking-tight text-white"
          style={{ fontSize: "clamp(36px, 5vw, 72px)" }}
        >
          Try Visgnite now.
        </h2>
        <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/onboarding"
            prefetch={false}
            className="hero-btn-demo min-h-12 px-8 text-base"
          >
            Start Building Free
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
          <a
            href="mailto:sales@visgnite.com"
            className="hero-btn-secondary min-h-12 px-6 text-base"
          >
            Talk to Sales
          </a>
        </div>
      </ScrollReveal>
    </section>
  );
}

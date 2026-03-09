"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import TrustMarquee from "./trust-marquee";

const fadeIn = {
  hidden: { opacity: 0 },
  visible: (i: number) => ({
    opacity: 1,
    transition: {
      delay: i * 0.12,
      duration: 0.5,
      ease: "easeOut" as const,
    },
  }),
};

const HERO_ANIMATION_VIDEO_SRC =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260306_074215_04640ca7-042c-45d6-bb56-58b1e8a42489.mp4";
const HERO_ANIMATION_VIDEO_POSTER = "/videos/hero-animation-poster.jpg?v=20260310";

export default function LandingHeroSection() {
  return (
    <section
      id="hero"
      className="relative min-h-[100svh] overflow-hidden bg-black"
    >
      {/* Background animation video from viral-vision-hero */}
      <video
        className="absolute inset-0 z-0 h-full w-full object-cover"
        src={HERO_ANIMATION_VIDEO_SRC}
        poster={HERO_ANIMATION_VIDEO_POSTER}
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        aria-hidden="true"
      />
      <div className="absolute inset-0 z-[1] bg-gradient-to-b from-[#040814]/70 via-[#070b1a]/35 to-black/80" />
      <div className="absolute inset-0 z-[1] bg-[radial-gradient(circle_at_50%_58%,rgba(89,132,255,0.22),transparent_44%)]" />

      {/* Content */}
      <div className="relative z-10 flex min-h-[100svh] flex-col">
        <div className="flex flex-1 flex-col items-center justify-center px-6 pb-24 pt-24 md:pt-28">
          {/* Headline */}
          <motion.h1
            className="max-w-5xl text-center text-[44px] font-light leading-[1.08] tracking-[-0.02em] text-white sm:text-6xl md:text-[72px] lg:text-[78px]"
            initial="hidden"
            animate="visible"
            variants={fadeIn}
            custom={1}
          >
            Mission Control for Coordinating Multi-Agent Work Across Every Board
          </motion.h1>

          {/* Subtext */}
          <motion.p
            className="mt-7 max-w-3xl text-center text-base leading-relaxed text-white/80 md:text-xl"
            initial="hidden"
            animate="visible"
            variants={fadeIn}
            custom={2}
          >
            Manage tasks, approvals, agent health, and gateway activity in one
            secure workspace with full audit history.
          </motion.p>

          {/* Primary CTA */}
          <motion.div
            className="mt-11 flex min-h-12 w-full items-center justify-center"
            initial="hidden"
            animate="visible"
            variants={fadeIn}
            custom={3}
          >
            <Link
              href="/onboarding"
              prefetch={false}
              className="hero-btn-demo min-h-12 px-8 text-base"
            >
              Request a Demo
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </motion.div>
        </div>

        {/* Trust bar — at bottom */}
        <TrustMarquee />
      </div>
    </section>
  );
}

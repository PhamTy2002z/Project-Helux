"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  SignInButton,
  SignedIn,
  SignedOut,
  isClerkEnabled,
} from "@/auth/clerk";
import TrustMarquee from "./trust-marquee";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.15,
      duration: 0.6,
      ease: [0.25, 0.4, 0.25, 1] as [number, number, number, number],
    },
  }),
};

const HERO_ANIMATION_VIDEO_SRC =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260306_074215_04640ca7-042c-45d6-bb56-58b1e8a42489.mp4";

export default function LandingHeroSection() {
  const clerkEnabled = isClerkEnabled();

  return (
    <section
      id="hero"
      className="relative min-h-screen overflow-hidden bg-black"
    >
      {/* Background animation video from viral-vision-hero */}
      <video
        className="absolute inset-0 z-0 h-full w-full object-cover"
        src={HERO_ANIMATION_VIDEO_SRC}
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        aria-hidden="true"
      />

      {/* Content */}
      <div className="relative z-10 flex min-h-screen flex-col">
        <div className="flex flex-1 flex-col items-center justify-center px-6 pt-24">
          {/* Headline */}
          <motion.h1
            className="max-w-4xl text-center text-5xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl md:text-7xl lg:text-[80px]"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={1}
          >
            AI Agent Mission Control for Every Board
          </motion.h1>

          {/* Subtext */}
          <motion.p
            className="mt-6 max-w-xl text-center text-base leading-relaxed text-white/60 md:text-lg"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={2}
          >
            Manage tasks, approvals, agent health, and gateway activity in one
            secure workspace with full audit history.
          </motion.p>

          {/* Buttons */}
          <motion.div
            className="mt-10 flex flex-wrap items-center justify-center gap-4"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={3}
          >
            <SignedOut>
              {clerkEnabled ? (
                <>
                  <SignInButton
                    mode="modal"
                    forceRedirectUrl="/boards"
                    signUpForceRedirectUrl="/boards"
                  >
                    <button type="button" className="hero-btn-primary cursor-pointer">
                      Open Boards
                    </button>
                  </SignInButton>
                  <SignInButton
                    mode="modal"
                    forceRedirectUrl="/onboarding"
                    signUpForceRedirectUrl="/onboarding"
                  >
                    <button type="button" className="hero-btn-secondary cursor-pointer">
                      Start Free in 2 Minutes
                    </button>
                  </SignInButton>
                </>
              ) : (
                <>
                  <Link href="/boards" className="hero-btn-primary">
                    Open Boards
                  </Link>
                  <Link href="/onboarding" className="hero-btn-secondary">
                    Start Free in 2 Minutes
                  </Link>
                </>
              )}
            </SignedOut>
            <SignedIn>
              <Link href="/boards" className="hero-btn-primary">
                Open Boards
              </Link>
              <Link href="/boards/new" className="hero-btn-secondary">
                Create Board
              </Link>
            </SignedIn>
          </motion.div>
        </div>

        {/* Trust bar — at bottom */}
        <TrustMarquee />
      </div>
    </section>
  );
}

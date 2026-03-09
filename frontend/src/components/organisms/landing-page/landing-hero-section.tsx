"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  SignInButton,
  SignedIn,
  SignedOut,
  isClerkEnabled,
} from "@/auth/clerk";
import HlsVideo from "@/components/organisms/landing-slideshow/hls-video";
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

export default function LandingHeroSection() {
  const clerkEnabled = isClerkEnabled();

  return (
    <section
      id="hero"
      className="relative min-h-screen overflow-hidden bg-black"
    >
      {/* Video — dark wave/aurora background, floats in the middle area */}
      <div className="absolute bottom-[35vh] left-0 right-0 h-[80vh] z-0">
        <HlsVideo
          src="https://stream.mux.com/9JXDljEVWYwWu01PUkAemafDugK89o01BR6zqJ3aS9u00A.m3u8"
          poster="https://image.mux.com/9JXDljEVWYwWu01PUkAemafDugK89o01BR6zqJ3aS9u00A/thumbnail.webp?time=0&width=1920"
          className="h-full w-full object-cover"
        />
      </div>

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
            Run Every Board in One Place
          </motion.h1>

          {/* Subtext */}
          <motion.p
            className="mt-6 max-w-xl text-center text-base leading-relaxed text-white/60 md:text-lg"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={2}
          >
            Track tasks, approvals, and agent health in realtime so teams ship
            faster with clear ownership and audit trails.
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

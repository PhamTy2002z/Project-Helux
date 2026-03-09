"use client";

import Link from "next/link";

import {
  SignInButton,
  SignedIn,
  SignedOut,
  isClerkEnabled,
} from "@/auth/clerk";
import { BlurReveal, SlideUpLine } from "@/components/organisms/landing-slideshow/animated-text";
import HlsVideo from "@/components/organisms/landing-slideshow/hls-video";

const PRIMARY_BTN =
  "rounded-full border border-white/30 bg-white/95 px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black";
const SECONDARY_BTN =
  "rounded-full border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black";

export default function LandingHeroSection() {
  const clerkEnabled = isClerkEnabled();

  return (
    <section
      id="hero"
      className="relative flex h-screen min-h-[600px] w-full flex-col overflow-hidden bg-black"
    >
      {/* Video background */}
      <HlsVideo
        src="https://stream.mux.com/Aa02T7oM1wH5Mk5EEVDYhbZ1ChcdhRsS2m1NYyx4Ua1g.m3u8"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-black/30" />

      {/* Content — centered vertically */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-[5%] pt-20 text-center">
        <BlurReveal delay={0.1}>
          <p className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-white/60">
            Mission Control Platform
          </p>
        </BlurReveal>

        <h1
          className="text-balance leading-[0.9] tracking-tight text-white"
          style={{ fontSize: "clamp(36px, 7vw, 96px)" }}
        >
          <SlideUpLine delay={0.3} duration={0.7}>
            Run Every Board in One Place.
          </SlideUpLine>
          <br />
          <SlideUpLine delay={0.4} duration={0.7}>
            Never Miss a Decision.
          </SlideUpLine>
        </h1>

        <BlurReveal delay={0.6}>
          <p
            className="mx-auto mt-6 max-w-[680px] text-white/80"
            style={{ fontSize: "clamp(14px, 1.2vw, 20px)", lineHeight: 1.6 }}
          >
            Track tasks, approvals, and agent health in realtime so teams ship
            faster with clear ownership and audit trails.
          </p>
        </BlurReveal>

        <BlurReveal delay={0.8} className="mt-8 flex flex-wrap justify-center gap-3">
          <SignedOut>
            {clerkEnabled ? (
              <>
                <SignInButton
                  mode="modal"
                  forceRedirectUrl="/boards"
                  signUpForceRedirectUrl="/boards"
                >
                  <button type="button" className={PRIMARY_BTN}>
                    Open Boards
                  </button>
                </SignInButton>
                <SignInButton
                  mode="modal"
                  forceRedirectUrl="/onboarding"
                  signUpForceRedirectUrl="/onboarding"
                >
                  <button type="button" className={SECONDARY_BTN}>
                    Start Free in 2 Minutes
                  </button>
                </SignInButton>
              </>
            ) : (
              <>
                <Link href="/boards" className={PRIMARY_BTN}>
                  Open Boards
                </Link>
                <Link href="/onboarding" className={SECONDARY_BTN}>
                  Start Free in 2 Minutes
                </Link>
              </>
            )}
          </SignedOut>
          <SignedIn>
            <Link href="/boards" className={PRIMARY_BTN}>
              Open Boards
            </Link>
            <Link href="/boards/new" className={SECONDARY_BTN}>
              Create Board
            </Link>
          </SignedIn>
        </BlurReveal>
      </div>

      {/* Scroll indicator */}
      <div className="relative z-10 flex justify-center pb-8">
        <BlurReveal delay={1.2}>
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs text-white/40">Scroll to explore</span>
            <div className="h-8 w-px animate-pulse bg-white/30" />
          </div>
        </BlurReveal>
      </div>
    </section>
  );
}

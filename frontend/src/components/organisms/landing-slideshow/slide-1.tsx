"use client";

import Link from "next/link";

import {
  SignInButton,
  SignedIn,
  SignedOut,
  isClerkEnabled,
} from "@/auth/clerk";

import { BlurReveal, SlideUpLine } from "./animated-text";
import HlsVideo from "./hls-video";
import Logo from "./logo";

const PRIMARY_BTN_CLASS =
  "rounded-full border border-white/30 bg-white/95 px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black";
const SECONDARY_BTN_CLASS =
  "rounded-full border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black";

const deckMeta = [
  { label: "Type", value: "Landing Deck" },
  { label: "Product", value: "OpenClaw" },
  { label: "Date", value: "March 2026" },
  { label: "Mode", value: "FlowGrid" },
];

export default function Slide1() {
  const clerkEnabled = isClerkEnabled();

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-black">
      <HlsVideo
        src="https://stream.mux.com/Aa02T7oM1wH5Mk5EEVDYhbZ1ChcdhRsS2m1NYyx4Ua1g.m3u8"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-black/30" />

      <div className="relative z-10 flex h-full w-full flex-col">
        <BlurReveal delay={0.1} className="px-[5%] pt-[3.5%]">
          <div className="flex items-start justify-between gap-6">
            <Logo />
            <div className="flex flex-wrap justify-end gap-5">
              {deckMeta.map((item) => (
                <div key={item.label} className="flex min-w-[110px] flex-col gap-[2px]">
                  <span className="text-[13px] text-[var(--slide-muted)]">{item.label}</span>
                  <span className="text-[13px] text-white">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </BlurReveal>

        <div className="mt-6 px-[5%]">
          <div className="h-px w-full bg-[var(--slide-divider)]" />
        </div>

        <div className="flex flex-1 flex-col justify-end px-[5%] pb-[8%]">
          <h1
            className="text-balance leading-[0.9] tracking-tight text-white"
            style={{ fontSize: "clamp(44px, 9vw, 128px)" }}
          >
            <SlideUpLine delay={0.3} duration={0.7}>Run Every Board in One Place.</SlideUpLine>
            <br />
            <SlideUpLine delay={0.4} duration={0.7}>Never Miss a Decision.</SlideUpLine>
          </h1>

          <p
            className="mt-5 max-w-[800px] text-white/85"
            style={{ fontSize: "clamp(14px, 1.3vw, 20px)" }}
          >
            Track tasks, approvals, and agent health in realtime so teams ship
            faster with clear ownership and audit trails.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <SignedOut>
              {clerkEnabled ? (
                <>
                  <SignInButton
                    mode="modal"
                    forceRedirectUrl="/boards"
                    signUpForceRedirectUrl="/boards"
                  >
                    <button type="button" className={PRIMARY_BTN_CLASS}>
                      Open Boards
                    </button>
                  </SignInButton>
                  <SignInButton
                    mode="modal"
                    forceRedirectUrl="/onboarding"
                    signUpForceRedirectUrl="/onboarding"
                  >
                    <button type="button" className={SECONDARY_BTN_CLASS}>
                      Start Free in 2 Minutes
                    </button>
                  </SignInButton>
                </>
              ) : (
                <>
                  <Link href="/boards" className={PRIMARY_BTN_CLASS}>
                    Open Boards
                  </Link>
                  <Link href="/onboarding" className={SECONDARY_BTN_CLASS}>
                    Start Free in 2 Minutes
                  </Link>
                </>
              )}
            </SignedOut>

            <SignedIn>
              <Link href="/boards" className={PRIMARY_BTN_CLASS}>
                Open Boards
              </Link>
              <Link href="/boards/new" className={SECONDARY_BTN_CLASS}>
                Create Board
              </Link>
            </SignedIn>
          </div>
        </div>
      </div>
    </div>
  );
}

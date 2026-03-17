"use client";

import Link from "next/link";
import { BlurReveal, WordByWordReveal } from "./animated-text";
import HlsVideo from "./hls-video";
import Logo from "./logo";

export default function Slide5() {
  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[var(--slide-bg-alt)]">
      <HlsVideo
        src="https://stream.mux.com/BuGGTsiXq1T00WUb8qfURrHkTCbhrkfFLSv4uAOZzdhw.m3u8"
        className="absolute object-cover"
        style={{ width: "150%", height: "150%", bottom: 0, left: 0 }}
      />
      <div className="absolute inset-0 bg-black/28" />

      <div className="relative z-10 flex h-full w-full flex-col">
        <BlurReveal delay={0.05} className="px-[5%] pt-[3.5%]">
          <div className="flex items-center justify-between">
            <Logo />
            <span className="text-[20px] leading-[1.4] text-[var(--slide-muted)]">
              05
            </span>
          </div>
        </BlurReveal>

        <div className="mt-6 px-[5%]">
          <div className="h-px w-full bg-[var(--slide-divider)]" />
        </div>

        <div className="flex-1" />

        <div className="max-w-[60%] px-[5%] pb-[5%]">
          <BlurReveal delay={0.15}>
            <p
              className="text-[var(--slide-muted)]"
              style={{ fontSize: "clamp(12px, 1.2vw, 26px)" }}
            >
              Go Live
            </p>
          </BlurReveal>
          <WordByWordReveal
            text="Start with one board then scale your operations with confidence"
            className="mt-3 leading-[1.04] text-white"
            style={{ fontSize: "clamp(20px, 4vw, 80px)" }}
            baseDelay={0.25}
            stagger={0.035}
            duration={0.55}
          />
          <BlurReveal delay={0.6} className="mt-4">
            <p
              className="max-w-[680px] text-[var(--slide-muted)]"
              style={{ fontSize: "clamp(12px, 1.1vw, 26px)" }}
            >
              Provision your first board, assign owners, and run approvals with
              full activity traceability from day one.
            </p>
          </BlurReveal>

          <BlurReveal delay={0.9} className="mt-8">
            <div className="flex flex-wrap gap-3">
              <Link
                href="/boards/new"
                className="rounded-full border border-white/30 bg-white/95 px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                Create Board
              </Link>
              <Link
                href="/activity"
                className="rounded-full border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                View Activity
              </Link>
            </div>
          </BlurReveal>
        </div>
      </div>
    </div>
  );
}

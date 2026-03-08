"use client";

import { BlurReveal, WordByWordReveal } from "./animated-text";
import HlsVideo from "./hls-video";
import Logo from "./logo";

export default function Slide4() {

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-black">
      <HlsVideo
        src="https://stream.mux.com/PkFsoKeakRLgL01gjf02CRcSbsJ600Z00NvLr9eRZ92pLbA.m3u8"
        className="absolute bottom-0 right-0 top-0 h-full object-cover"
        style={{ left: "400px" }}
      />
      <div className="absolute inset-0 bg-black/28" />

      <div className="relative z-10 flex h-full w-full flex-col">
        <div className="absolute left-0 right-0 top-0 px-[5%] pt-[3.5%]">
          <BlurReveal delay={0.05}>
            <div className="flex items-center justify-between">
              <Logo />
              <span className="text-[20px] leading-[1.4] text-[var(--slide-muted)]">04</span>
            </div>
          </BlurReveal>
        </div>

        <div className="absolute left-0 right-0 top-[calc(3.5%+52px)] px-[5%]">
          <div className="h-px w-full bg-[var(--slide-divider)]" />
        </div>

        <div className="flex h-full w-full flex-col justify-center">
          <div className="max-w-[65%] px-[5%]">
            <BlurReveal delay={0.15}>
              <p className="text-[var(--slide-muted)]" style={{ fontSize: "clamp(12px, 1.2vw, 26px)" }}>
                Workflow Orchestration
              </p>
            </BlurReveal>
            <WordByWordReveal
              text="Coordinate humans and agents in one execution loop with approvals and ownership built in"
              className="mt-3 leading-[1.04] text-white"
              style={{ fontSize: "clamp(20px, 4vw, 80px)" }}
              baseDelay={0.25}
              stagger={0.035}
              duration={0.55}
            />
            <BlurReveal delay={1.2} className="mt-6">
              <p className="max-w-[784px] text-[var(--slide-muted)]" style={{ fontSize: "clamp(12px, 1.1vw, 26px)" }}>
                Configure board-level controls, route sensitive actions through
                approvals, and keep distributed execution visible from start to
                finish.
              </p>
            </BlurReveal>
          </div>
        </div>
      </div>
    </div>
  );
}

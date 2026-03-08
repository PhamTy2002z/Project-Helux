"use client";

import { motion, useReducedMotion } from "framer-motion";

import { BlurReveal, WordByWordReveal } from "./animated-text";
import HlsVideo from "./hls-video";
import Logo from "./logo";

const EASING: [number, number, number, number] = [0.25, 0.1, 0.25, 1];

const stats = [
  { value: "80%", label: "Teams lose context between tools" },
  { value: "63%", label: "Approvals slow down releases" },
  { value: "47%", label: "Ops decisions lack live signals" },
];

export default function Slide2() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-black">
      <HlsVideo
        src="https://stream.mux.com/s8pMcOvMQXc4GD6AX4e1o01xFogFxipmuKltNfSYza0200.m3u8"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-black/32" />

      <div className="relative z-10 flex h-full w-full flex-col">
        <BlurReveal delay={0.05} className="px-[5%] pt-[3.5%]">
          <div className="flex items-center justify-between">
            <Logo />
            <span className="text-[20px] leading-[1.4] text-[var(--slide-muted)]">02</span>
          </div>
        </BlurReveal>

        <div className="mt-6 px-[5%]">
          <div className="h-px w-full bg-[var(--slide-divider)]" />
        </div>

        <div className="flex flex-1 flex-col justify-between px-[5%] pb-[5%] pt-[4%]">
          <div className="max-w-[85%]">
            <BlurReveal delay={0.15}>
              <p className="text-[var(--slide-muted)]" style={{ fontSize: "clamp(12px, 1.2vw, 18px)" }}>
                Operational Gap
              </p>
            </BlurReveal>
            <WordByWordReveal
              text="Workstreams break when tasks, approvals, and agent status are split across disconnected dashboards"
              className="mt-3 leading-[1.04] text-white"
              style={{ fontSize: "clamp(22px, 3.5vw, 56px)" }}
              baseDelay={0.25}
              stagger={0.035}
              duration={0.55}
            />
          </div>

          <div className="flex w-full flex-wrap gap-4">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.value}
                className="flex min-w-[190px] flex-1 flex-col gap-3"
                initial={shouldReduceMotion ? false : { y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{
                  duration: shouldReduceMotion ? 0 : 0.6,
                  delay: shouldReduceMotion ? 0 : 0.6 + index * 0.1,
                  ease: EASING,
                }}
              >
                <span
                  className="leading-[0.96] tracking-tight text-white"
                  style={{ fontSize: "clamp(32px, 6vw, 96px)" }}
                >
                  {stat.value}
                </span>
                <span className="leading-[1.4] text-white" style={{ fontSize: "clamp(13px, 1.2vw, 20px)" }}>
                  {stat.label}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

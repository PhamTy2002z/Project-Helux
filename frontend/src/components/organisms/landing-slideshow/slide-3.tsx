"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useId } from "react";

import { BlurReveal, WordByWordReveal } from "./animated-text";
import HlsVideo from "./hls-video";
import Logo from "./logo";

const EASING: [number, number, number, number] = [0.25, 0.1, 0.25, 1];
const LOW_MARKER_SIZE = 10;
const MID_MARKER_SIZE = 12;
const UPPER_MARKER_SIZE = 13;
const HIGH_MARKER_SIZE = 14;
const LOW_MARKER_HALO_SIZE = 48;
const MID_MARKER_HALO_SIZE = 56;
const UPPER_MARKER_HALO_SIZE = 60;
const HIGH_MARKER_HALO_SIZE = 64;
const LOW_MARKER_LABEL_SIZE = "clamp(14px, 1.4vw, 22px)";
const MID_MARKER_LABEL_SIZE = "clamp(20px, 2vw, 34px)";
const UPPER_MARKER_LABEL_SIZE = "clamp(26px, 2.8vw, 46px)";
const HIGH_MARKER_LABEL_SIZE = "clamp(32px, 4vw, 64px)";

const years = ["2018", "2019", "2020", "2021", "2022", "2023", "2024", "2025"];
const curvePath =
  "M 0 280 C 40 275, 80 270, 120 260 C 160 250, 200 235, 240 215 C 280 195, 320 170, 360 140 C 400 110, 440 75, 480 40 C 500 22, 520 8, 540 0";

type GradientDotProps = {
  size?: number;
};

function GradientDot({ size = MID_MARKER_SIZE }: GradientDotProps) {
  const gradientId = `dot-grad-${useId().replace(/:/g, "")}`;

  return (
    <div style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="block"
      >
        <defs>
          <radialGradient id={gradientId}>
            <stop offset="0%" stopColor="var(--slide-blue-light)" />
            <stop offset="100%" stopColor="var(--slide-blue-dark)" />
          </radialGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - 1}
          fill={`url(#${gradientId})`}
          stroke="white"
          strokeWidth="1.5"
        />
      </svg>
    </div>
  );
}

export default function Slide3() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-black">
      <HlsVideo
        src="https://stream.mux.com/Gs3wZfrtz6ZfqZqQ02c02Z7lugV00FGZvRpcqFTel66r3g.m3u8"
        className="absolute inset-0 h-full w-full object-cover"
        style={{ transform: "scale(-1, -1)", opacity: 0.5 }}
      />
      <div className="absolute inset-0 bg-black/32" />

      <div className="relative z-10 flex h-full w-full flex-col">
        <BlurReveal delay={0.05} className="px-[5%] pt-[3.5%]">
          <div className="flex items-center justify-between">
            <Logo />
            <span className="text-[20px] leading-[1.4] text-[var(--slide-muted)]">
              03
            </span>
          </div>
        </BlurReveal>

        <div className="mt-6 px-[5%]">
          <div className="h-px w-full bg-[var(--slide-divider)]" />
        </div>

        <div className="max-w-[55%] px-[5%] pt-[3%]">
          <BlurReveal delay={0.15}>
            <p
              className="text-[var(--slide-muted)]"
              style={{ fontSize: "clamp(12px, 1.2vw, 18px)" }}
            >
              Realtime Visibility
            </p>
          </BlurReveal>
          <WordByWordReveal
            text="Track execution momentum from one command surface across boards, agents, and approvals"
            className="mt-3 leading-[1.04] text-white"
            style={{ fontSize: "clamp(20px, 3.2vw, 52px)" }}
            baseDelay={0.25}
            stagger={0.035}
            duration={0.55}
          />
          <BlurReveal delay={0.8} className="mt-4">
            <p
              className="max-w-[90%] text-[var(--slide-muted)]"
              style={{ fontSize: "clamp(12px, 1.1vw, 18px)" }}
            >
              Bring task progress, pending approvals, and agent health updates
              into one place so operators can act fast without losing context.
            </p>
          </BlurReveal>
        </div>

        <motion.div
          className="absolute bottom-[3%] left-0 right-0 top-[40%]"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: shouldReduceMotion ? 0 : 0.8,
            delay: shouldReduceMotion ? 0 : 0.7,
            ease: EASING,
          }}
        >
          <div className="absolute bottom-0 right-0 h-[70%] w-[55%]">
            <svg
              width="100%"
              height="100%"
              viewBox="0 0 540 300"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient
                  id="line-grad"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="0%"
                >
                  <stop offset="0%" stopColor="var(--slide-purple)" />
                  <stop offset="100%" stopColor="var(--slide-pink)" />
                </linearGradient>
                <linearGradient id="area-grad" x1="0.5" y1="0" x2="0.5" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--slide-purple)"
                    stopOpacity="0.4"
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--slide-purple)"
                    stopOpacity="0"
                  />
                </linearGradient>
                <linearGradient
                  id="opacity-line-grad"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="0%"
                >
                  <stop offset="0%" stopColor="white" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="white" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d={`${curvePath} L 540 300 L 0 300 Z`}
                fill="url(#area-grad)"
              />
              <path
                d={curvePath}
                fill="none"
                stroke="url(#opacity-line-grad)"
                strokeWidth="24"
              />
              <path
                d={curvePath}
                fill="none"
                stroke="url(#line-grad)"
                strokeWidth="4"
              />
            </svg>
          </div>

          <div className="absolute bottom-[22%] left-[44%] flex flex-col items-center">
            <span
              className="mb-1 font-medium text-white"
              style={{ fontSize: LOW_MARKER_LABEL_SIZE }}
            >
              32%
            </span>
            <div className="h-[40px] w-[2px] bg-white" />
            <div
              className="mt-1 flex items-center justify-center rounded-full bg-white/[0.08]"
              style={{
                width: LOW_MARKER_HALO_SIZE,
                height: LOW_MARKER_HALO_SIZE,
              }}
            >
              <GradientDot size={LOW_MARKER_SIZE} />
            </div>
          </div>

          <div className="absolute right-[5%] top-[-1%] flex flex-col items-center">
            <span
              className="tracking-tight text-white"
              style={{ fontSize: HIGH_MARKER_LABEL_SIZE }}
            >
              127%
            </span>
            <div className="h-[50px] w-[2px] bg-white" />
            <div
              className="mt-1 flex items-center justify-center rounded-full bg-white/[0.08]"
              style={{
                width: HIGH_MARKER_HALO_SIZE,
                height: HIGH_MARKER_HALO_SIZE,
              }}
            >
              <GradientDot size={HIGH_MARKER_SIZE} />
            </div>
          </div>

          <div className="absolute right-[20%] top-[24%] flex flex-col items-center">
            <span
              className="mb-1 font-medium text-white"
              style={{ fontSize: UPPER_MARKER_LABEL_SIZE }}
            >
              102%
            </span>
            <div className="h-[38px] w-[2px] bg-white" />
            <div
              className="mt-1 flex items-center justify-center rounded-full bg-white/[0.08]"
              style={{
                width: UPPER_MARKER_HALO_SIZE,
                height: UPPER_MARKER_HALO_SIZE,
              }}
            >
              <GradientDot size={UPPER_MARKER_SIZE} />
            </div>
          </div>

          <div className="absolute right-[37%] top-[40%] flex flex-col items-center">
            <span
              className="mb-1 font-medium text-white"
              style={{ fontSize: MID_MARKER_LABEL_SIZE }}
            >
              73%
            </span>
            <div className="h-[30px] w-[2px] bg-white" />
            <div
              className="mt-1 flex items-center justify-center rounded-full bg-white/[0.08]"
              style={{
                width: MID_MARKER_HALO_SIZE,
                height: MID_MARKER_HALO_SIZE,
              }}
            >
              <GradientDot size={MID_MARKER_SIZE} />
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0">
            <div className="h-[1px] w-full bg-[var(--slide-axis)]" />
            <div className="mt-2 flex justify-between px-4">
              {years.map((year) => (
                <span
                  key={year}
                  className="text-[var(--slide-muted)]"
                  style={{ fontSize: "clamp(11px, 1vw, 18px)" }}
                >
                  {year}
                </span>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

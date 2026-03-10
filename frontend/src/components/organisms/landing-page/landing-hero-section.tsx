"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { useAuth } from "@/auth/clerk";
import TrustMarquee from "./trust-marquee";

const HERO_ANIMATION_VIDEO_SRC =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260306_074215_04640ca7-042c-45d6-bb56-58b1e8a42489.mp4";
const HERO_ANIMATION_VIDEO_POSTER = "/videos/hero-animation-poster.jpg?v=20260310";
const HERO_LOOP_BLEND_MS = 700;
const HERO_LOOP_BLEND_SECONDS = HERO_LOOP_BLEND_MS / 1000;
const HERO_COPY_DELAYS = {
  title: "120ms",
  subtitle: "240ms",
  cta: "360ms",
} as const;

type NetworkAwareNavigator = Navigator & {
  connection?: {
    effectiveType?: string;
    saveData?: boolean;
  };
  deviceMemory?: number;
};

export default function LandingHeroSection() {
  const hasHydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const [shouldReduceMotion, setShouldReduceMotion] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([null, null]);
  const activeVideoIndexRef = useRef(0);
  const blendTimeoutRef = useRef<number | null>(null);
  const standbyStartingRef = useRef(false);
  const [canPlayHeroVideo, setCanPlayHeroVideo] = useState(false);
  const [canBlendHeroVideo, setCanBlendHeroVideo] = useState(false);
  const [isHeroVisible, setIsHeroVisible] = useState(true);
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  const { isSignedIn } = useAuth();
  const showOpenBoardCta = hasHydrated && Boolean(isSignedIn);
  const visibleVideoIndex =
    canBlendHeroVideo && canPlayHeroVideo && isHeroVisible ? activeVideoIndex : 0;

  const clearBlendTimeout = useCallback(() => {
    if (blendTimeoutRef.current === null) return;
    window.clearTimeout(blendTimeoutRef.current);
    blendTimeoutRef.current = null;
  }, []);

  const playVideo = useCallback((video: HTMLVideoElement | null) => {
    if (!video) return;
    const playResult = video.play();
    if (typeof playResult?.catch === "function") {
      void playResult.catch(() => undefined);
    }
  }, []);

  const stopVideo = useCallback((video: HTMLVideoElement | null) => {
    if (!video) return;
    video.pause();
    try {
      video.currentTime = 0;
    } catch {
      // Ignore browsers that block direct seek while metadata is not ready.
    }
  }, []);

  const syncActiveVideo = useCallback((nextIndex: number) => {
    activeVideoIndexRef.current = nextIndex;
    setActiveVideoIndex(nextIndex);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const desktopQuery = window.matchMedia("(min-width: 768px)");
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (navigator as NetworkAwareNavigator).connection;
    const hardwareThreads = navigator.hardwareConcurrency || 8;
    const deviceMemory = (navigator as NetworkAwareNavigator).deviceMemory ?? 8;

    const syncHeroVideoPolicy = () => {
      const reducedMotionEnabled = reducedMotionQuery.matches;
      const shouldDisableForNetwork =
        connection?.saveData === true ||
        connection?.effectiveType === "2g" ||
        connection?.effectiveType === "3g";
      const canPlay =
        desktopQuery.matches &&
        !reducedMotionEnabled &&
        !shouldDisableForNetwork &&
        hardwareThreads > 4 &&
        deviceMemory > 4;

      setShouldReduceMotion(reducedMotionEnabled);
      setCanPlayHeroVideo(canPlay);
      setCanBlendHeroVideo(canPlay && hardwareThreads >= 8 && deviceMemory >= 8);
    };

    syncHeroVideoPolicy();
    desktopQuery.addEventListener("change", syncHeroVideoPolicy);
    reducedMotionQuery.addEventListener("change", syncHeroVideoPolicy);

    return () => {
      desktopQuery.removeEventListener("change", syncHeroVideoPolicy);
      reducedMotionQuery.removeEventListener("change", syncHeroVideoPolicy);
    };
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const activeEntry = entries[0];
        if (!activeEntry) return;
        setIsHeroVisible(activeEntry.isIntersecting && activeEntry.intersectionRatio >= 0.25);
      },
      { threshold: [0, 0.25, 0.6] }
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  const handleVideoTimeUpdate = useCallback((videoIndex: number) => {
    if (!canBlendHeroVideo || !canPlayHeroVideo || shouldReduceMotion || !isHeroVisible) {
      return;
    }
    if (standbyStartingRef.current || activeVideoIndexRef.current !== videoIndex) return;

    const activeVideo = videoRefs.current[videoIndex];
    if (!activeVideo) return;

    const duration = activeVideo.duration;
    if (!Number.isFinite(duration) || duration <= HERO_LOOP_BLEND_SECONDS + 0.15) return;

    const remainingTime = duration - activeVideo.currentTime;
    if (remainingTime > HERO_LOOP_BLEND_SECONDS) return;

    const standbyIndex = videoIndex === 0 ? 1 : 0;
    const standbyVideo = videoRefs.current[standbyIndex];
    if (!standbyVideo) return;

    standbyStartingRef.current = true;
    clearBlendTimeout();

    try {
      standbyVideo.currentTime = 0;
    } catch {
      // Ignore browsers that block direct seek while metadata is not ready.
    }

    playVideo(standbyVideo);
    syncActiveVideo(standbyIndex);

    blendTimeoutRef.current = window.setTimeout(() => {
      stopVideo(activeVideo);
      standbyStartingRef.current = false;
      blendTimeoutRef.current = null;
    }, HERO_LOOP_BLEND_MS);
  }, [
    canBlendHeroVideo,
    canPlayHeroVideo,
    clearBlendTimeout,
    isHeroVisible,
    playVideo,
    shouldReduceMotion,
    stopVideo,
    syncActiveVideo,
  ]);

  useEffect(() => {
    const videos = videoRefs.current;

    if (!canPlayHeroVideo || shouldReduceMotion || !isHeroVisible) {
      clearBlendTimeout();
      standbyStartingRef.current = false;
      activeVideoIndexRef.current = 0;
      videos.forEach((video) => stopVideo(video));
      return;
    }

    if (!canBlendHeroVideo) {
      clearBlendTimeout();
      standbyStartingRef.current = false;
      activeVideoIndexRef.current = 0;
      stopVideo(videos[1]);
      playVideo(videos[0]);
      return;
    }

    playVideo(videos[activeVideoIndexRef.current]);
  }, [
    canBlendHeroVideo,
    canPlayHeroVideo,
    clearBlendTimeout,
    isHeroVisible,
    playVideo,
    shouldReduceMotion,
    stopVideo,
    syncActiveVideo,
  ]);

  useEffect(() => () => clearBlendTimeout(), [clearBlendTimeout]);

  return (
    <section
      id="hero"
      ref={sectionRef}
      className="relative min-h-[100svh] scroll-mt-24 overflow-hidden bg-black lg:scroll-mt-28"
    >
      {/* Background animation video from viral-vision-hero */}
      {Array.from({ length: canBlendHeroVideo ? 2 : 1 }).map((_, videoIndex) => (
        <video
          key={videoIndex}
          ref={(element) => {
            videoRefs.current[videoIndex] = element;
          }}
          className={`hero-media-layer absolute inset-0 z-0 h-full w-full object-cover transition-opacity duration-700 ${
            visibleVideoIndex === videoIndex ? "opacity-100" : "opacity-0"
          }`}
          src={canPlayHeroVideo ? HERO_ANIMATION_VIDEO_SRC : undefined}
          poster={HERO_ANIMATION_VIDEO_POSTER}
          autoPlay={
            canPlayHeroVideo &&
            isHeroVisible &&
            !shouldReduceMotion &&
            videoIndex === 0
          }
          muted
          playsInline
          loop={!canBlendHeroVideo}
          preload={canPlayHeroVideo ? "metadata" : "none"}
          aria-hidden="true"
          onTimeUpdate={canBlendHeroVideo ? () => handleVideoTimeUpdate(videoIndex) : undefined}
        />
      ))}
      {/* Content */}
      <div className="relative z-10 flex min-h-[100svh] flex-col">
        <div className="flex flex-1 flex-col items-center justify-center px-6 pb-24 pt-24 md:pt-28">
          <h1
            className="hero-copy-anim max-w-4xl text-center text-[36px] font-light leading-[1.08] tracking-[-0.02em] text-white sm:text-5xl md:text-[60px] lg:text-[68px] fhd:max-w-5xl fhd:text-[74px] qhd:max-w-[1080px] qhd:text-[80px] uhd:max-w-[1200px] uhd:text-[88px]"
            style={
              {
                "--hero-copy-delay": HERO_COPY_DELAYS.title,
              } as CSSProperties
            }
          >
            Mission Control for Coordinating Multi-Agent Work Across Every Board
          </h1>

          <p
            className="hero-copy-anim mt-6 max-w-2xl text-center text-sm leading-relaxed text-white/80 sm:text-base md:text-lg fhd:max-w-3xl fhd:text-xl qhd:max-w-[860px] qhd:text-[22px]"
            style={
              {
                "--hero-copy-delay": HERO_COPY_DELAYS.subtitle,
              } as CSSProperties
            }
          >
            Manage tasks, approvals, agent health, and gateway activity in one
            secure workspace with full audit history.
          </p>

          <div
            className="hero-copy-anim mt-9 flex min-h-12 w-full items-center justify-center"
            style={
              {
                "--hero-copy-delay": HERO_COPY_DELAYS.cta,
              } as CSSProperties
            }
          >
            {!showOpenBoardCta ? (
              <Link
                href="/onboarding"
                prefetch={false}
                className="hero-btn-demo min-h-12 px-8 text-base"
              >
                Request a Demo
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            ) : (
              <Link href="/boards" className="hero-btn-demo min-h-12 px-8 text-base">
                Open Board
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            )}
          </div>
        </div>

        {/* Trust bar — at bottom */}
        <TrustMarquee />
      </div>
    </section>
  );
}

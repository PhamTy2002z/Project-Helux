"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { LayoutDashboard, Bot, Router, Boxes } from "lucide-react";
import { ScrollReveal } from "./scroll-reveal";

const VIDEO_ASSET_VERSION = "20260310";
const withAssetVersion = (assetPath: string) =>
  `${assetPath}?v=${VIDEO_ASSET_VERSION}`;
const PREVIEW_ASPECT_RATIO = "1280 / 644";

const TABS = [
  {
    id: "gateways",
    label: "Multi-Agent",
    icon: Router,
    href: "/gateways",
    previewVideo: "/videos/multi-agent-workspace-preview.mp4",
    previewPoster: "/videos/multi-agent-workspace-preview-poster.jpg",
    description:
      "Orchestrate multi-agent routing, manage webhooks, and control how work flows between boards, agents, and external services.",
  },
  {
    id: "boards",
    label: "Boards",
    icon: LayoutDashboard,
    href: "/boards",
    previewVideo: "/videos/boards-workspace-preview.mp4",
    previewPoster: "/videos/boards-workspace-preview-poster.jpg",
    description:
      "Manage tasks, approvals, and real-time execution signals from a unified command surface. No more context switching between tools.",
  },
  {
    id: "agents",
    label: "Agents",
    icon: Bot,
    href: "/agents",
    previewVideo: "/videos/agents-workspace-preview.mp4",
    previewPoster: "/videos/agents-workspace-preview-poster.jpg",
    description:
      "Coordinate humans and AI agents in one execution loop. Monitor agent health, review logs, and manage automated workflows.",
  },
  {
    id: "skills",
    label: "Skills",
    icon: Boxes,
    href: "/skills",
    previewVideo: "/videos/skills-workspace-preview.mp4",
    previewPoster: "/videos/skills-workspace-preview-poster.jpg",
    description:
      "Browse the skill marketplace, deploy capability packs to your agents, and extend your platform with community contributions.",
  },
];

export default function ProductTabs() {
  const [activeTab, setActiveTab] = useState(0);
  const [canLoadVideos, setCanLoadVideos] = useState(false);
  const [isSectionVisible, setIsSectionVisible] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);
  const activeVideoRef = useRef<HTMLVideoElement | null>(null);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (canLoadVideos) return;
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setCanLoadVideos(true);
          observer.disconnect();
        }
      },
      { rootMargin: "240px 0px" },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, [canLoadVideos]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const activeEntry = entries[0];
        if (!activeEntry) return;
        setIsSectionVisible(
          activeEntry.isIntersecting && activeEntry.intersectionRatio >= 0.15,
        );
      },
      { threshold: [0, 0.15, 0.45] },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const activeVideo = activeVideoRef.current;
    if (!activeVideo) return;

    if (!canLoadVideos || shouldReduceMotion || !isSectionVisible) {
      activeVideo.pause();
      return;
    }

    const playResult = activeVideo.play();
    if (typeof playResult?.catch === "function") {
      void playResult.catch(() => undefined);
    }
  }, [activeTab, canLoadVideos, isSectionVisible, shouldReduceMotion]);

  /* WAI-ARIA tabs: arrow-key navigation between tabs */
  const handleTabKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      let next = activeTab;
      if (e.key === "ArrowRight") next = (activeTab + 1) % TABS.length;
      else if (e.key === "ArrowLeft")
        next = (activeTab - 1 + TABS.length) % TABS.length;
      else return;
      e.preventDefault();
      startTransition(() => setActiveTab(next));
      /* Focus the newly active tab button */
      const tablist = e.currentTarget;
      const buttons =
        tablist.querySelectorAll<HTMLButtonElement>('[role="tab"]');
      buttons[next]?.focus();
    },
    [activeTab],
  );

  const handleActivateTab = useCallback((index: number) => {
    startTransition(() => setActiveTab(index));
  }, []);

  return (
    <section
      id="product"
      ref={sectionRef}
      className="landing-deferred-section relative scroll-mt-24 overflow-hidden bg-black px-4 py-24 sm:px-6 lg:scroll-mt-28 lg:px-10 fhd:px-14 qhd:px-16 uhd:px-20"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/[0.03] to-transparent" />
      </div>

      <div className="mx-auto w-full max-w-[1280px] fhd:max-w-[1440px] qhd:max-w-[1600px] uhd:max-w-[1760px]">
        <ScrollReveal className="mb-16 text-center">
          <h2
            className="text-balance text-white"
            style={{ fontSize: "clamp(26px, 3.5vw, 52px)" }}
          >
            The VisgniteAI Platform
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-balance text-[13px] leading-relaxed text-white/55 sm:text-sm md:max-w-3xl fhd:text-base">
            Keep every operational surface in one cohesive system without losing
            clarity or control.
          </p>
        </ScrollReveal>

        {/* Tab bar */}
        <ScrollReveal>
          <div
            className="mb-12 flex flex-wrap justify-center gap-3"
            role="tablist"
            aria-label="Product areas"
            onKeyDown={handleTabKeyDown}
          >
            {TABS.map((tab, index) => {
              const Icon = tab.icon;
              const isActive = activeTab === index;
              return (
                <button
                  key={tab.id}
                  id={`${tab.id}-tab`}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`panel-${tab.id}`}
                  tabIndex={isActive ? 0 : -1}
                  className={`flex min-h-[40px] cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:text-sm ${
                    isActive
                      ? "border-white/80 bg-white text-black shadow-[0_10px_30px_rgba(255,255,255,0.16)]"
                      : "hero-glass-card border-white/15 text-white/70 hover:border-white/30 hover:text-white"
                  }`}
                  onClick={() => handleActivateTab(index)}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </ScrollReveal>

        {/* Tab content */}
        <div className="relative min-h-[280px]">
          <AnimatePresence mode="wait">
            {TABS.map(
              (tab, index) =>
                activeTab === index && (
                  <motion.div
                    key={tab.id}
                    id={`panel-${tab.id}`}
                    role="tabpanel"
                    aria-labelledby={`${tab.id}-tab`}
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={
                      shouldReduceMotion ? undefined : { opacity: 0, y: -10 }
                    }
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="hero-glass-card mx-auto flex w-full max-w-[1200px] flex-col items-center rounded-3xl border border-white/15 px-5 py-6 sm:px-6 sm:py-8 md:px-10 md:py-10 fhd:max-w-[1360px] qhd:max-w-[1520px] uhd:max-w-[1680px]"
                  >
                    {/* Product surface preview card */}
                    <div className="mb-7 w-full max-w-[1100px] rounded-2xl border border-white/15 bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-2.5 md:p-3.5 fhd:max-w-[1180px] qhd:max-w-[1240px] uhd:max-w-[1280px]">
                      {tab.previewVideo ? (
                        <>
                          <div className="mb-3 flex items-center rounded-xl border border-white/10 bg-black/65 px-3 py-2">
                            <div className="flex items-center gap-1.5">
                              <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
                              <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
                              <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                            </div>
                            <p className="ml-3 text-xs font-medium text-white/45">
                              {tab.label} workspace preview
                            </p>
                          </div>

                          <div className="overflow-hidden rounded-xl border border-white/10 bg-black">
                            <div
                              className="w-full"
                              style={{ aspectRatio: PREVIEW_ASPECT_RATIO }}
                            >
                              <video
                                ref={activeVideoRef}
                                key={tab.previewVideo}
                                className="h-full w-full object-contain object-top"
                                src={
                                  canLoadVideos
                                    ? withAssetVersion(tab.previewVideo)
                                    : undefined
                                }
                                poster={withAssetVersion(tab.previewPoster)}
                                autoPlay={
                                  canLoadVideos &&
                                  isSectionVisible &&
                                  !shouldReduceMotion
                                }
                                loop
                                muted
                                playsInline
                                preload={canLoadVideos ? "auto" : "none"}
                                disablePictureInPicture
                                aria-label={`${tab.label} workspace preview video`}
                              />
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="flex h-[320px] items-center justify-center text-center">
                          <div>
                            <tab.icon
                              size={48}
                              className="mx-auto mb-3 text-white/30"
                            />
                            <p className="text-sm text-white/45">
                              {tab.label} workspace preview
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Description */}
                    <p className="max-w-2xl text-center text-[13px] leading-relaxed text-white/70 sm:text-sm md:max-w-3xl fhd:text-base">
                      {tab.description}
                    </p>
                    <Link
                      href={tab.href}
                      prefetch={false}
                      className="mt-5 inline-flex min-h-[40px] items-center rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:text-sm"
                    >
                      Explore {tab.label}
                    </Link>
                  </motion.div>
                ),
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

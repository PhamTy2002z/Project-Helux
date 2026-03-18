"use client";

import type { CSSProperties } from "react";
import { useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { useAuth } from "@/auth/clerk";
import TrustMarquee from "./trust-marquee";

const HERO_COPY_DELAYS = {
  title: "120ms",
  subtitle: "240ms",
  cta: "360ms",
} as const;

export default function LandingHeroSection() {
  const hasHydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const { isSignedIn } = useAuth();
  const showOpenBoardCta = hasHydrated && Boolean(isSignedIn);

  return (
    <section
      id="hero"
      className="relative min-h-[100svh] scroll-mt-24 overflow-hidden bg-[#0a0a0a] lg:scroll-mt-28"
    >
      {/* Star animation keyframes — uses transform (GPU-composited) instead of background-position */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes rising-stars {
          from { transform: translateY(0); }
          to { transform: translateY(-1200px); }
        }
        .animate-stars-slow { animation: rising-stars 150s linear infinite; will-change: transform; }
        .animate-stars-medium { animation: rising-stars 90s linear infinite; will-change: transform; }
        .animate-stars-fast { animation: rising-stars 60s linear infinite; will-change: transform; }
        @media (prefers-reduced-motion: reduce) {
          .animate-stars-slow, .animate-stars-medium, .animate-stars-fast {
            animation: none; will-change: auto;
          }
        }
      `,
        }}
      />

      {/* Background: top-left white/grey glow — contain:strict isolates compositing */}
      <div className="pointer-events-none absolute left-[0%] top-[0%] h-[50vw] max-h-[800px] w-[50vw] max-w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.03] blur-[100px] [contain:strict]" />

      {/* Background: top-right orange/red glow */}
      <div className="pointer-events-none absolute right-[0%] top-[0%] h-[40vw] max-h-[600px] w-[40vw] max-w-[600px] translate-x-1/3 -translate-y-1/3 rounded-full bg-orange-600/10 blur-[100px] [contain:strict]" />

      {/* Stars layer 1 — smallest, slowest. Extra height for translateY loop headroom */}
      <div
        className="animate-stars-slow pointer-events-none absolute inset-0 z-0 h-[calc(100%+1200px)]"
        style={{
          backgroundImage: `
            radial-gradient(1.5px 1.5px at 20px 30px, rgba(255,255,255,1), transparent),
            radial-gradient(1.5px 1.5px at 80px 120px, rgba(255,255,255,1), transparent),
            radial-gradient(1.5px 1.5px at 150px 60px, rgba(255,255,255,1), transparent),
            radial-gradient(1.5px 1.5px at 180px 180px, rgba(255,255,255,1), transparent)
          `,
          backgroundRepeat: "repeat",
          backgroundSize: "200px 200px",
        }}
      />

      {/* Stars layer 2 — medium */}
      <div
        className="animate-stars-medium pointer-events-none absolute inset-0 z-0 h-[calc(100%+1200px)]"
        style={{
          backgroundImage: `
            radial-gradient(2px 2px at 30px 40px, rgba(255,255,255,1), transparent),
            radial-gradient(2px 2px at 120px 150px, rgba(255,255,255,1), transparent),
            radial-gradient(2px 2px at 200px 80px, rgba(255,255,255,1), transparent),
            radial-gradient(2px 2px at 250px 220px, rgba(255,255,255,1), transparent)
          `,
          backgroundRepeat: "repeat",
          backgroundSize: "300px 300px",
        }}
      />

      {/* Stars layer 3 — largest, fastest */}
      <div
        className="animate-stars-fast pointer-events-none absolute inset-0 z-0 h-[calc(100%+1200px)]"
        style={{
          backgroundImage: `
            radial-gradient(3px 3px at 50px 50px, rgba(255,255,255,1), transparent),
            radial-gradient(3.5px 3.5px at 150px 250px, rgba(255,255,255,1), transparent),
            radial-gradient(3px 3px at 300px 100px, rgba(255,255,255,1), transparent),
            radial-gradient(3.5px 3.5px at 350px 350px, rgba(255,255,255,1), transparent)
          `,
          backgroundRepeat: "repeat",
          backgroundSize: "400px 400px",
        }}
      />

      {/* Deep central orange glow */}
      <div className="pointer-events-none absolute left-1/2 top-[50%] z-0 h-[60vh] w-[80vw] max-w-[1400px] -translate-x-1/2 -translate-y-[20%] rounded-[100%] bg-orange-600/20 blur-[120px] [contain:strict]" />

      {/* Planet horizon */}
      <div className="pointer-events-none absolute bottom-0 left-1/2 z-0 h-[40vh] min-h-[400px] w-[200%] -translate-x-1/2 translate-y-[40%] md:w-[150%] lg:w-[120%]">
        <div className="relative h-full w-full rounded-[100%] bg-[#0a0a0a]">
          {/* Bright top border glow line */}
          <div className="absolute inset-0 z-10 rounded-[100%] border-t-[2px] border-orange-200 shadow-[0_-8px_30px_2px_rgba(249,115,22,0.6),inset_0_10px_30px_rgba(249,115,22,0.4)]" />
          {/* Ambient glow above horizon */}
          <div className="absolute inset-0 rounded-[100%] shadow-[0_-50px_150px_40px_rgba(234,88,12,0.15)]" />
          {/* Inner shading for 3D depth */}
          <div className="absolute inset-0 rounded-[100%] bg-gradient-to-b from-orange-950/40 via-transparent to-transparent" />
        </div>
      </div>

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
            One Platform to Orchestrate Every Agent, Board, and Approval
          </h1>

          <p
            className="hero-copy-anim mt-6 max-w-2xl text-center text-sm leading-relaxed text-white/80 sm:text-base md:text-lg fhd:max-w-3xl fhd:text-xl qhd:max-w-[860px] qhd:text-[22px]"
            style={
              {
                "--hero-copy-delay": HERO_COPY_DELAYS.subtitle,
              } as CSSProperties
            }
          >
            FlowGrid gives your team one secure workspace to run agent
            operations, approvals, and gateways — with full visibility and zero
            handoff friction.
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
                Start Building Free
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            ) : (
              <Link
                href="/boards"
                className="hero-btn-demo min-h-12 px-8 text-base"
              >
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

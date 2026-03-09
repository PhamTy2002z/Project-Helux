"use client";

import { type ReactNode, useEffect, useRef } from "react";
import Lenis from "lenis";

export function ScrollProvider({ children }: { children: ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    const browserNavigator = navigator as Navigator & {
      connection?: { saveData?: boolean };
    };
    const prefersReducedMotion = window
      .matchMedia("(prefers-reduced-motion: reduce)")
      .matches;
    const saveDataEnabled = browserNavigator.connection?.saveData === true;
    const lowEndCpu =
      browserNavigator.hardwareConcurrency > 0 &&
      browserNavigator.hardwareConcurrency <= 4;

    if (prefersReducedMotion || saveDataEnabled || lowEndCpu) return;

    const lenis = new Lenis({
      lerp: 0.1,
      duration: 1.2,
    });
    lenisRef.current = lenis;

    let rafId: number | null = null;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };

    const startRaf = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(raf);
    };

    const stopRaf = () => {
      if (rafId === null) return;
      cancelAnimationFrame(rafId);
      rafId = null;
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        stopRaf();
      } else {
        startRaf();
      }
    };

    startRaf();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      stopRaf();
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  return <>{children}</>;
}

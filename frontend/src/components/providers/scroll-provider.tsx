"use client";

import { type ReactNode, useEffect, useRef } from "react";

type LenisInstance = {
  raf: (time: number) => void;
  destroy: () => void;
};

const ANCHOR_OFFSET = -104;

export function ScrollProvider({ children }: { children: ReactNode }) {
  const lenisRef = useRef<LenisInstance | null>(null);

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

    let rafId: number | null = null;
    let disposed = false;
    let cleanupRaf: (() => void) | null = null;

    const setupLenis = async () => {
      const { default: Lenis } = await import("lenis");
      if (disposed) return;

      const lenis = new Lenis({
        lerp: 0.1,
        duration: 1.2,
        anchors: { offset: ANCHOR_OFFSET },
      });
      lenisRef.current = lenis;

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

      cleanupRaf = () => {
        document.removeEventListener("visibilitychange", onVisibilityChange);
        stopRaf();
      };
    };
    void setupLenis();

    return () => {
      disposed = true;
      cleanupRaf?.();
      lenisRef.current?.destroy();
      lenisRef.current = null;
    };
  }, []);

  return <>{children}</>;
}

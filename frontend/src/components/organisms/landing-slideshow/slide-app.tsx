"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import NavigationDots from "./navigation-dots";

const loadSlide1 = () => import("./slide-1");
const loadSlide2 = () => import("./slide-2");
const loadSlide3 = () => import("./slide-3");
const loadSlide4 = () => import("./slide-4");
const loadSlide5 = () => import("./slide-5");

const slides = [
  dynamic(loadSlide1, { ssr: false }),
  dynamic(loadSlide2, { ssr: false }),
  dynamic(loadSlide3, { ssr: false }),
  dynamic(loadSlide4, { ssr: false }),
  dynamic(loadSlide5, { ssr: false }),
];

const slideLoaders = [
  loadSlide1,
  loadSlide2,
  loadSlide3,
  loadSlide4,
  loadSlide5,
];

function clampIndex(index: number) {
  return Math.max(0, Math.min(index, slides.length - 1));
}

export default function SlideApp() {
  const [activeIndex, setActiveIndex] = useState(0);
  const shouldReduceMotion = useReducedMotion();
  const ActiveSlide = slides[activeIndex];

  const goTo = useCallback((index: number) => {
    setActiveIndex(clampIndex(index));
  }, []);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (
        event.key === "ArrowRight" ||
        event.key === "ArrowDown" ||
        event.key === " "
      ) {
        event.preventDefault();
        setActiveIndex((currentIndex) => clampIndex(currentIndex + 1));
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((currentIndex) => clampIndex(currentIndex - 1));
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  useEffect(() => {
    const preloadNeighbor = (index: number) => {
      if (index >= 0 && index < slideLoaders.length) {
        void slideLoaders[index]();
      }
    };
    preloadNeighbor(activeIndex + 1);
    preloadNeighbor(activeIndex - 1);
  }, [activeIndex]);

  return (
    <div
      className="landing-slideshow relative h-screen w-full overflow-hidden bg-black"
      style={{
        fontFamily: "var(--font-heading), var(--font-body), sans-serif",
      }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={activeIndex}
          className="absolute inset-0 z-10"
          initial={shouldReduceMotion ? false : { opacity: 0.2 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            duration: shouldReduceMotion ? 0 : 0.35,
            ease: "easeInOut",
          }}
        >
          <ActiveSlide />
        </motion.div>
      </AnimatePresence>

      <NavigationDots
        total={slides.length}
        active={activeIndex}
        onDotClick={goTo}
      />
    </div>
  );
}

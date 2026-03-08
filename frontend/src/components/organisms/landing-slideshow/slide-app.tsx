"use client";

import { useCallback, useEffect, useState } from "react";

import { AnimatePresence, motion } from "framer-motion";

import NavigationDots from "./navigation-dots";
import Slide1 from "./slide-1";
import Slide2 from "./slide-2";
import Slide3 from "./slide-3";
import Slide4 from "./slide-4";
import Slide5 from "./slide-5";

const slides = [Slide1, Slide2, Slide3, Slide4, Slide5];

export default function SlideApp() {
  const [activeIndex, setActiveIndex] = useState(0);
  const ActiveSlide = slides[activeIndex];

  const goTo = useCallback((index: number) => {
    setActiveIndex(Math.max(0, Math.min(index, slides.length - 1)));
  }, []);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === "ArrowDown" || event.key === " ") {
        event.preventDefault();
        goTo(activeIndex + 1);
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        goTo(activeIndex - 1);
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [activeIndex, goTo]);

  return (
    <div
      className="landing-slideshow relative h-screen w-full overflow-hidden bg-black"
      style={{ fontFamily: '"Aeonik", var(--font-body), sans-serif' }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={activeIndex}
          className="absolute inset-0 z-10"
          initial={{ opacity: 0.2 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: "easeInOut" }}
        >
          <ActiveSlide />
        </motion.div>
      </AnimatePresence>

      <NavigationDots total={slides.length} active={activeIndex} onDotClick={goTo} />
    </div>
  );
}

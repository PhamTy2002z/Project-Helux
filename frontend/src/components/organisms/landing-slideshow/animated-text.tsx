"use client";

import type { CSSProperties, ReactNode } from "react";

import { motion, useReducedMotion } from "framer-motion";

const EASING: [number, number, number, number] = [0.25, 0.1, 0.25, 1];

type SlideUpLineProps = {
  children: ReactNode;
  delay?: number;
  duration?: number;
};

export function SlideUpLine({
  children,
  delay = 0,
  duration = 0.7,
}: SlideUpLineProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <span className="inline-block">{children}</span>;
  }

  return (
    <span className="inline-block overflow-hidden">
      <motion.span
        className="inline-block"
        initial={{ y: "100%" }}
        animate={{ y: "0%" }}
        transition={{ duration, delay, ease: EASING }}
      >
        {children}
      </motion.span>
    </span>
  );
}

type WordByWordRevealProps = {
  text: string;
  className?: string;
  baseDelay?: number;
  stagger?: number;
  duration?: number;
  style?: CSSProperties;
};

export function WordByWordReveal({
  text,
  className,
  baseDelay = 0.25,
  stagger = 0.035,
  duration = 0.55,
  style,
}: WordByWordRevealProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return (
      <p className={className} style={style}>
        {text}
      </p>
    );
  }

  return (
    <p className={className} style={style}>
      {text.split(" ").map((word, index) => (
        <span key={`${word}-${index}`} className="mr-[0.27em] inline-block overflow-hidden">
          <motion.span
            className="inline-block"
            initial={{ y: "100%" }}
            animate={{ y: "0%" }}
            transition={{ duration, delay: baseDelay + index * stagger, ease: EASING }}
          >
            {word}
          </motion.span>
        </span>
      ))}
    </p>
  );
}

type BlurRevealProps = {
  children: ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
};

export function BlurReveal({
  children,
  delay = 0,
  duration = 0.9,
  className,
}: BlurRevealProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, filter: "blur(8px)" }}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      transition={{ duration, delay, ease: EASING }}
    >
      {children}
    </motion.div>
  );
}

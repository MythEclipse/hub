"use client";

import { type HTMLMotionProps, motion, type Variants } from "motion/react";
import type React from "react";
import { useEffect, useState } from "react";

import { fadeInUp, scaleInSpring, stagger } from "#/lib/motion";
import { cn } from "#/lib/utils";

// ─── Viewport-based reveal wrapper ───────────────────────────

type RevealProps = HTMLMotionProps<"div"> & {
  variants?: Variants;
  once?: boolean;
  amount?: number | "some" | "all";
};

/**
 * Wraps children in a fade-in-up animation triggered when they enter the viewport.
 * Use `asChild` composition or nest directly — children receive no special bindings.
 */
export function Reveal({
  children,
  className,
  variants = fadeInUp,
  once = true,
  amount = 0.2,
  ...props
}: RevealProps) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount }}
      variants={variants}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ─── Stagger container ───────────────────────────────────────

type StaggerContainerProps = HTMLMotionProps<"div"> & {
  staggerVariants?: Variants;
  once?: boolean;
};

/**
 * Parent container that staggers child `motion` elements.
 * Children should have matching `variants` (e.g. `fadeInUp`).
 */
export function StaggerContainer({
  children,
  className,
  staggerVariants = stagger,
  once = true,
  ...props
}: StaggerContainerProps) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount: 0.1 }}
      variants={staggerVariants}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ─── Single-item child with fadeInUp ─────────────────────────

type MotionItemProps = HTMLMotionProps<"div"> & { index?: number };

/**
 * A single motion item meant to be used as a child of StaggerContainer.
 * Wraps content in a `motion.div` with fadeInUp variants.
 */
export function MotionItem({ children, className, ...props }: MotionItemProps) {
  return (
    <motion.div variants={fadeInUp} className={className} {...props}>
      {children}
    </motion.div>
  );
}

// ─── Scale reveal (for cards, dialogs) ───────────────────────

export function ScaleReveal({
  children,
  className,
  ...props
}: HTMLMotionProps<"div">) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.15 }}
      variants={scaleInSpring}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ─── Animated presence wrapper ───────────────────────────────

/**
 * Fades + scales content in/out for mount/unmount transitions.
 */
export function AnimatedPresence({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.25, ease: [0.25, 0.1, 0, 1] as const }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Animated number counter ─────────────────────────────────

type AnimatedNumberProps = {
  value: number;
  decimals?: number;
  duration?: number;
  className?: string;
};

/**
 * Animates from 0 to `value` on mount and when `value` changes.
 */
export function AnimatedNumber({
  value,
  decimals = 0,
  duration: dur = 0.6,
  className,
}: AnimatedNumberProps) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: dur, ease: [0.25, 0.1, 0, 1] as const }}
      className={cn("inline-block tabular-nums", className)}
    >
      {value.toFixed(decimals)}
    </motion.span>
  );
}

// ─── Animated text reveal (letter by letter) ─────────────────

type TypewriterProps = {
  text: string;
  className?: string;
  speed?: number;
  /** Delay in ms before the first character appears */
  startDelay?: number;
  /** When true, shows a blinking cursor block while typing */
  cursor?: boolean;
};

/**
 * Reveals text one character at a time using progressive `setTimeout`.
 * Characters are appended to a single text node so CSS gradient
 * (`background-clip: text`) works seamlessly across the full string.
 */
export function Typewriter({
  text,
  className,
  speed = 0.03,
  startDelay = 250,
  cursor: showCursor = true,
}: TypewriterProps) {
  const [displayed, setDisplayed] = useState("");
  const done = displayed.length >= text.length;

  useEffect(() => {
    if (done) return;
    const delay =
      displayed.length === 0 ? startDelay : Math.round(speed * 1000);
    const timer = setTimeout(
      () => setDisplayed(text.slice(0, displayed.length + 1)),
      delay,
    );
    return () => clearTimeout(timer);
  }, [displayed, text, speed, startDelay, done]);

  return (
    <span className={className}>
      {displayed}
      {showCursor && !done && (
        <span className="inline-block size-2.5 bg-primary ml-0.5 rounded-none align-text-bottom animate-pulse" />
      )}
    </span>
  );
}

// ─── Blur-in reveal ──────────────────────────────────────────

export function BlurReveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, filter: "blur(0px)" }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay, ease: [0.25, 0.1, 0, 1] as const }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Interactive card wrapper ────────────────────────────────

type InteractiveCardProps = HTMLMotionProps<"div"> & {
  hoverScale?: number;
};

/**
 * Card wrapper with subtle hover lift and glow.
 */
export function InteractiveCard({
  children,
  className,
  hoverScale = 1.01,
  ...props
}: InteractiveCardProps) {
  return (
    <motion.div
      whileHover={{
        y: -3,
        scale: hoverScale,
        transition: { duration: 0.2, ease: "easeOut" },
      }}
      whileTap={{ y: 0, scale: 0.99 }}
      className={cn("cursor-default transition-shadow duration-300", className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * Reusable Framer Motion animation variants and utility constants
 * for consistent, performant animations across the hub.
 */

// ─── DOM variants ────────────────────────────────────────────

export const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5, ease: "easeOut" } },
};

export const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.1, 0, 1] as const },
  },
};

export const fadeInDown = {
  hidden: { opacity: 0, y: -16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.1, 0, 1] as const },
  },
};

export const fadeInLeft = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5, ease: [0.25, 0.1, 0, 1] as const },
  },
};

export const fadeInRight = {
  hidden: { opacity: 0, x: 20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5, ease: [0.25, 0.1, 0, 1] as const },
  },
};

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4, ease: [0.25, 0.1, 0, 1] as const },
  },
};

export const scaleInSpring = {
  hidden: { opacity: 0, scale: 0.85 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 200,
      damping: 20,
      mass: 0.8,
    },
  },
};

// ─── Stagger container ───────────────────────────────────────

export const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1,
      ease: [0.25, 0.1, 0, 1] as const,
    },
  },
};

export const staggerFast = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.05,
    },
  },
};

export const staggerSlow = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.15,
    },
  },
};

// ─── SVG / Path animation ────────────────────────────────────

export const drawPath = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: { duration: 1.2, ease: [0.25, 0.1, 0, 1] as const },
  },
};

export const growWidth = {
  hidden: { scaleX: 0, transformOrigin: "left" },
  visible: {
    scaleX: 1,
    transformOrigin: "left",
    transition: { duration: 0.8, ease: [0.25, 0.1, 0, 1] as const },
  },
};

// ─── Hover / Tap presets ─────────────────────────────────────

export const hoverLift = {
  whileHover: { y: -2, transition: { duration: 0.2 } },
  whileTap: { y: 0, transition: { duration: 0.1 } },
};

export const hoverGlow = {
  whileHover: {
    boxShadow: "0 0 20px oklch(0.7 0.15 75 / 0.25)",
    transition: { duration: 0.25 },
  },
};

export const tapScale = {
  whileTap: { scale: 0.97, transition: { duration: 0.1 } },
};

// ─── Counter / number animation ──────────────────────────────

export const counterProps = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.25, 0.1, 0, 1] as const },
};

// ─── Duration presets ────────────────────────────────────────

export const duration = {
  fast: 0.2,
  normal: 0.4,
  slow: 0.6,
  slower: 0.8,
} as const;

// ─── Transition presets ──────────────────────────────────────

export const spring = {
  type: "spring" as const,
  stiffness: 200,
  damping: 20,
  mass: 0.8,
};

export const springBouncy = {
  type: "spring" as const,
  stiffness: 300,
  damping: 15,
  mass: 0.7,
};

export const springGentle = {
  type: "spring" as const,
  stiffness: 120,
  damping: 14,
  mass: 1,
};

export const smoothEase = {
  ease: [0.25, 0.1, 0, 1] as [number, number, number, number],
  duration: 0.5,
};

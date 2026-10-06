import type { Transition, Variants } from "framer-motion";

/**
 * "Calm Agricultural Technology" motion system — one shared set of
 * durations/easing so every page moves at the same speed instead of each
 * screen inventing its own. Matches the cubic-bezier already in use in
 * LoginPage's view transitions (a fast, gentle ease-out with no overshoot).
 */
export const EASE_OUT: Transition["ease"] = [0.22, 1, 0.36, 1];

export const DURATION = {
  /** Micro/button interactions — hover, tap, small state flips. */
  micro: 0.15,
  /** Route/view transitions. */
  page: 0.25,
  /** Cards, modals, list items entering. */
  card: 0.3,
  /** Success confirmations (checkmarks, status changes). */
  success: 0.4,
  /** Number count-up. */
  number: 0.65,
  /** Chart draw-in. */
  chart: 0.8,
  /** App intro sequence, start to finish. */
  intro: 1.1,
} as const;

const fadeInBase: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: DURATION.card, ease: EASE_OUT } },
};

/** Reduced-motion twin of fadeInBase — same states, no movement, near-instant. */
const fadeInReduced: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.01 } },
};

/** Parent container for a staggered group — pair with `staggerItemVariants` on each child. */
export function staggerContainerVariants(reducedMotion: boolean, staggerDelay = 0.06): Variants {
  return {
    hidden: {},
    visible: {
      transition: reducedMotion ? { staggerChildren: 0 } : { staggerChildren: staggerDelay, delayChildren: 0.04 },
    },
  };
}

export function staggerItemVariants(reducedMotion: boolean): Variants {
  return reducedMotion ? fadeInReduced : fadeInBase;
}

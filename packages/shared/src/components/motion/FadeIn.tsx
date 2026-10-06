import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import { DURATION, EASE_OUT } from "../../lib/motion";

interface FadeInProps extends HTMLMotionProps<"div"> {
  /** Stagger/entrance delay in seconds — for sequencing a handful of elements (header → hero → CTA), not a full list (use Stagger for that). */
  delay?: number;
  /** Starting vertical offset in px — 0 for a pure fade. */
  y?: number;
}

/** Fade + small upward entrance — the one-off building block behind most of this app's page/section entrances. Skips the vertical movement (not the fade) under prefers-reduced-motion. */
export default function FadeIn({ delay = 0, y = 10, children, ...rest }: FadeInProps) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: reducedMotion ? 0 : y }}
      animate={{ opacity: 1, y: 0 }}
      transition={reducedMotion ? { duration: 0.01 } : { duration: DURATION.card, ease: EASE_OUT, delay }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import { staggerContainerVariants, staggerItemVariants } from "../../lib/motion";

interface StaggerGroupProps extends HTMLMotionProps<"div"> {
  /** Seconds between each child's entrance. */
  staggerDelay?: number;
}

/** Parent for a staggered list entrance (feature cards, KPI cards, record rows) — wrap each direct child in `StaggerItem`. Animates once, on mount; never replays on re-render. */
export function StaggerGroup({ staggerDelay, children, ...rest }: StaggerGroupProps) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainerVariants(Boolean(reducedMotion), staggerDelay)}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/** One entry inside a `StaggerGroup` — must be a direct child so it inherits the parent's stagger timing. */
export function StaggerItem({ children, ...rest }: HTMLMotionProps<"div">) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div variants={staggerItemVariants(Boolean(reducedMotion))} {...rest}>
      {children}
    </motion.div>
  );
}

import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { EASE_OUT } from "@poultryhub/shared/lib/motion";

const INTRO_DURATION_MS = 1100;

interface AppIntroProps {
  onDone: () => void;
}

/**
 * Once-per-cold-launch brand moment — logo fades/scales in, "PoultryHub"
 * settles up under it, the tagline follows. Purely a decorative overlay:
 * the real app (auth resolution, routing) mounts underneath in parallel the
 * whole time, so this never delays anything — it just disappears once its
 * own short timeline (and a hard 1.1s ceiling) is done. Skipped entirely
 * under prefers-reduced-motion.
 */
export default function AppIntro({ onDone }: AppIntroProps) {
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) {
      onDone();
      return;
    }
    const timer = setTimeout(onDone, INTRO_DURATION_MS);
    return () => clearTimeout(timer);
    // onDone is a stable setState updater from the caller — only reducedMotion should retrigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  if (reducedMotion) return null;

  return (
    <motion.div
      className="fixed inset-0 z-[999] flex flex-col items-center justify-center gap-3 bg-[var(--color-background)]"
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: EASE_OUT }}
        className="flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{ background: "linear-gradient(135deg, #2E7D32, #66BB6A)" }}
      >
        <svg width={34} height={34} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <ellipse cx="12" cy="14" rx="7" ry="8.5" fill="rgba(255,255,255,0.95)" />
          <path d="M12 6 C14 3, 19 4, 17 8 C15 6, 13 7, 12 6Z" fill="#FFC107" />
        </svg>
      </motion.div>

      <motion.span
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.4, ease: EASE_OUT }}
        className="font-display text-xl font-semibold text-[var(--color-primary)]"
      >
        PoultryHub
      </motion.span>

      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.35 }}
        className="text-xs text-[var(--color-muted)]"
      >
        Poultry Production Monitoring
      </motion.span>
    </motion.div>
  );
}

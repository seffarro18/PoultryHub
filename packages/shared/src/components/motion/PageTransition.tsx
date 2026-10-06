import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useLocation, useOutlet } from "react-router-dom";
import { DURATION, EASE_OUT } from "../../lib/motion";

/**
 * Wraps the authenticated area's routed content (DashboardLayout's Outlet)
 * so switching screens reads as a quick, calm fade + tiny upward settle
 * instead of a hard cut — never a slide-across, zoom, or spin. Keyed by
 * pathname so React Router still swaps the actual page underneath; this
 * only owns the transition, not routing itself.
 */
export default function PageTransition() {
  const location = useLocation();
  const outlet = useOutlet();
  const reducedMotion = useReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: reducedMotion ? 0 : 6 }}
        animate={{ opacity: 1, y: 0, transition: { duration: reducedMotion ? 0.01 : DURATION.page, ease: EASE_OUT } }}
        exit={{ opacity: 0, transition: { duration: 0.1 } }}
      >
        {outlet}
      </motion.div>
    </AnimatePresence>
  );
}

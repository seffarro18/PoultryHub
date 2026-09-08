import { useEffect, useState } from "react";

export type Breakpoint = "mobile" | "tablet" | "desktop";

function resolveBreakpoint(width: number): Breakpoint {
  if (width < 768) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

/** Tracks which of the spec's three width bands the viewport currently falls in. */
export function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(() =>
    typeof window === "undefined" ? "desktop" : resolveBreakpoint(window.innerWidth)
  );

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 767px)");
    const tabletQuery = window.matchMedia("(min-width: 768px) and (max-width: 1023px)");

    const update = () => setBreakpoint(resolveBreakpoint(window.innerWidth));

    mobileQuery.addEventListener("change", update);
    tabletQuery.addEventListener("change", update);
    update();

    return () => {
      mobileQuery.removeEventListener("change", update);
      tabletQuery.removeEventListener("change", update);
    };
  }, []);

  return breakpoint;
}

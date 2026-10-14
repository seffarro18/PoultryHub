import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useToast } from "../components/ui/ToastContext";

const HIGHLIGHT_MS = 4000;

/**
 * Notification links point at a specific record (`/farm/feed?record=<id>`).
 * Once the page's records have loaded, this scrolls the matching row (any
 * element with `data-record-id="<id>"`) into view and returns its id for a
 * brief highlight. If the record isn't in the list any more (deleted, or
 * not visible to this user) it says so instead of silently showing the page.
 * The param is removed afterwards so a refresh doesn't replay it.
 */
export function useRecordHighlight(recordIds: string[], ready: boolean): string | null {
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const target = searchParams.get("record");
  const [highlighted, setHighlighted] = useState<string | null>(null);

  useEffect(() => {
    if (!target || !ready) return;
    const next = new URLSearchParams(searchParams);
    next.delete("record");
    setSearchParams(next, { replace: true });

    if (!recordIds.includes(target)) {
      toast.error("That record is no longer available — it may have been deleted.");
      return;
    }
    setHighlighted(target);
    requestAnimationFrame(() => {
      document.querySelector(`[data-record-id="${CSS.escape(target)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    // Runs once per incoming target, after the records are available.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, ready]);

  // Separate from the effect above: clearing the param re-runs that one, and
  // its cleanup must not cancel this fade-out.
  useEffect(() => {
    if (!highlighted) return;
    const timer = setTimeout(() => setHighlighted(null), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [highlighted]);

  return highlighted;
}

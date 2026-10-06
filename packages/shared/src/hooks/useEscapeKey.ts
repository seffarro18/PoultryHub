import { useEffect } from "react";

/** Closes a dialog/drawer on Escape — every modal in this app opens via a mouse click, but until now none of them could be dismissed from the keyboard without tabbing all the way to a Cancel button. */
export function useEscapeKey(onEscape: () => void): void {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onEscape();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onEscape]);
}

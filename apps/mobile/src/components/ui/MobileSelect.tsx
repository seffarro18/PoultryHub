import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronDown, Plus, Search, X } from "lucide-react";
import { useEscapeKey } from "@poultryhub/shared/hooks/useEscapeKey";

export interface MobileSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface MobileSelectGroup {
  label?: string;
  options: MobileSelectOption[];
}

function isGrouped(options: MobileSelectOption[] | MobileSelectGroup[]): options is MobileSelectGroup[] {
  return options.length > 0 && "options" in options[0];
}

interface MobileSelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: MobileSelectOption[] | MobileSelectGroup[];
  placeholder?: string;
  /** Sheet header title — defaults to `placeholder`. */
  sheetTitle?: string;
  disabled?: boolean;
  /** Shows a filter box inside the sheet — only worth it for long/searchable lists (section 7: skip it for short enum lists like Cash/Active-Sold). */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Rendered as a pinned row below the option list (e.g. "+ Add new house/pen…"). The sheet closes first, then this fires. */
  trailingAction?: { label: string; onClick: () => void };
  error?: boolean;
  className?: string;
}

/**
 * Mobile-only reusable dropdown: a plain field that opens a bottom sheet
 * instead of the native <select> popup. Purely presentational/controlled —
 * loading/error states for async option sources (house/pen, breed lists)
 * stay in the caller, same as before, so this component only ever renders
 * once real options exist.
 *
 * Android/back-button handling: opening pushes one history entry; the sheet
 * closes by calling history.back() (consumed by the popstate listener)
 * rather than setting state directly, so the hardware back button closes
 * the sheet instead of leaving the page/app, for free — Capacitor's default
 * WebView behavior already follows browser history.
 */
export default function MobileSelect({
  id,
  value,
  onChange,
  options,
  placeholder = "Select…",
  sheetTitle,
  disabled = false,
  searchable = false,
  searchPlaceholder = "Search…",
  trailingAction,
  error = false,
  className,
}: MobileSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const reducedMotion = useReducedMotion();
  const openRef = useRef(open);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    const handlePopState = () => setOpen(false);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // If this unmounts while still open (e.g. the parent drawer was closed
  // without the sheet being dismissed first), consume the pushed history
  // entry so a later back-press doesn't land on a sheet that no longer exists.
  useEffect(() => {
    return () => {
      if (openRef.current) window.history.back();
    };
  }, []);

  const openSheet = () => {
    if (disabled) return;
    setQuery("");
    window.history.pushState({ mobileSelectSheet: true }, "");
    setOpen(true);
  };

  const closeSheet = () => {
    if (openRef.current) window.history.back();
  };

  useEscapeKey(closeSheet);

  const groups: MobileSelectGroup[] = useMemo(() => (isGrouped(options) ? options : [{ options }]), [options]);

  const selectedLabel = useMemo(() => {
    for (const group of groups) {
      const match = group.options.find((o) => o.value === value);
      if (match) return match.label;
    }
    return null;
  }, [groups, value]);

  const filteredGroups = useMemo(() => {
    if (!query.trim()) return groups;
    const q = query.trim().toLowerCase();
    return groups
      .map((group) => ({ ...group, options: group.options.filter((o) => o.label.toLowerCase().includes(q)) }))
      .filter((group) => group.options.length > 0);
  }, [groups, query]);

  const hasAnyOptions = filteredGroups.some((g) => g.options.length > 0);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    closeSheet();
  };

  return (
    <>
      <button
        type="button"
        id={id}
        onClick={openSheet}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={[
          "flex min-h-[48px] w-full items-center justify-between gap-2 rounded-lg border bg-[var(--color-background)] px-3 py-2.5 text-left text-sm outline-none transition-colors disabled:opacity-60",
          error ? "border-[var(--color-danger)]" : "border-[var(--color-border)] focus-visible:border-[var(--color-primary)]",
          selectedLabel ? "text-[var(--color-foreground)]" : "text-[var(--color-muted)]",
          className ?? "",
        ].join(" ")}
      >
        <span className="truncate">{selectedLabel ?? placeholder}</span>
        <ChevronDown size={16} className="shrink-0 text-[var(--color-muted)]" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0.01 : 0.15 }}
            className="fixed inset-0 z-[60] flex items-end bg-black/40"
            onClick={closeSheet}
          >
            <motion.div
              initial={{ y: reducedMotion ? 0 : 40, opacity: reducedMotion ? 1 : 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: reducedMotion ? 0 : 40, opacity: reducedMotion ? 1 : 0 }}
              transition={{ duration: reducedMotion ? 0.01 : 0.22, ease: [0.22, 1, 0.36, 1] }}
              role="dialog"
              aria-modal="true"
              aria-label={sheetTitle ?? placeholder}
              className="flex max-h-[75vh] w-full flex-col rounded-t-2xl border-t border-[var(--color-border)] bg-[var(--color-card)] pb-[env(safe-area-inset-bottom)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-[var(--color-border)]" />
              <div className="flex shrink-0 items-center justify-between px-4 pb-2 pt-3">
                <h2 className="font-display text-sm font-semibold text-[var(--color-foreground)]">{sheetTitle ?? placeholder}</h2>
                <button
                  type="button"
                  onClick={closeSheet}
                  aria-label="Close"
                  className="rounded-full p-1 text-[var(--color-muted)]"
                >
                  <X size={18} />
                </button>
              </div>

              {searchable && (
                <div className="shrink-0 px-4 pb-2">
                  <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2">
                    <Search size={15} className="shrink-0 text-[var(--color-muted)]" />
                    <input
                      autoFocus
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={searchPlaceholder}
                      className="w-full bg-transparent text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)]"
                    />
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto px-2 pb-2">
                {!hasAnyOptions ? (
                  <div className="flex flex-col items-center gap-1 py-10 text-center">
                    <p className="text-sm font-medium text-[var(--color-foreground)]">No results found</p>
                    <p className="text-xs text-[var(--color-muted)]">Try a different search.</p>
                  </div>
                ) : (
                  filteredGroups.map((group, i) => (
                    <div key={group.label ?? i}>
                      {group.label && (
                        <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                          {group.label}
                        </p>
                      )}
                      {group.options.map((option) => {
                        const isSelected = option.value === value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            disabled={option.disabled}
                            onClick={() => handleSelect(option.value)}
                            className={[
                              "flex min-h-[46px] w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors disabled:opacity-50",
                              isSelected
                                ? "bg-[var(--color-primary)]/10 font-medium text-[var(--color-primary)]"
                                : "text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]",
                            ].join(" ")}
                          >
                            <span className="truncate">{option.label}</span>
                            {isSelected && <Check size={16} className="shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>

              {trailingAction && (
                <div className="shrink-0 border-t border-[var(--color-border)] px-2 py-2">
                  <button
                    type="button"
                    onClick={() => {
                      closeSheet();
                      trailingAction.onClick();
                    }}
                    className="flex min-h-[46px] w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-muted-bg)]"
                  >
                    <Plus size={16} />
                    {trailingAction.label}
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

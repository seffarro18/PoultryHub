import { useEffect, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { listPoultryHouses } from "@poultryhub/shared/services/poultryHouseService";
import type { PoultryHouse } from "@poultryhub/shared/types/poultryHouse";

export type StaffPoultryHouseFieldState = "loading" | "error" | "no-houses" | "unassigned" | "assigned";

interface StaffPoultryHouseFieldProps {
  id?: string;
  farmId: string;
  /** From the signed-in Staff member's own profile (User.assignedPoultryHouseId) — this field never lets them pick a different house, only shows the one their Farm Admin assigned. */
  assignedPoultryHouseId: string | null;
  onChange: (house: PoultryHouse) => void;
  /** Lets the parent form show the exact right submit-time validation message (State A vs. State B are worded differently) without re-fetching the house list itself. */
  onStateChange?: (state: StaffPoultryHouseFieldState) => void;
}

/**
 * Staff-side "Poultry House / Pen" field for Egg Collection. Unlike
 * PoultryHouseSelect (Farm Admin/Manager: pick any of the farm's houses),
 * Staff only ever sees the one house/pen they've been assigned — never a
 * free choice, never free text. Three distinct states:
 *   A. The farm has no houses/pens configured at all.
 *   B. Houses/pens exist, but this Staff member has no assignment yet.
 *   C. Assigned — a real, enabled single-option dropdown, auto-selected.
 */
export default function StaffPoultryHouseField({ id, farmId, assignedPoultryHouseId, onChange, onStateChange }: StaffPoultryHouseFieldProps) {
  const [houses, setHouses] = useState<PoultryHouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!farmId) {
      setHouses([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    listPoultryHouses(farmId)
      .then((result) => {
        if (!cancelled) setHouses(result);
      })
      .catch((err: unknown) => {
        console.error("[StaffPoultryHouseField] failed to load houses:", err);
        if (!cancelled) setLoadError("Couldn't load poultry houses/pens.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [farmId]);

  const assignedHouse = assignedPoultryHouseId ? (houses.find((h) => h.id === assignedPoultryHouseId) ?? null) : null;

  const currentState: StaffPoultryHouseFieldState = loading
    ? "loading"
    : loadError
      ? "error"
      : houses.length === 0
        ? "no-houses"
        : assignedHouse
          ? "assigned"
          : "unassigned";

  useEffect(() => {
    onStateChange?.(currentState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentState]);

  // Auto-selects the assigned house as soon as it resolves — there's never a
  // real choice for Staff to make here, so nothing waits on a click.
  useEffect(() => {
    if (assignedHouse) onChange(assignedHouse);
    // Only the resolved house's identity should retrigger this, not onChange itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignedHouse?.id]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-muted)]">
        <Loader2 size={14} className="spinner" /> Loading houses/pens…
      </div>
    );
  }

  if (loadError) {
    return <p className="text-sm text-[var(--color-danger)]">{loadError}</p>;
  }

  // State A — nothing configured for this farm yet.
  if (houses.length === 0) {
    return (
      <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-muted)]">
        No poultry houses/pens available. Please ask your Farm Admin to add one.
      </p>
    );
  }

  // State B — houses exist, but this Staff member isn't assigned to one.
  if (!assignedHouse) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="relative">
          <select
            id={id}
            disabled
            value=""
            className="w-full appearance-none rounded-lg border border-[var(--color-border)] bg-[var(--color-muted-bg)] px-3 py-2 pr-9 text-sm text-[var(--color-muted)] outline-none disabled:opacity-70"
          >
            <option value="">No Poultry House / Pen assigned</option>
          </select>
          <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
        </div>
        <p className="text-xs text-[var(--color-muted)]">Please ask your Farm Admin to assign you to a Poultry House / Pen.</p>
      </div>
    );
  }

  // State C — assigned. A real dropdown; the one valid option is already selected.
  return (
    <div className="relative">
      <select
        id={id}
        value={assignedHouse.id}
        onChange={() => onChange(assignedHouse)}
        className="w-full appearance-none rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 pr-9 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
      >
        <option value={assignedHouse.id}>{assignedHouse.name}</option>
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
    </div>
  );
}

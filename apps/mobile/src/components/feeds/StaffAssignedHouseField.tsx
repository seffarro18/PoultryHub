import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { listPoultryHouses } from "@poultryhub/shared/services/poultryHouseService";
import type { PoultryHouse } from "@poultryhub/shared/types/poultryHouse";

export type AssignedHouseState = "loading" | "error" | "resolved" | "unassigned";

interface StaffAssignedHouseFieldProps {
  id?: string;
  farmId: string;
  /** From the signed-in Staff member's own profile (User.assignedPoultryHouseId) — Farm-Admin-controlled, never editable here. */
  assignedPoultryHouseId: string | null;
  onResolved: (house: PoultryHouse | null) => void;
  onStateChange?: (state: AssignedHouseState) => void;
}

/**
 * Feed Distribution's "Poultry House / Pen" for Staff — always the one
 * house/pen their Farm Admin assigned, never a choice: no dropdown, no free
 * text, nothing Staff can type or select. Re-resolves the assignment from
 * the database on every mount (never cached/hardcoded) so a reassignment by
 * Farm Admin takes effect the next time this modal opens. Separate from
 * StaffPoultryHouseField (Egg Production's dropdown-styled version of the
 * same idea) because this feature's own spec calls for plain read-only text,
 * not a disabled select.
 */
export default function StaffAssignedHouseField({ id, farmId, assignedPoultryHouseId, onResolved, onStateChange }: StaffAssignedHouseFieldProps) {
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
        console.error("[StaffAssignedHouseField] failed to load houses:", err);
        if (!cancelled) setLoadError("Couldn't load your assigned poultry house/pen.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [farmId]);

  const assignedHouse = assignedPoultryHouseId ? (houses.find((h) => h.id === assignedPoultryHouseId) ?? null) : null;
  const state: AssignedHouseState = loading ? "loading" : loadError ? "error" : assignedHouse ? "resolved" : "unassigned";

  useEffect(() => {
    onStateChange?.(state);
    onResolved(assignedHouse);
    // Only the resolved state/house identity should retrigger this, not the callback props themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, assignedHouse?.id]);

  if (loading) {
    return (
      <div id={id} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-muted-bg)] px-3 py-2 text-sm text-[var(--color-muted)]">
        <Loader2 size={14} className="spinner" /> Loading…
      </div>
    );
  }

  if (loadError) {
    return <p id={id} className="text-sm text-[var(--color-danger)]">{loadError}</p>;
  }

  if (!assignedHouse) {
    return (
      <div className="flex flex-col gap-1.5">
        <div id={id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-muted-bg)] px-3 py-2 text-sm text-[var(--color-muted)]">
          No poultry house/pen assigned
        </div>
        <p className="text-xs text-[var(--color-danger)]">No poultry house/pen assigned. Please contact your Farm Admin.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div id={id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-muted-bg)] px-3 py-2 text-sm font-medium text-[var(--color-foreground)]">
        {assignedHouse.name}
      </div>
      <p className="text-xs text-[var(--color-muted)]">Assigned by Farm Admin</p>
    </div>
  );
}

import { useEffect, useState } from "react";
import { ChevronDown, Loader2, Plus } from "lucide-react";
import { createPoultryHouse, listPoultryHouses } from "@poultryhub/shared/services/poultryHouseService";
import { normalizeHouseName, type PoultryHouse } from "@poultryhub/shared/types/poultryHouse";
import AddPoultryHouseDialog from "./AddPoultryHouseDialog";

const NEW_HOUSE_VALUE = "__new_house__";
const DIVIDER_VALUE = "__divider__";

const UNASSIGNED_VALUE = "";

interface PoultryHouseSelectProps {
  id?: string;
  farmId: string;
  value: string;
  onChange: (house: PoultryHouse | null) => void;
  /** Farm Admin/Manager only — RLS also blocks a Staff-submitted insert regardless of what the UI shows, this just keeps the option from appearing for a role that can't use it. */
  canManage?: boolean;
  /** Show a selectable "Unassigned" option (Staff Management's assignment field) instead of requiring a real house (Egg Production, which always needs one to submit). Mirrors FarmSelect's own allowUnassigned. */
  allowUnassigned?: boolean;
  disabled?: boolean;
}

/** Loads a farm's poultry houses/pens from Supabase (never hardcoded) and lets Staff pick one; Farm Admin/Manager additionally get a "+ Add new house/pen…" option that opens AddPoultryHouseDialog inline — available in every state (loading aside), including when the farm has none yet or the load failed. */
export default function PoultryHouseSelect({ id, farmId, value, onChange, canManage = false, allowUnassigned = false, disabled }: PoultryHouseSelectProps) {
  const [houses, setHouses] = useState<PoultryHouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = (onCancelledCheck?: () => boolean) => {
    if (!farmId) {
      setHouses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    listPoultryHouses(farmId)
      .then((result) => {
        if (!onCancelledCheck?.()) setHouses(result);
      })
      .catch((err: unknown) => {
        console.error("[PoultryHouseSelect] failed to load houses:", err);
        if (!onCancelledCheck?.()) setLoadError("Unable to load poultry houses/pens. Please try again.");
      })
      .finally(() => {
        if (!onCancelledCheck?.()) setLoading(false);
      });
  };

  useEffect(() => {
    let cancelled = false;
    load(() => cancelled);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmId]);

  const handleSelectChange = (raw: string) => {
    if (raw === NEW_HOUSE_VALUE) {
      setAddOpen(true);
      return;
    }
    if (raw === DIVIDER_VALUE) return;
    if (raw === UNASSIGNED_VALUE) {
      if (allowUnassigned) onChange(null);
      return;
    }
    const house = houses.find((h) => h.id === raw);
    if (house) onChange(house);
  };

  /** Normalized match (case/whitespace/underscore/hyphen-insensitive) against what's already loaded — "House 1" typed again as "House_1" or "house-1" selects the existing one instead of creating a near-duplicate row. A true exact-name race is still caught by the table's own unique(farm_id, name) constraint. */
  const handleCreate = async (name: string) => {
    setCreating(true);
    try {
      const normalized = normalizeHouseName(name);
      const existing = houses.find((h) => normalizeHouseName(h.name) === normalized);
      if (existing) {
        onChange(existing);
        setAddOpen(false);
        return;
      }
      const house = await createPoultryHouse(farmId, name);
      setHouses((prev) => [...prev, house].sort((a, b) => a.name.localeCompare(b.name)));
      onChange(house);
      setAddOpen(false);
    } finally {
      setCreating(false);
    }
  };

  const addHouseButton = canManage && (
    <button
      type="button"
      onClick={() => setAddOpen(true)}
      className="flex w-fit items-center gap-1.5 text-sm font-semibold text-[var(--color-primary)] hover:opacity-75"
    >
      <Plus size={14} /> Add new house/pen…
    </button>
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-muted)]">
        <Loader2 size={14} className="spinner" /> Loading poultry houses/pens…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col gap-2">
        <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-danger)]">{loadError}</p>
        <button
          type="button"
          onClick={() => load()}
          className="w-fit text-xs font-semibold text-[var(--color-primary)] hover:opacity-75"
        >
          Try again
        </button>
        {addHouseButton}
        {addOpen && <AddPoultryHouseDialog onCancel={() => setAddOpen(false)} onConfirm={handleCreate} creating={creating} />}
      </div>
    );
  }

  if (houses.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-muted)]">
          No poultry houses/pens available.
          {canManage ? "" : " Please ask your Farm Admin to add one."}
        </p>
        {addHouseButton}
        {addOpen && <AddPoultryHouseDialog onCancel={() => setAddOpen(false)} onConfirm={handleCreate} creating={creating} />}
      </div>
    );
  }

  // Defensive, display-only dedup — handleCreate already stops a NEW
  // near-duplicate from being created, but this guards against one that
  // already exists in the database (e.g. inserted before that check
  // existed) showing up as two selectable options for the same physical
  // house. Keeps the first occurrence per normalized name; never drops the
  // currently-selected house even if it would otherwise be deduped away,
  // so an existing record's selection never silently disappears.
  const seenNames = new Set<string>();
  const visibleHouses = houses.filter((house) => {
    const key = normalizeHouseName(house.name);
    if (house.id === value) return true;
    if (seenNames.has(key)) return false;
    seenNames.add(key);
    return true;
  });

  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => handleSelectChange(e.target.value)}
        className="w-full appearance-none rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 pr-9 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)] disabled:opacity-60"
      >
        {allowUnassigned ? (
          <option value={UNASSIGNED_VALUE}>Unassigned</option>
        ) : (
          <option value="" disabled>
            Select Poultry House / Pen
          </option>
        )}
        {visibleHouses.map((house) => (
          <option key={house.id} value={house.id}>
            {house.name}
          </option>
        ))}
        {canManage && (
          <>
            <option value={DIVIDER_VALUE} disabled>
              ──────────
            </option>
            <option value={NEW_HOUSE_VALUE} style={{ color: "var(--color-primary)" }}>
              + Add new house/pen…
            </option>
          </>
        )}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
      {addOpen && <AddPoultryHouseDialog onCancel={() => setAddOpen(false)} onConfirm={handleCreate} creating={creating} />}
    </div>
  );
}

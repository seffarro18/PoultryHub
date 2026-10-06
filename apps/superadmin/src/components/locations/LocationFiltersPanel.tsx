import { useMemo } from "react";
import { RotateCcw } from "lucide-react";
import type { FarmStatus, ManagedFarm } from "@poultryhub/shared/types/farm";

export interface LocationFilters {
  /** Region/Province filters removed — PoultryHub only operates in Aurora, so both are constant across every farm. */
  city: string;
  /** "All" here means active + inactive — archived stays opt-in, not a default part of "All". */
  status: FarmStatus | "All";
  farmType: string;
  minCapacity: string;
  maxCapacity: string;
}

export const DEFAULT_LOCATION_FILTERS: LocationFilters = {
  city: "All",
  status: "All",
  farmType: "All",
  minCapacity: "",
  maxCapacity: "",
};

export function applyLocationFilters(farms: ManagedFarm[], filters: LocationFilters): ManagedFarm[] {
  const min = filters.minCapacity ? Number(filters.minCapacity) : null;
  const max = filters.maxCapacity ? Number(filters.maxCapacity) : null;

  return farms.filter((f) => {
    if (filters.status === "All" ? f.status === "archived" : f.status !== filters.status) return false;
    if (filters.city !== "All" && f.city !== filters.city) return false;
    if (filters.farmType !== "All" && f.farmType !== filters.farmType) return false;
    if (min !== null && (f.capacity ?? 0) < min) return false;
    if (max !== null && (f.capacity ?? 0) > max) return false;
    return true;
  });
}

interface LocationFiltersPanelProps {
  farms: ManagedFarm[];
  value: LocationFilters;
  onChange: (next: LocationFilters) => void;
}

function distinct(values: (string | null)[]): string[] {
  return [...new Set(values.filter((v): v is string => Boolean(v)))].sort();
}

const selectClass =
  "rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]";

export default function LocationFiltersPanel({ farms, value, onChange }: LocationFiltersPanelProps) {
  const cityOptions = useMemo(() => distinct(farms.map((f) => f.city)), [farms]);
  const typeOptions = useMemo(() => distinct(farms.map((f) => f.farmType)), [farms]);

  const set = <K extends keyof LocationFilters>(key: K, val: LocationFilters[K]) => {
    onChange({ ...value, [key]: val });
  };

  const isDefault = JSON.stringify(value) === JSON.stringify(DEFAULT_LOCATION_FILTERS);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select value={value.city} onChange={(e) => set("city", e.target.value)} className={selectClass}>
        <option value="All">All municipalities</option>
        {cityOptions.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <select value={value.status} onChange={(e) => set("status", e.target.value as LocationFilters["status"])} className={selectClass}>
        <option value="All">Active + Inactive</option>
        <option value="active">Active only</option>
        <option value="inactive">Inactive only</option>
        <option value="archived">Archived only</option>
      </select>
      {typeOptions.length > 0 && (
        <select value={value.farmType} onChange={(e) => set("farmType", e.target.value)} className={selectClass}>
          <option value="All">All types</option>
          {typeOptions.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      )}
      <input
        type="number"
        min={0}
        value={value.minCapacity}
        onChange={(e) => set("minCapacity", e.target.value)}
        placeholder="Min capacity"
        className={`w-28 ${selectClass}`}
      />
      <input
        type="number"
        min={0}
        value={value.maxCapacity}
        onChange={(e) => set("maxCapacity", e.target.value)}
        placeholder="Max capacity"
        className={`w-28 ${selectClass}`}
      />
      {!isDefault && (
        <button
          type="button"
          onClick={() => onChange(DEFAULT_LOCATION_FILTERS)}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]"
        >
          <RotateCcw size={13} /> Reset
        </button>
      )}
    </div>
  );
}

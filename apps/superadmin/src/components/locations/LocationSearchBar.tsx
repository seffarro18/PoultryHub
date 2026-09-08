import { useMemo, useState } from "react";
import { MapPin, MapPinOff, Search } from "lucide-react";
import { formatAdmins } from "../../lib/farmDisplay";
import type { ManagedFarm } from "@poultryhub/shared/types/farm";

interface LocationSearchBarProps {
  farms: ManagedFarm[];
  onSelect: (farm: ManagedFarm) => void;
}

/** Client-side match against every field the spec asks for — name, code, owner, admin, province, municipality, and the address line (standing in for barangay). */
export default function LocationSearchBar({ farms, onSelect }: LocationSearchBarProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return farms
      .filter((f) => {
        const admins = formatAdmins(f).toLowerCase();
        return (
          f.name.toLowerCase().includes(term) ||
          (f.farmCode ?? "").toLowerCase().includes(term) ||
          (f.owner ?? "").toLowerCase().includes(term) ||
          admins.includes(term) ||
          (f.province ?? "").toLowerCase().includes(term) ||
          (f.city ?? "").toLowerCase().includes(term) ||
          (f.address ?? "").toLowerCase().includes(term)
        );
      })
      .slice(0, 8);
  }, [farms, query]);

  const handleSelect = (farm: ManagedFarm) => {
    onSelect(farm);
    setQuery(farm.name);
    setOpen(false);
  };

  return (
    <div className="relative">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search farm, code, owner, admin, or location…"
        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] py-2 pl-9 pr-3 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)]"
      />

      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-[1001] mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-1.5 shadow-lg">
          {results.map((farm) => (
            <button
              key={farm.id}
              type="button"
              onMouseDown={() => handleSelect(farm)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-[var(--color-muted-bg)]"
            >
              {farm.latitude !== null && farm.longitude !== null ? (
                <MapPin size={14} className="shrink-0 text-[var(--color-primary)]" />
              ) : (
                <span title="No coordinates set">
                  <MapPinOff size={14} className="shrink-0 text-[var(--color-muted)]" />
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--color-foreground)]">{farm.name}</p>
                <p className="truncate text-xs text-[var(--color-muted)]">
                  {[farm.city, farm.province].filter(Boolean).join(", ") || "Location not set"}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

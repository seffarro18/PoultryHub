import { createFarm } from "../../services/eggProductionService";
import type { Farm } from "../../types/eggProduction";

const NEW_FARM_VALUE = "__new_farm__";
const UNASSIGNED_VALUE = "";

interface FarmSelectProps {
  id?: string;
  value: string;
  farms: Farm[];
  onChange: (farmId: string) => void;
  onFarmCreated: (farm: Farm) => void;
  /** Show a selectable "Unassigned" option (Users page) instead of requiring a farm (record forms). */
  allowUnassigned?: boolean;
  className?: string;
}

/** Farm picker with an inline "+ Add new farm…" quick-create — shared by the Egg Production form and the Users page's farm-assignment column. */
export default function FarmSelect({
  id,
  value,
  farms,
  onChange,
  onFarmCreated,
  allowUnassigned = false,
  className,
}: FarmSelectProps) {
  const handleChange = async (raw: string) => {
    if (raw !== NEW_FARM_VALUE) {
      onChange(raw);
      return;
    }
    const name = window.prompt("New farm name:");
    if (!name || !name.trim()) return;
    try {
      const farm = await createFarm(name.trim());
      onFarmCreated(farm);
      onChange(farm.id);
    } catch (err) {
      console.error("[FarmSelect] create farm failed:", err);
      alert("Couldn't add that farm.");
    }
  };

  return (
    <select
      id={id}
      value={value}
      onChange={(e) => void handleChange(e.target.value)}
      className={
        className ??
        "rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
      }
    >
      {allowUnassigned ? (
        <option value={UNASSIGNED_VALUE}>Unassigned</option>
      ) : (
        <option value="" disabled>
          Select a farm…
        </option>
      )}
      {farms.map((farm) => (
        <option key={farm.id} value={farm.id}>
          {farm.name}
        </option>
      ))}
      <option value={NEW_FARM_VALUE}>+ Add new farm…</option>
    </select>
  );
}

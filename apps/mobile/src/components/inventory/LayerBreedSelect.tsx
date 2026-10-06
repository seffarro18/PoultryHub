import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Loader2, Plus } from "lucide-react";
import { createLayerBreed, listLayerBreeds } from "@poultryhub/shared/services/layerBreedService";
import type { EggColor, LayerBreed } from "@poultryhub/shared/types/layerBreed";
import AddLayerBreedDialog from "./AddLayerBreedDialog";

const NEW_BREED_VALUE = "__new_breed__";

interface LayerBreedSelectProps {
  id?: string;
  farmId: string;
  value: string;
  onChange: (breed: LayerBreed | null) => void;
  /** Farm Admin/Manager only — lets them register a strain specific to their own farm inline. RLS also blocks a Staff-submitted insert regardless of what the UI shows. */
  canManage?: boolean;
}

const GROUP_LABEL: Record<EggColor, string> = { White: "White-Egg Layers", Brown: "Brown-Egg Layers", Other: "Other" };

/** Loads the farm's selectable Layer Breed/Strain list (system defaults + the farm's own active custom strains, never hardcoded) and groups it by egg color — same shape/behavior as PoultryHouseSelect. */
export default function LayerBreedSelect({ id, farmId, value, onChange, canManage = false }: LayerBreedSelectProps) {
  const [breeds, setBreeds] = useState<LayerBreed[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!farmId) {
      setBreeds([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    listLayerBreeds()
      .then((result) => {
        if (!cancelled) setBreeds(result.filter((b) => b.isActive));
      })
      .catch((err: unknown) => {
        console.error("[LayerBreedSelect] failed to load layer breeds:", err);
        if (!cancelled) setLoadError("Couldn't load Layer Breed/Strain options.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [farmId]);

  const grouped = useMemo(() => {
    const groups = new Map<EggColor, LayerBreed[]>([["White", []], ["Brown", []], ["Other", []]]);
    for (const breed of breeds) groups.get(breed.eggColor)?.push(breed);
    return groups;
  }, [breeds]);

  const handleSelectChange = (raw: string) => {
    if (raw === NEW_BREED_VALUE) {
      setAddOpen(true);
      return;
    }
    const breed = breeds.find((b) => b.name === raw);
    onChange(breed ?? null);
  };

  const handleCreate = async (name: string, eggColor: EggColor) => {
    setCreating(true);
    try {
      const breed = await createLayerBreed(farmId, { name, eggColor, isActive: true });
      setBreeds((prev) => [...prev, breed]);
      onChange(breed);
      setAddOpen(false);
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-muted)]">
        <Loader2 size={14} className="spinner" /> Loading strains…
      </div>
    );
  }

  if (loadError) {
    return <p className="text-sm text-[var(--color-danger)]">{loadError}</p>;
  }

  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(e) => handleSelectChange(e.target.value)}
        className="w-full appearance-none rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 pr-9 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
      >
        <option value="" disabled>
          Select Layer Breed / Strain
        </option>
        {(["White", "Brown", "Other"] as EggColor[]).map((color) => {
          const items = grouped.get(color) ?? [];
          if (items.length === 0) return null;
          return (
            <optgroup key={color} label={GROUP_LABEL[color]}>
              {items.map((breed) => (
                <option key={breed.id} value={breed.name}>{breed.name}</option>
              ))}
            </optgroup>
          );
        })}
        {canManage && <option value={NEW_BREED_VALUE}>+ Add Layer Breed / Strain…</option>}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
      {canManage && !addOpen && breeds.length === 0 && (
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="mt-2 flex w-fit items-center gap-1.5 text-sm font-semibold text-[var(--color-primary)] hover:opacity-75"
        >
          <Plus size={14} /> Add Layer Breed / Strain
        </button>
      )}
      {addOpen && <AddLayerBreedDialog onCancel={() => setAddOpen(false)} onConfirm={handleCreate} creating={creating} />}
    </div>
  );
}

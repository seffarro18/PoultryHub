import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { createLayerBreed, listLayerBreeds } from "@poultryhub/shared/services/layerBreedService";
import type { EggColor, LayerBreed } from "@poultryhub/shared/types/layerBreed";
import AddLayerBreedDialog from "./AddLayerBreedDialog";
import MobileSelect, { type MobileSelectGroup } from "../ui/MobileSelect";

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

  const optionGroups: MobileSelectGroup[] = (["White", "Brown", "Other"] as EggColor[])
    .map((color) => ({ label: GROUP_LABEL[color], options: (grouped.get(color) ?? []).map((breed) => ({ value: breed.name, label: breed.name })) }))
    .filter((group) => group.options.length > 0);

  return (
    <div>
      <MobileSelect
        id={id}
        value={value}
        onChange={handleSelectChange}
        placeholder="Select Layer Breed / Strain"
        sheetTitle="Select Layer Breed / Strain"
        searchable={breeds.length > 6}
        searchPlaceholder="Search breeds/strains…"
        options={optionGroups}
        trailingAction={canManage ? { label: "Add Layer Breed / Strain…", onClick: () => setAddOpen(true) } : undefined}
      />
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

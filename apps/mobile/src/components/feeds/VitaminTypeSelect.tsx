import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Loader2, Plus, RotateCcw } from "lucide-react";
import { createVitaminType, listVitaminTypes, subscribeToCatalog } from "@poultryhub/shared/services/catalogService";
import { catalogKey, type VitaminTypeInput, type VitaminTypeItem } from "@poultryhub/shared/types/catalog";
import { useToast } from "@poultryhub/shared/components/ui/ToastContext";
import AddVitaminTypeDialog from "./AddVitaminTypeDialog";
import MobileSelect from "../ui/MobileSelect";

interface VitaminTypeSelectProps {
  id?: string;
  /** The vitamin name as stored on a batch — matched to a catalog type case-insensitively. */
  value: string;
  onChange: (type: VitaminTypeItem) => void;
  farmId: string;
  canManage?: boolean;
}

/** The farm's vitamin catalog (vitamin_types: system defaults + this farm's own), live-updated via Realtime. */
export default function VitaminTypeSelect({ id, value, onChange, farmId, canManage = false }: VitaminTypeSelectProps) {
  const toast = useToast();
  const [types, setTypes] = useState<VitaminTypeItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setTypes((await listVitaminTypes()).filter((t) => t.isActive));
    } catch (err) {
      console.error("[VitaminTypeSelect] failed to load vitamin types:", err);
      setLoadError("Couldn't load vitamin types.");
    }
  }, []);

  useEffect(() => {
    void load();
    return subscribeToCatalog("vitamin_types", () => void load());
  }, [load]);

  const selected = useMemo(() => types?.find((t) => value && catalogKey(t.name) === catalogKey(value)) ?? null, [types, value]);

  const handleCreate = async (input: VitaminTypeInput) => {
    setCreating(true);
    try {
      const created = await createVitaminType(farmId, input);
      setTypes((prev) => [...(prev ?? []), created].sort((a, b) => a.name.localeCompare(b.name)));
      onChange(created);
      setAddOpen(false);
      toast.success(`${created.name} added to your farm's vitamin catalog.`);
    } finally {
      setCreating(false);
    }
  };

  if (loadError) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-danger)]">
        {loadError}
        <button type="button" onClick={() => void load()} className="flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)]">
          <RotateCcw size={12} /> Retry
        </button>
      </div>
    );
  }
  if (types === null) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-muted)]">
        <Loader2 size={14} className="spinner" /> Loading vitamins…
      </div>
    );
  }

  const legacy = !selected && value ? [{ value: "__current__", label: `${value} (not in catalog)` }] : [];

  return (
    <div>
      <MobileSelect
        id={id}
        value={selected?.id ?? (value ? "__current__" : "")}
        onChange={(v) => {
          const t = types.find((x) => x.id === v);
          if (t) onChange(t);
        }}
        placeholder="Select a vitamin…"
        sheetTitle="Vitamin"
        searchable={types.length > 6}
        searchPlaceholder="Search vitamins…"
        options={[...legacy, ...types.map((t) => ({ value: t.id, label: t.name }))]}
        trailingAction={canManage ? { label: "Add New Vitamin Type", onClick: () => setAddOpen(true) } : undefined}
      />
      {canManage && types.length === 0 && (
        <button type="button" onClick={() => setAddOpen(true)} className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-[var(--color-primary)]">
          <Plus size={14} /> Add New Vitamin Type
        </button>
      )}
      <AnimatePresence>
        {addOpen && (
          <AddVitaminTypeDialog
            existing={types}
            creating={creating}
            onCancel={() => setAddOpen(false)}
            onConfirm={handleCreate}
            onUseExisting={(t) => {
              onChange(t);
              setAddOpen(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

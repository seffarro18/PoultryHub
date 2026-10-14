import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Loader2, Plus, RotateCcw } from "lucide-react";
import { createFeedType, listFeedTypes, subscribeToCatalog } from "@poultryhub/shared/services/catalogService";
import { catalogKey, feedTypeLabel, type FeedType, type FeedTypeInput } from "@poultryhub/shared/types/catalog";
import { useToast } from "@poultryhub/shared/components/ui/ToastContext";
import AddFeedTypeDialog from "./AddFeedTypeDialog";
import MobileSelect from "../ui/MobileSelect";

interface FeedBrandSelectProps {
  id?: string;
  /** The brand as stored on the batch (text). */
  value: string | null;
  onChange: (brand: string) => void;
  /** A feed type just added through "+ Add New Feed Type" — the form fills Brand, Category and Sack Size from it. */
  onFeedTypeAdded: (type: FeedType) => void;
  farmId: string;
  /** Farm Admin/Manager — shows "+ Add New Feed Type". RLS blocks anyone else's insert regardless. */
  canManage?: boolean;
}

/**
 * Feed Brand dropdown backed by the farm's feed catalog (feed_types: system
 * defaults + this farm's own types, migration 0049) — the distinct brands,
 * live-updated via Realtime. Category and Sack Size stay separate fields.
 */
export default function FeedBrandSelect({ id, value, onChange, onFeedTypeAdded, farmId, canManage = false }: FeedBrandSelectProps) {
  const toast = useToast();
  const [types, setTypes] = useState<FeedType[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setTypes((await listFeedTypes()).filter((t) => t.isActive));
    } catch (err) {
      console.error("[FeedBrandSelect] failed to load feed types:", err);
      setLoadError("Couldn't load feed brands.");
    }
  }, []);

  useEffect(() => {
    void load();
    return subscribeToCatalog("feed_types", () => void load());
  }, [load]);

  /** One option per brand, case/space-insensitive (same rule as the database's duplicate guard). */
  const brands = useMemo(() => {
    const byKey = new Map<string, string>();
    for (const t of types ?? []) if (!byKey.has(catalogKey(t.brand))) byKey.set(catalogKey(t.brand), t.brand);
    return [...byKey.values()].sort((a, b) => a.localeCompare(b));
  }, [types]);

  const selectedBrand = value ? (brands.find((b) => catalogKey(b) === catalogKey(value)) ?? null) : null;

  const handleCreate = async (input: FeedTypeInput) => {
    setCreating(true);
    try {
      const created = await createFeedType(farmId, input);
      setTypes((prev) => [...(prev ?? []), created]);
      onFeedTypeAdded(created);
      setAddOpen(false);
      toast.success(`${feedTypeLabel(created)} added to your farm's feed catalog.`);
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
        <Loader2 size={14} className="spinner" /> Loading brands…
      </div>
    );
  }

  // A batch recorded under a brand no longer in the catalog still shows as itself.
  const legacy = value && !selectedBrand ? [{ value, label: `${value} (not in catalog)` }] : [];

  return (
    <div>
      <MobileSelect
        id={id}
        value={selectedBrand ?? value ?? ""}
        onChange={onChange}
        placeholder="Select feed brand…"
        sheetTitle="Feed Brand"
        searchable={brands.length > 6}
        searchPlaceholder="Search brands…"
        options={[...legacy, ...brands.map((b) => ({ value: b, label: b }))]}
        trailingAction={canManage ? { label: "Add New Feed Type", onClick: () => setAddOpen(true) } : undefined}
      />
      {canManage && brands.length === 0 && (
        <button type="button" onClick={() => setAddOpen(true)} className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-[var(--color-primary)]">
          <Plus size={14} /> Add New Feed Type
        </button>
      )}
      <AnimatePresence>
        {addOpen && (
          <AddFeedTypeDialog
            existing={types}
            creating={creating}
            onCancel={() => setAddOpen(false)}
            onConfirm={handleCreate}
            onUseExisting={(t) => {
              onFeedTypeAdded(t);
              setAddOpen(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

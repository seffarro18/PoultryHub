import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Button from "@poultryhub/shared/components/ui/Button";
import { useEscapeKey } from "@poultryhub/shared/hooks/useEscapeKey";
import { getErrorMessage } from "@poultryhub/shared/lib/errorMessage";
import { FEED_CATEGORIES, FEED_PACKAGE_SIZES, formatFeedPackaging } from "@poultryhub/shared/types/feedVitamin";
import { catalogKey, feedTypeLabel, type FeedType, type FeedTypeInput } from "@poultryhub/shared/types/catalog";
import MobileSelect from "../ui/MobileSelect";

interface AddFeedTypeDialogProps {
  /** Types this farm can already pick (system + own) — for brand suggestions and the duplicate check. */
  existing: FeedType[];
  onCancel: () => void;
  onConfirm: (input: FeedTypeInput) => Promise<void>;
  /** "Use existing" on a duplicate selects that entry instead of creating another. */
  onUseExisting: (type: FeedType) => void;
  creating?: boolean;
}

const inputClass =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)]";

/** Same overlay/card shell as AddLayerBreedDialog — adds a feed product to the farm's catalog (no stock, no expense). */
export default function AddFeedTypeDialog({ existing, onCancel, onConfirm, onUseExisting, creating = false }: AddFeedTypeDialogProps) {
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState<FeedTypeInput["category"]>("Layer");
  const [packageSize, setPackageSize] = useState<FeedTypeInput["packageSize"]>("50 kg");
  const [error, setError] = useState<string | null>(null);
  const reducedMotion = useReducedMotion();
  useEscapeKey(onCancel);

  const trimmed = brand.trim().replace(/\s+/g, " ");
  const brands = useMemo(() => [...new Set(existing.map((t) => t.brand))].sort((a, b) => a.localeCompare(b)), [existing]);
  const duplicate = trimmed
    ? existing.find((t) => catalogKey(t.brand) === catalogKey(trimmed) && t.category === category && t.packageSize === packageSize)
    : undefined;

  const handleConfirm = async () => {
    if (!trimmed || duplicate || creating) return;
    setError(null);
    try {
      await onConfirm({ brand: trimmed, category, packageSize });
    } catch (err) {
      console.error("[AddFeedTypeDialog] failed to create feed type:", err);
      setError(getErrorMessage(err, "Couldn't add that feed type. Please try again."));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0.01 : 0.15 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, scale: reducedMotion ? 1 : 0.96, y: reducedMotion ? 0 : 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0.01 : 0.25, ease: [0.22, 1, 0.36, 1] }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-feed-type-title"
        className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="add-feed-type-title" className="font-display text-base font-semibold text-[var(--color-foreground)]">
          Add Feed Type
        </h2>
        <p className="mt-1.5 text-sm text-[var(--color-muted)]">Add a feed item to your farm's catalog. It will become available to your farm's staff right away.</p>

        <label htmlFor="new-feed-brand" className="mt-3 block text-sm font-medium text-[var(--color-foreground)]">
          Feed Brand / Name
        </label>
        <input
          id="new-feed-brand"
          type="text"
          value={brand}
          onChange={(e) => {
            setBrand(e.target.value);
            setError(null);
          }}
          autoFocus
          maxLength={80}
          placeholder="e.g. New Hope Feeds"
          className={`${inputClass} mt-1.5`}
        />
        {brands.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {brands.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBrand(b)}
                className={`rounded-full border px-2.5 py-1 text-xs ${
                  catalogKey(b) === catalogKey(brand) ? "border-[var(--color-primary)] text-[var(--color-primary)]" : "border-[var(--color-border)] text-[var(--color-muted)]"
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="new-feed-category" className="block text-sm font-medium text-[var(--color-foreground)]">
              Feed Category
            </label>
            <div className="mt-1.5">
              <MobileSelect
                id="new-feed-category"
                value={category}
                onChange={(v) => setCategory(v as FeedTypeInput["category"])}
                sheetTitle="Feed Category"
                options={FEED_CATEGORIES.map((c) => ({ value: c, label: c }))}
              />
            </div>
          </div>
          <div>
            <label htmlFor="new-feed-size" className="block text-sm font-medium text-[var(--color-foreground)]">
              Sack Size
            </label>
            <div className="mt-1.5">
              <MobileSelect
                id="new-feed-size"
                value={packageSize}
                onChange={(v) => setPackageSize(v as FeedTypeInput["packageSize"])}
                sheetTitle="Sack Size"
                options={FEED_PACKAGE_SIZES.map((s) => ({ value: s, label: formatFeedPackaging(s) }))}
              />
            </div>
          </div>
        </div>

        {trimmed && (
          <p className="mt-3 rounded-lg bg-[var(--color-muted-bg)] px-3 py-2 text-xs text-[var(--color-foreground)]">
            Will appear as: <span className="font-semibold">{feedTypeLabel({ brand: trimmed, category, packageSize })}</span>
          </p>
        )}

        {duplicate && (
          <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-[var(--color-warning)]/10 px-3 py-2 text-xs text-[var(--color-foreground)]">
            <span>This feed type already exists in your farm catalog.</span>
            <button type="button" onClick={() => onUseExisting(duplicate)} className="shrink-0 font-semibold text-[var(--color-primary)]">
              Use existing
            </button>
          </div>
        )}
        {error && <p className="mt-2 text-sm text-[var(--color-danger)]">{error}</p>}

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" loading={creating} loadingText="Adding…" disabled={!trimmed || Boolean(duplicate)} onClick={() => void handleConfirm()}>
            Add Feed Type
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

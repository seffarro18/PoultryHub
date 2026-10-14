import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Button from "@poultryhub/shared/components/ui/Button";
import { useEscapeKey } from "@poultryhub/shared/hooks/useEscapeKey";
import { getErrorMessage } from "@poultryhub/shared/lib/errorMessage";
import { VITAMIN_PACKAGE_SIZES_BY_UNIT, VITAMIN_UNIT_OPTIONS, type VitaminType, type VitaminUnit } from "@poultryhub/shared/types/feedVitamin";
import {
  VITAMIN_CATALOG_CATEGORIES,
  VITAMIN_PRODUCT_FORMS,
  catalogKey,
  type VitaminCatalogCategory,
  type VitaminTypeInput,
  type VitaminTypeItem,
} from "@poultryhub/shared/types/catalog";
import MobileSelect from "../ui/MobileSelect";

interface AddVitaminTypeDialogProps {
  existing: VitaminTypeItem[];
  onCancel: () => void;
  onConfirm: (input: VitaminTypeInput) => Promise<void>;
  onUseExisting: (type: VitaminTypeItem) => void;
  creating?: boolean;
}

/** The usual container for each form — still changeable, it's only the default. */
const DEFAULT_UNIT_FOR_FORM: Record<VitaminType, VitaminUnit> = { Liquid: "bot", Solid: "pack", Tablet: "box" };
const NO_PACKAGE = "__none__";

const inputClass =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)]";

/** Same shell as AddLayerBreedDialog — adds a vitamin/supplement to the farm's catalog (no stock, no expense). */
export default function AddVitaminTypeDialog({ existing, onCancel, onConfirm, onUseExisting, creating = false }: AddVitaminTypeDialogProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<VitaminCatalogCategory | "">("");
  const [productForm, setProductForm] = useState<VitaminType>("Liquid");
  const [unit, setUnit] = useState<VitaminUnit>("bot");
  const [packageSize, setPackageSize] = useState<string>(NO_PACKAGE);
  const [error, setError] = useState<string | null>(null);
  const reducedMotion = useReducedMotion();
  useEscapeKey(onCancel);

  const trimmed = name.trim().replace(/\s+/g, " ");
  const duplicate = trimmed ? existing.find((t) => catalogKey(t.name) === catalogKey(trimmed)) : undefined;
  const sizeOptions = VITAMIN_PACKAGE_SIZES_BY_UNIT[unit] ?? [];

  const handleConfirm = async () => {
    if (!trimmed || duplicate || !category || creating) return;
    setError(null);
    try {
      await onConfirm({ name: trimmed, category, productForm, defaultUnit: unit, packageSize: packageSize === NO_PACKAGE ? null : packageSize });
    } catch (err) {
      console.error("[AddVitaminTypeDialog] failed to create vitamin type:", err);
      setError(getErrorMessage(err, "Couldn't add that vitamin. Please try again."));
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
        aria-labelledby="add-vitamin-type-title"
        className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="add-vitamin-type-title" className="font-display text-base font-semibold text-[var(--color-foreground)]">
          Add Vitamin Type
        </h2>
        <p className="mt-1.5 text-sm text-[var(--color-muted)]">
          Add a vitamin or supplement to your farm's catalog. It will become available to your farm's staff right away.
        </p>

        <label htmlFor="new-vitamin-name" className="mt-3 block text-sm font-medium text-[var(--color-foreground)]">
          Vitamin Name
        </label>
        <input
          id="new-vitamin-name"
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          autoFocus
          maxLength={80}
          placeholder="e.g. Promoxil"
          className={`${inputClass} mt-1.5`}
        />

        <label htmlFor="new-vitamin-category" className="mt-3 block text-sm font-medium text-[var(--color-foreground)]">
          Vitamin Category
        </label>
        <div className="mt-1.5">
          <MobileSelect
            id="new-vitamin-category"
            value={category}
            onChange={(v) => setCategory(v as VitaminCatalogCategory)}
            placeholder="Select a category…"
            sheetTitle="Vitamin Category"
            options={VITAMIN_CATALOG_CATEGORIES.map((c) => ({ value: c, label: c }))}
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="new-vitamin-form" className="block text-sm font-medium text-[var(--color-foreground)]">
              Product Form
            </label>
            <div className="mt-1.5">
              <MobileSelect
                id="new-vitamin-form"
                value={productForm}
                onChange={(v) => {
                  const form = v as VitaminType;
                  setProductForm(form);
                  setUnit(DEFAULT_UNIT_FOR_FORM[form]);
                  setPackageSize(NO_PACKAGE);
                }}
                sheetTitle="Product Form"
                options={VITAMIN_PRODUCT_FORMS.map((f) => ({ value: f, label: f }))}
              />
            </div>
          </div>
          <div>
            <label htmlFor="new-vitamin-unit" className="block text-sm font-medium text-[var(--color-foreground)]">
              Inventory Unit
            </label>
            <div className="mt-1.5">
              <MobileSelect
                id="new-vitamin-unit"
                value={unit}
                onChange={(v) => {
                  setUnit(v as VitaminUnit);
                  setPackageSize(NO_PACKAGE);
                }}
                sheetTitle="Inventory Unit"
                options={VITAMIN_UNIT_OPTIONS.map((u) => ({ value: u.value, label: u.label }))}
              />
            </div>
          </div>
        </div>

        <label htmlFor="new-vitamin-package" className="mt-3 block text-sm font-medium text-[var(--color-foreground)]">
          Package Size <span className="font-normal text-[var(--color-muted)]">(optional)</span>
        </label>
        <div className="mt-1.5">
          <MobileSelect
            id="new-vitamin-package"
            value={packageSize}
            onChange={setPackageSize}
            sheetTitle="Package Size"
            options={[{ value: NO_PACKAGE, label: "Not applicable" }, ...sizeOptions.map((s) => ({ value: s, label: s }))]}
          />
        </div>

        {duplicate && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-[var(--color-warning)]/10 px-3 py-2 text-xs text-[var(--color-foreground)]">
            <span>This vitamin already exists in your farm catalog.</span>
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
          <Button
            variant="primary"
            loading={creating}
            loadingText="Adding…"
            disabled={!trimmed || !category || Boolean(duplicate)}
            onClick={() => void handleConfirm()}
          >
            Add Vitamin Type
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

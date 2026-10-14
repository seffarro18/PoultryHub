import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { updateVitaminBatch } from "@poultryhub/shared/services/feedVitaminService";
import { getPurchase, recordVitaminPurchase } from "@poultryhub/shared/services/purchaseService";
import { filterDecimalText, filterIntegerText, parseNumericText, stripLeadingZeros } from "@poultryhub/shared/lib/numericInput";
import { useToast } from "@poultryhub/shared/components/ui/ToastContext";
import PurchaseReceiptModal from "@poultryhub/shared/components/finance/PurchaseReceiptModal";
import {
  VITAMIN_PACKAGE_SIZES_BY_UNIT,
  VITAMIN_UNIT_OPTIONS,
  formatUnitLabel,
  type VitaminBatch,
  type VitaminBatchInput,
  type VitaminUnit,
} from "@poultryhub/shared/types/feedVitamin";
import type { Purchase } from "@poultryhub/shared/types/purchase";
import { getErrorMessage } from "@poultryhub/shared/lib/errorMessage";
import MobileSelect from "../ui/MobileSelect";
import VitaminTypeSelect from "./VitaminTypeSelect";
import type { VitaminTypeItem } from "@poultryhub/shared/types/catalog";

interface VitaminBatchFormDrawerProps {
  /** null = add mode */
  batch: VitaminBatch | null;
  fixedFarmId: string;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Vitamin Type/Brand/Batch Number/Supplier are no longer collected — a
 * fixed "Liquid" vitamin_type satisfies the still-NOT-NULL column (the
 * stored value itself is irrelevant now that nothing reads it for new
 * purchases), and brand/batch_number/supplier are sent as null. Editing an
 * existing batch preserves whatever those already held, same reasoning as
 * FeedBatchFormDrawer's toInputState.
 */
function toInputState(batch: VitaminBatch | null, fixedFarmId: string): VitaminBatchInput {
  if (batch) {
    return {
      farmId: batch.farmId,
      vitaminName: batch.vitaminName,
      vitaminType: batch.vitaminType,
      category: batch.category,
      brand: batch.brand,
      batchNumber: batch.batchNumber,
      supplier: batch.supplier,
      quantity: batch.quantity,
      unit: batch.unit,
      packageSize: batch.packageSize,
      purchaseDate: batch.purchaseDate,
      expirationDate: batch.expirationDate,
      remarks: batch.remarks,
    };
  }
  return {
    farmId: fixedFarmId,
    // Chosen from the farm's vitamin catalog (vitamin_types) — nothing preselected.
    vitaminName: "",
    vitaminType: "Liquid",
    category: null,
    brand: null,
    batchNumber: null,
    supplier: null,
    quantity: 0,
    unit: VITAMIN_UNIT_OPTIONS[0].value,
    packageSize: VITAMIN_PACKAGE_SIZES_BY_UNIT[VITAMIN_UNIT_OPTIONS[0].value][0],
    purchaseDate: new Date().toISOString().slice(0, 10),
    expirationDate: null,
    remarks: null,
  };
}

const inputClass =
  "rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)]";

const currency = (v: number) => `₱${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function VitaminBatchFormDrawer({ batch, fixedFarmId, onClose, onSaved }: VitaminBatchFormDrawerProps) {
  const isEdit = batch !== null;
  const toast = useToast();
  const [input, setInput] = useState<VitaminBatchInput>(() => toInputState(batch, fixedFarmId));
  const [quantityText, setQuantityText] = useState(() => (batch && batch.quantity > 0 ? String(batch.quantity) : ""));
  // Purchase-only — see FeedBatchFormDrawer's matching comment.
  const [unitPriceText, setUnitPriceText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Purchase | null>(null);

  const unitPrice = parseNumericText(unitPriceText);
  const totalCost = input.quantity * unitPrice;
  const packageSizeOptions = VITAMIN_PACKAGE_SIZES_BY_UNIT[input.unit as VitaminUnit] ?? [];
  // A record's name/package size might predate the current dropdown lists
  // (e.g. edited after this list changed) — shown as its own extra option
  // rather than silently dropped, so editing never looks like it renamed
  // something the farmer didn't touch.
  const packageSizeMatchesOption = packageSizeOptions.includes(input.packageSize ?? "");

  /** A catalog vitamin sets name, category and form, and pre-fills its default unit/package size (both still editable for this purchase). */
  const handleTypeChange = (t: VitaminTypeItem) => {
    const sizes = VITAMIN_PACKAGE_SIZES_BY_UNIT[t.defaultUnit] ?? [];
    setInput((prev) => ({
      ...prev,
      vitaminName: t.name,
      category: t.category,
      vitaminType: t.productForm,
      unit: t.defaultUnit,
      // Only a size that fits the unit (ml for bottles, g for packs) — otherwise the user picks one.
      packageSize: t.packageSize && sizes.includes(t.packageSize) ? t.packageSize : (sizes[0] ?? null),
    }));
    setError(null);
  };

  /** Changing the unit keeps the package size only if it's valid for the new unit — otherwise it's cleared and must be re-chosen. */
  const handleUnitChange = (value: string) => {
    const sizes = VITAMIN_PACKAGE_SIZES_BY_UNIT[value as VitaminUnit] ?? [];
    setInput((prev) => ({ ...prev, unit: value, packageSize: prev.packageSize && sizes.includes(prev.packageSize) ? prev.packageSize : null }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.vitaminName.trim() || !input.category) {
      setError("Select a vitamin from the catalog (or add a new vitamin type).");
      return;
    }
    // New purchases need a package size that matches the unit. Editing an
    // older batch may keep the size it was recorded with.
    if (!isEdit && (!input.packageSize || !packageSizeOptions.includes(input.packageSize))) {
      setError("Select a package size that matches the unit (ml for bottles, g for packs, tablets for boxes).");
      return;
    }
    if (input.quantity <= 0) {
      setError("Quantity must be greater than zero.");
      return;
    }
    if (!isEdit && unitPrice < 0) {
      setError("Price cannot be negative.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isEdit) {
        await updateVitaminBatch(batch.id, input);
        toast.success("Vitamin stock updated successfully.");
        onSaved();
      } else {
        const purchaseId = await recordVitaminPurchase({
          farmId: input.farmId,
          vitaminName: input.vitaminName,
          vitaminType: input.vitaminType,
          category: input.category,
          brand: null,
          batchNumber: null,
          supplier: null,
          quantity: input.quantity,
          unit: input.unit,
          packageSize: input.packageSize,
          unitPrice,
          purchaseDate: input.purchaseDate,
          expirationDate: input.expirationDate,
          remarks: input.remarks,
        });
        toast.success("Vitamin stock added successfully.");
        setReceipt(await getPurchase(purchaseId));
      }
    } catch (err) {
      console.error("[VitaminBatchFormDrawer] save failed:", err);
      setError(getErrorMessage(err, "Couldn't save this vitamin batch. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  if (receipt) {
    return (
      <PurchaseReceiptModal
        purchase={receipt}
        onClose={() => {
          setReceipt(null);
          onSaved();
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <h2 className="font-display text-base font-semibold text-[var(--color-foreground)]">
            {isEdit ? "Edit Vitamin Stock" : "Add Vitamin Stock"}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)]" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex flex-col gap-4 px-5 py-4">
            {error && <p className="rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">{error}</p>}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="vitamin-name" className="text-sm font-medium text-[var(--color-foreground)]">Vitamin Name</label>
              <VitaminTypeSelect id="vitamin-name" farmId={input.farmId} canManage value={input.vitaminName} onChange={handleTypeChange} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-[var(--color-foreground)]">Category</span>
                <div className={`${inputClass} bg-[var(--color-muted-bg)] text-[var(--color-muted)]`}>{input.category ?? "—"}</div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-[var(--color-foreground)]">Use</span>
                <div className={`${inputClass} bg-[var(--color-muted-bg)] text-[var(--color-muted)]`}>Layer Chicken</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="vitamin-quantity" className="text-sm font-medium text-[var(--color-foreground)]">Quantity Purchased</label>
                <input
                  id="vitamin-quantity"
                  type="text"
                  inputMode="numeric"
                  placeholder="Enter quantity"
                  value={quantityText}
                  onChange={(e) => {
                    const filtered = stripLeadingZeros(filterIntegerText(e.target.value));
                    setQuantityText(filtered);
                    setInput((prev) => ({ ...prev, quantity: parseNumericText(filtered) }));
                    setError(null);
                  }}
                  className={inputClass}
                />
                {isEdit && (
                  <p className="text-xs text-[var(--color-muted)]">
                    Already used: {(batch.quantity - batch.remainingStock).toLocaleString()}{" "}
                    {formatUnitLabel(batch.unit, batch.quantity - batch.remainingStock)} — can't go below this.
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="vitamin-unit" className="text-sm font-medium text-[var(--color-foreground)]">Unit</label>
                <MobileSelect
                  id="vitamin-unit"
                  value={input.unit}
                  onChange={handleUnitChange}
                  sheetTitle="Unit"
                  options={VITAMIN_UNIT_OPTIONS.map((u) => ({ value: u.value, label: u.label }))}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="vitamin-package-size" className="text-sm font-medium text-[var(--color-foreground)]">Package Size</label>
              <MobileSelect
                id="vitamin-package-size"
                value={input.packageSize ?? ""}
                placeholder="Select package size…"
                onChange={(v) => setInput((prev) => ({ ...prev, packageSize: v || null }))}
                sheetTitle="Package Size"
                options={[
                  ...(!packageSizeMatchesOption && input.packageSize ? [{ value: input.packageSize, label: input.packageSize }] : []),
                  ...packageSizeOptions.map((s) => ({ value: s, label: s })),
                ]}
              />
            </div>

            {!isEdit && (
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="vitamin-unit-price" className="text-sm font-medium text-[var(--color-foreground)]">Price Per Unit</label>
                  <input
                    id="vitamin-unit-price"
                    type="text"
                    inputMode="decimal"
                    placeholder="₱0.00"
                    value={unitPriceText}
                    onChange={(e) => setUnitPriceText(filterDecimalText(e.target.value))}
                    className={inputClass}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="vitamin-total-cost" className="text-sm font-medium text-[var(--color-foreground)]">
                    Total Cost <span className="font-normal text-[var(--color-muted)]">(auto-calculated)</span>
                  </label>
                  <div id="vitamin-total-cost" className={`${inputClass} bg-[var(--color-muted-bg)] text-[var(--color-foreground)]`}>
                    {currency(totalCost)}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="vitamin-purchase-date" className="text-sm font-medium text-[var(--color-foreground)]">Purchase Date</label>
                <input
                  id="vitamin-purchase-date"
                  type="date"
                  value={input.purchaseDate}
                  onChange={(e) => setInput((prev) => ({ ...prev, purchaseDate: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-[var(--color-foreground)]">Payment Method</span>
                <div className={`${inputClass} bg-[var(--color-muted-bg)] text-[var(--color-muted)]`}>Cash</div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="vitamin-expiration" className="text-sm font-medium text-[var(--color-foreground)]">
                Expiration Date <span className="font-normal text-[var(--color-muted)]">(optional)</span>
              </label>
              <input
                id="vitamin-expiration"
                type="date"
                value={input.expirationDate ?? ""}
                onChange={(e) => setInput((prev) => ({ ...prev, expirationDate: e.target.value || null }))}
                className={inputClass}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="vitamin-remarks" className="text-sm font-medium text-[var(--color-foreground)]">
                Remarks <span className="font-normal text-[var(--color-muted)]">(optional)</span>
              </label>
              <textarea
                id="vitamin-remarks"
                value={input.remarks ?? ""}
                onChange={(e) => setInput((prev) => ({ ...prev, remarks: e.target.value || null }))}
                rows={2}
                placeholder="Optional"
                className={`${inputClass} resize-none`}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] px-5 py-4">
            <button type="button" onClick={onClose} className="rounded-lg px-3.5 py-2 text-sm font-medium text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)]">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-70">
              {saving && <Loader2 size={14} className="spinner" />}
              {isEdit ? "Save Changes" : "Add Vitamin Stock"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

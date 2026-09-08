import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { createVitaminBatch, updateVitaminBatch } from "@poultryhub/shared/services/feedVitaminService";
import { VITAMIN_CATEGORY_SUGGESTIONS, VITAMIN_UNIT_SUGGESTIONS, type VitaminBatch, type VitaminBatchInput } from "@poultryhub/shared/types/feedVitamin";

interface VitaminBatchFormDrawerProps {
  /** null = add mode */
  batch: VitaminBatch | null;
  fixedFarmId: string;
  onClose: () => void;
  onSaved: () => void;
}

function toInputState(batch: VitaminBatch | null, fixedFarmId: string): VitaminBatchInput {
  if (batch) {
    return {
      farmId: batch.farmId,
      vitaminName: batch.vitaminName,
      category: batch.category,
      brand: batch.brand,
      batchNumber: batch.batchNumber,
      supplier: batch.supplier,
      quantity: batch.quantity,
      unit: batch.unit,
      remainingStock: batch.remainingStock,
      minimumStockLevel: batch.minimumStockLevel,
      purchaseDate: batch.purchaseDate,
      expirationDate: batch.expirationDate,
      storageLocation: batch.storageLocation,
      remarks: batch.remarks,
    };
  }
  return {
    farmId: fixedFarmId,
    vitaminName: "",
    category: null,
    brand: null,
    batchNumber: null,
    supplier: null,
    quantity: 0,
    unit: "ml",
    remainingStock: 0,
    minimumStockLevel: 0,
    purchaseDate: new Date().toISOString().slice(0, 10),
    expirationDate: "",
    storageLocation: null,
    remarks: null,
  };
}

export default function VitaminBatchFormDrawer({ batch, fixedFarmId, onClose, onSaved }: VitaminBatchFormDrawerProps) {
  const isEdit = batch !== null;
  const [input, setInput] = useState<VitaminBatchInput>(() => toInputState(batch, fixedFarmId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.vitaminName.trim()) {
      setError("Vitamin name is required.");
      return;
    }
    if (input.quantity <= 0) {
      setError("Quantity must be greater than zero.");
      return;
    }
    if (!input.unit.trim()) {
      setError("Unit is required.");
      return;
    }
    if (!input.expirationDate) {
      setError("Expiration date is required for vitamins.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: VitaminBatchInput = { ...input, vitaminName: input.vitaminName.trim() };
      if (isEdit) {
        await updateVitaminBatch(batch.id, payload);
      } else {
        await createVitaminBatch(payload);
      }
      onSaved();
    } catch (err) {
      console.error("[VitaminBatchFormDrawer] save failed:", err);
      setError("Couldn't save this vitamin batch. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <h2 className="font-display text-base font-semibold text-[var(--color-foreground)]">
            {isEdit ? "Edit Vitamin Batch" : "Add Vitamin Stock"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)]"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex flex-col gap-4 px-5 py-4">
            {error && (
              <p className="rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">{error}</p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="vitamin-name" className="text-sm font-medium text-[var(--color-foreground)]">
                  Vitamin Name
                </label>
                <input
                  id="vitamin-name"
                  value={input.vitaminName}
                  onChange={(e) => setInput((prev) => ({ ...prev, vitaminName: e.target.value }))}
                  placeholder="e.g. Vitamin AD3E"
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)]"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="vitamin-category" className="text-sm font-medium text-[var(--color-foreground)]">
                  Category
                </label>
                <input
                  id="vitamin-category"
                  list="vitamin-category-suggestions"
                  value={input.category ?? ""}
                  onChange={(e) => setInput((prev) => ({ ...prev, category: e.target.value || null }))}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
                />
                <datalist id="vitamin-category-suggestions">
                  {VITAMIN_CATEGORY_SUGGESTIONS.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="vitamin-brand" className="text-sm font-medium text-[var(--color-foreground)]">
                  Brand
                </label>
                <input
                  id="vitamin-brand"
                  value={input.brand ?? ""}
                  onChange={(e) => setInput((prev) => ({ ...prev, brand: e.target.value || null }))}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="vitamin-batch-number" className="text-sm font-medium text-[var(--color-foreground)]">
                  Batch Number
                </label>
                <input
                  id="vitamin-batch-number"
                  value={input.batchNumber ?? ""}
                  onChange={(e) => setInput((prev) => ({ ...prev, batchNumber: e.target.value || null }))}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="vitamin-supplier" className="text-sm font-medium text-[var(--color-foreground)]">
                Supplier
              </label>
              <input
                id="vitamin-supplier"
                value={input.supplier ?? ""}
                onChange={(e) => setInput((prev) => ({ ...prev, supplier: e.target.value || null }))}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="vitamin-quantity" className="text-sm font-medium text-[var(--color-foreground)]">
                  Quantity Purchased
                </label>
                <input
                  id="vitamin-quantity"
                  type="number"
                  min={0}
                  disabled={isEdit}
                  value={input.quantity}
                  onChange={(e) => setInput((prev) => ({ ...prev, quantity: Number(e.target.value) }))}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)] disabled:opacity-60"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="vitamin-unit" className="text-sm font-medium text-[var(--color-foreground)]">
                  Unit
                </label>
                <input
                  id="vitamin-unit"
                  list="vitamin-unit-suggestions"
                  value={input.unit}
                  onChange={(e) => setInput((prev) => ({ ...prev, unit: e.target.value }))}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
                />
                <datalist id="vitamin-unit-suggestions">
                  {VITAMIN_UNIT_SUGGESTIONS.map((u) => (
                    <option key={u} value={u} />
                  ))}
                </datalist>
              </div>
            </div>

            {isEdit && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="vitamin-remaining" className="text-sm font-medium text-[var(--color-foreground)]">
                  Remaining Stock <span className="font-normal text-[var(--color-muted)]">(manual correction)</span>
                </label>
                <input
                  id="vitamin-remaining"
                  type="number"
                  min={0}
                  value={input.remainingStock}
                  onChange={(e) => setInput((prev) => ({ ...prev, remainingStock: Number(e.target.value) }))}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="vitamin-min-stock" className="text-sm font-medium text-[var(--color-foreground)]">
                  Minimum Stock Level
                </label>
                <input
                  id="vitamin-min-stock"
                  type="number"
                  min={0}
                  value={input.minimumStockLevel}
                  onChange={(e) => setInput((prev) => ({ ...prev, minimumStockLevel: Number(e.target.value) }))}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="vitamin-storage" className="text-sm font-medium text-[var(--color-foreground)]">
                  Storage Location
                </label>
                <input
                  id="vitamin-storage"
                  value={input.storageLocation ?? ""}
                  onChange={(e) => setInput((prev) => ({ ...prev, storageLocation: e.target.value || null }))}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="vitamin-purchase-date" className="text-sm font-medium text-[var(--color-foreground)]">
                  Purchase Date
                </label>
                <input
                  id="vitamin-purchase-date"
                  type="date"
                  value={input.purchaseDate}
                  onChange={(e) => setInput((prev) => ({ ...prev, purchaseDate: e.target.value }))}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="vitamin-expiration" className="text-sm font-medium text-[var(--color-foreground)]">
                  Expiration Date
                </label>
                <input
                  id="vitamin-expiration"
                  type="date"
                  value={input.expirationDate}
                  onChange={(e) => setInput((prev) => ({ ...prev, expirationDate: e.target.value }))}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="vitamin-remarks" className="text-sm font-medium text-[var(--color-foreground)]">
                Remarks
              </label>
              <textarea
                id="vitamin-remarks"
                value={input.remarks ?? ""}
                onChange={(e) => setInput((prev) => ({ ...prev, remarks: e.target.value || null }))}
                rows={2}
                placeholder="Optional"
                className="resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3.5 py-2 text-sm font-medium text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
            >
              {saving && <Loader2 size={14} className="spinner" />}
              {isEdit ? "Save changes" : "Add batch"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

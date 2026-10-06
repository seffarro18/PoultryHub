import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { updateFeedBatch } from "@poultryhub/shared/services/feedVitaminService";
import { getPurchase, recordFeedPurchase } from "@poultryhub/shared/services/purchaseService";
import { filterDecimalText, filterIntegerText, parseNumericText, stripLeadingZeros } from "@poultryhub/shared/lib/numericInput";
import { useToast } from "@poultryhub/shared/components/ui/ToastContext";
import PurchaseReceiptModal from "@poultryhub/shared/components/finance/PurchaseReceiptModal";
import { FEED_BRANDS, FEED_CATEGORIES, FEED_PACKAGE_SIZES, FEED_UNIT, formatFeedPackaging, type FeedBatch, type FeedBatchInput } from "@poultryhub/shared/types/feedVitamin";
import type { Purchase } from "@poultryhub/shared/types/purchase";
import { getErrorMessage } from "@poultryhub/shared/lib/errorMessage";

interface FeedBatchFormDrawerProps {
  /** null = add mode */
  batch: FeedBatch | null;
  fixedFarmId: string;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Feed Name/Batch Number/Supplier are no longer collected from the farmer —
 * Brand + Category identify the batch well enough on their own. The
 * `feeds.feed_name` column (still NOT NULL) is derived automatically
 * ("B-MEG Layer Feed") instead; batch_number/supplier are sent as null for
 * every new purchase. Editing an existing batch keeps whatever those three
 * fields already held (no UI shows them, but nothing overwrites them either
 * — `input.feedName`/`batchNumber`/`supplier` stay seeded from the record
 * untouched through to the update payload).
 */
function toInputState(batch: FeedBatch | null, fixedFarmId: string): FeedBatchInput {
  if (batch) {
    return {
      farmId: batch.farmId,
      feedName: batch.feedName,
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
    feedName: "",
    category: FEED_CATEGORIES[0],
    brand: FEED_BRANDS[0],
    batchNumber: null,
    supplier: null,
    quantity: 0,
    unit: FEED_UNIT,
    packageSize: FEED_PACKAGE_SIZES[0],
    purchaseDate: new Date().toISOString().slice(0, 10),
    expirationDate: null,
    remarks: null,
  };
}

const inputClass =
  "rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)]";

const currency = (v: number) => `₱${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function FeedBatchFormDrawer({ batch, fixedFarmId, onClose, onSaved }: FeedBatchFormDrawerProps) {
  const isEdit = batch !== null;
  const toast = useToast();
  const [input, setInput] = useState<FeedBatchInput>(() => toInputState(batch, fixedFarmId));
  const [quantityText, setQuantityText] = useState(() => (batch && batch.quantity > 0 ? String(batch.quantity) : ""));
  // Purchase-only — not stored on the feed batch itself, just used to compute
  // the Expense amount at save time (purchaseService.recordFeedPurchase).
  const [unitPriceText, setUnitPriceText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Purchase | null>(null);

  const unitPrice = parseNumericText(unitPriceText);
  const totalCost = input.quantity * unitPrice;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        await updateFeedBatch(batch.id, input);
        toast.success("Feed stock updated successfully.");
        onSaved();
      } else {
        const feedName = `${input.brand} ${input.category} Feed`.trim();
        const purchaseId = await recordFeedPurchase({
          farmId: input.farmId,
          feedName,
          category: input.category,
          brand: input.brand,
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
        toast.success("Feed stock added successfully.");
        setReceipt(await getPurchase(purchaseId));
      }
    } catch (err) {
      console.error("[FeedBatchFormDrawer] save failed:", err);
      setError(getErrorMessage(err, "Couldn't save this feed batch. Please try again."));
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
            {isEdit ? "Edit Feed Stock" : "Add Feed Stock"}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)]" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex flex-col gap-4 px-5 py-4">
            {error && <p className="rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">{error}</p>}

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="feed-brand" className="text-sm font-medium text-[var(--color-foreground)]">Feed Brand</label>
                <select
                  id="feed-brand"
                  value={input.brand ?? ""}
                  onChange={(e) => setInput((prev) => ({ ...prev, brand: e.target.value }))}
                  className={inputClass}
                >
                  {FEED_BRANDS.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="feed-category" className="text-sm font-medium text-[var(--color-foreground)]">Feed Category</label>
                <select
                  id="feed-category"
                  value={input.category ?? ""}
                  onChange={(e) => setInput((prev) => ({ ...prev, category: e.target.value }))}
                  className={inputClass}
                >
                  {FEED_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="feed-quantity" className="text-sm font-medium text-[var(--color-foreground)]">Quantity Purchased</label>
                <input
                  id="feed-quantity"
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
                    Already used: {(batch.quantity - batch.remainingStock).toLocaleString()} {batch.unit} — can't go below this.
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="feed-package-size" className="text-sm font-medium text-[var(--color-foreground)]">Sack Size</label>
                <select
                  id="feed-package-size"
                  value={input.packageSize ?? ""}
                  onChange={(e) => setInput((prev) => ({ ...prev, packageSize: e.target.value }))}
                  className={inputClass}
                >
                  {input.packageSize && !FEED_PACKAGE_SIZES.includes(input.packageSize as (typeof FEED_PACKAGE_SIZES)[number]) && (
                    <option value={input.packageSize}>{formatFeedPackaging(input.packageSize)}</option>
                  )}
                  {FEED_PACKAGE_SIZES.map((s) => (
                    <option key={s} value={s}>{formatFeedPackaging(s)}</option>
                  ))}
                </select>
              </div>
            </div>

            {!isEdit && (
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="feed-unit-price" className="text-sm font-medium text-[var(--color-foreground)]">Price Per Sack</label>
                  <input
                    id="feed-unit-price"
                    type="text"
                    inputMode="decimal"
                    placeholder="₱0.00"
                    value={unitPriceText}
                    onChange={(e) => setUnitPriceText(filterDecimalText(e.target.value))}
                    className={inputClass}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="feed-total-cost" className="text-sm font-medium text-[var(--color-foreground)]">
                    Total Cost <span className="font-normal text-[var(--color-muted)]">(auto-calculated)</span>
                  </label>
                  <div id="feed-total-cost" className={`${inputClass} bg-[var(--color-muted-bg)] text-[var(--color-foreground)]`}>
                    {currency(totalCost)}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="feed-purchase-date" className="text-sm font-medium text-[var(--color-foreground)]">Purchase Date</label>
                <input
                  id="feed-purchase-date"
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
              <label htmlFor="feed-expiration" className="text-sm font-medium text-[var(--color-foreground)]">
                Expiration Date <span className="font-normal text-[var(--color-muted)]">(optional)</span>
              </label>
              <input
                id="feed-expiration"
                type="date"
                value={input.expirationDate ?? ""}
                onChange={(e) => setInput((prev) => ({ ...prev, expirationDate: e.target.value || null }))}
                className={inputClass}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="feed-remarks" className="text-sm font-medium text-[var(--color-foreground)]">
                Remarks <span className="font-normal text-[var(--color-muted)]">(optional)</span>
              </label>
              <textarea
                id="feed-remarks"
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
              {isEdit ? "Save Changes" : "Add Feed Stock"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

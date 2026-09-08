import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { createSale, updateSale } from "@poultryhub/shared/services/salesExpensesService";
import { PAYMENT_STATUSES, SALE_CATEGORIES, type SaleInput, type SaleRecord } from "@poultryhub/shared/types/salesExpenses";

interface SaleFormDrawerProps {
  /** null = add mode */
  sale: SaleRecord | null;
  fixedFarmId: string;
  onClose: () => void;
  onSaved: () => void;
}

function toInputState(sale: SaleRecord | null, fixedFarmId: string): SaleInput {
  if (sale) {
    return {
      farmId: sale.farmId,
      saleDate: sale.saleDate,
      itemCategory: sale.itemCategory,
      description: sale.description,
      quantity: sale.quantity,
      unit: sale.unit,
      unitPrice: sale.unitPrice,
      totalAmount: sale.totalAmount,
      buyerName: sale.buyerName,
      paymentStatus: sale.paymentStatus,
      paymentMethod: sale.paymentMethod,
      remarks: sale.remarks,
    };
  }
  return {
    farmId: fixedFarmId,
    saleDate: new Date().toISOString().slice(0, 10),
    itemCategory: "Eggs",
    description: null,
    quantity: 0,
    unit: "",
    unitPrice: 0,
    totalAmount: 0,
    buyerName: null,
    paymentStatus: "paid",
    paymentMethod: null,
    remarks: null,
  };
}

const inputClass =
  "rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)]";

export default function SaleFormDrawer({ sale, fixedFarmId, onClose, onSaved }: SaleFormDrawerProps) {
  const isEdit = sale !== null;
  const [input, setInput] = useState<SaleInput>(() => toInputState(sale, fixedFarmId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Recomputes the total whenever quantity/price change — still freely editable afterward for discounts/rounding. */
  const handleQuantityOrPriceChange = (quantity: number, unitPrice: number) => {
    setInput((prev) => ({ ...prev, quantity, unitPrice, totalAmount: Math.round(quantity * unitPrice * 100) / 100 }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (input.quantity <= 0) {
      setError("Quantity must be greater than zero.");
      return;
    }
    if (!input.unit.trim()) {
      setError("Unit is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isEdit) {
        await updateSale(sale.id, input);
      } else {
        await createSale(input);
      }
      onSaved();
    } catch (err) {
      console.error("[SaleFormDrawer] save failed:", err);
      setError("Couldn't save this sale. Please try again.");
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
          <h2 className="font-display text-base font-semibold text-[var(--color-foreground)]">{isEdit ? "Edit Sale" : "Record Sale"}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)]" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex flex-col gap-4 px-5 py-4">
            {error && <p className="rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">{error}</p>}

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="sale-date" className="text-sm font-medium text-[var(--color-foreground)]">Date</label>
                <input id="sale-date" type="date" value={input.saleDate} onChange={(e) => setInput((prev) => ({ ...prev, saleDate: e.target.value }))} className={inputClass} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="sale-category" className="text-sm font-medium text-[var(--color-foreground)]">Category</label>
                <select
                  id="sale-category"
                  value={input.itemCategory}
                  onChange={(e) => setInput((prev) => ({ ...prev, itemCategory: e.target.value as SaleInput["itemCategory"] }))}
                  className={inputClass}
                >
                  {SALE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="sale-description" className="text-sm font-medium text-[var(--color-foreground)]">Description</label>
              <input
                id="sale-description"
                value={input.description ?? ""}
                onChange={(e) => setInput((prev) => ({ ...prev, description: e.target.value || null }))}
                placeholder="e.g. Dozen large eggs"
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="sale-quantity" className="text-sm font-medium text-[var(--color-foreground)]">Quantity</label>
                <input
                  id="sale-quantity"
                  type="number"
                  min={0}
                  value={input.quantity}
                  onChange={(e) => handleQuantityOrPriceChange(Number(e.target.value), input.unitPrice)}
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="sale-unit" className="text-sm font-medium text-[var(--color-foreground)]">Unit</label>
                <input
                  id="sale-unit"
                  value={input.unit}
                  onChange={(e) => setInput((prev) => ({ ...prev, unit: e.target.value }))}
                  placeholder="trays, dozens, birds…"
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="sale-unit-price" className="text-sm font-medium text-[var(--color-foreground)]">Unit Price</label>
                <input
                  id="sale-unit-price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={input.unitPrice}
                  onChange={(e) => handleQuantityOrPriceChange(input.quantity, Number(e.target.value))}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="sale-total" className="text-sm font-medium text-[var(--color-foreground)]">
                Total Amount <span className="font-normal text-[var(--color-muted)]">(auto-filled, editable for discounts)</span>
              </label>
              <input
                id="sale-total"
                type="number"
                min={0}
                step="0.01"
                value={input.totalAmount}
                onChange={(e) => setInput((prev) => ({ ...prev, totalAmount: Number(e.target.value) }))}
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="sale-buyer" className="text-sm font-medium text-[var(--color-foreground)]">Buyer Name</label>
                <input
                  id="sale-buyer"
                  value={input.buyerName ?? ""}
                  onChange={(e) => setInput((prev) => ({ ...prev, buyerName: e.target.value || null }))}
                  placeholder="Optional"
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="sale-payment-method" className="text-sm font-medium text-[var(--color-foreground)]">Payment Method</label>
                <input
                  id="sale-payment-method"
                  value={input.paymentMethod ?? ""}
                  onChange={(e) => setInput((prev) => ({ ...prev, paymentMethod: e.target.value || null }))}
                  placeholder="Cash, bank transfer…"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="sale-payment-status" className="text-sm font-medium text-[var(--color-foreground)]">Payment Status</label>
              <select
                id="sale-payment-status"
                value={input.paymentStatus}
                onChange={(e) => setInput((prev) => ({ ...prev, paymentStatus: e.target.value as SaleInput["paymentStatus"] }))}
                className={inputClass}
              >
                {PAYMENT_STATUSES.map((s) => (
                  <option key={s} value={s} className="capitalize">{s}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="sale-remarks" className="text-sm font-medium text-[var(--color-foreground)]">Remarks</label>
              <textarea
                id="sale-remarks"
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
              {isEdit ? "Save changes" : "Record sale"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

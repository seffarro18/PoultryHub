import { X } from "lucide-react";
import { summarizeSaleItems, totalEggsForSale } from "../../services/salesExpensesService";
import type { SaleRecord } from "../../types/salesExpenses";

interface SaleDetailsModalProps {
  sale: SaleRecord;
  onClose: () => void;
}

const currency = (v: number) => `₱${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Read-only — used by Farm Admin's own Sales History and both Super Admin oversight surfaces, so the item breakdown only needs to be rendered once. */
export default function SaleDetailsModal({ sale, onClose }: SaleDetailsModalProps) {
  const totalEggs = totalEggsForSale(sale);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <h2 className="font-display text-base font-semibold text-[var(--color-foreground)]">Sale Details</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)]" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Date</p>
              <p className="mt-0.5 font-medium text-[var(--color-foreground)]">{new Date(`${sale.saleDate}T00:00:00`).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Category</p>
              <p className="mt-0.5 font-medium text-[var(--color-foreground)]">{sale.itemCategory}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Payment</p>
              <p className="mt-0.5 font-medium capitalize text-[var(--color-foreground)]">{sale.paymentMethod ?? "Cash"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Buyer</p>
              <p className="mt-0.5 font-medium text-[var(--color-foreground)]">{sale.buyerName ?? "—"}</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">Items</p>
            {sale.items.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--color-foreground)]">{summarizeSaleItems(sale)}</p>
            ) : (
              <div className="mt-2 flex flex-col gap-2">
                {sale.items.map((item) => (
                  <div key={item.id} className="rounded-lg border border-[var(--color-border)] p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-[var(--color-foreground)]">{item.eggSize}</p>
                      <p className="text-sm font-semibold text-[var(--color-foreground)]">{currency(item.lineTotal)}</p>
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                      {item.quantity} {item.unitType === "full_tray" ? "Full Tray" : "Half Tray"} · {item.eggsCount.toLocaleString()} eggs
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {sale.remarks && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">Remarks</p>
              <p className="mt-1 text-sm text-[var(--color-foreground)]">{sale.remarks}</p>
            </div>
          )}

          <div className="flex flex-col gap-1.5 border-t border-[var(--color-border)] pt-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-muted)]">Total Eggs</span>
              <span className="font-medium text-[var(--color-foreground)]">{totalEggs.toLocaleString()} eggs</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[var(--color-foreground)]">Total Amount</span>
              <span className="font-semibold text-[var(--color-foreground)]">{currency(sale.totalAmount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-muted)]">Recorded By</span>
              <span className="font-medium text-[var(--color-foreground)]">{sale.recordedByName ?? "—"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

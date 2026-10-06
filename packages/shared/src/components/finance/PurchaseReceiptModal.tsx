import { Printer, X } from "lucide-react";
import type { Purchase } from "../../types/purchase";
import { formatFeedPackaging } from "../../types/feedVitamin";

interface PurchaseReceiptModalProps {
  purchase: Purchase;
  onClose: () => void;
}

const currency = (v: number) => `₱${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * A full-page print needs everything BUT this receipt hidden — the usual
 * Sales & Expenses "Print / Save as PDF" (`print:hidden` on surrounding
 * chrome) only works for a page-level layout, not a modal stacked on top of
 * one. This scoped print stylesheet hides the whole document except
 * `.purchase-receipt` instead, so clicking Print here only ever prints the
 * receipt, regardless of what page it was opened from.
 */
const PRINT_STYLES = `
  @media print {
    body * { visibility: hidden; }
    .purchase-receipt, .purchase-receipt * { visibility: visible; }
    .purchase-receipt { position: absolute; inset: 0; width: 100%; box-shadow: none; border: none; }
    .purchase-receipt-close, .purchase-receipt-print { display: none; }
  }
`;

export default function PurchaseReceiptModal({ purchase, onClose }: PurchaseReceiptModalProps) {
  const item = purchase.items[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 print:bg-transparent" onClick={onClose}>
      <style>{PRINT_STYLES}</style>
      <div
        className="purchase-receipt flex max-h-[85vh] w-full max-w-sm flex-col overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="purchase-receipt-close flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-[var(--color-foreground)]">Purchase Receipt</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)]" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="mt-3 text-center">
          <p className="font-display text-sm font-bold uppercase tracking-wide text-[var(--color-foreground)]">PoultryHub</p>
          <p className="text-xs uppercase tracking-wide text-[var(--color-muted)]">Purchase Receipt</p>
        </div>

        <div className="mt-3 border-t border-dashed border-[var(--color-border)] pt-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-[var(--color-muted)]">Purchase ID</span>
            <span className="font-medium text-[var(--color-foreground)]">{purchase.referenceNumber}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--color-muted)]">Date</span>
            <span className="font-medium text-[var(--color-foreground)]">
              {new Date(`${purchase.purchaseDate}T00:00:00`).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--color-muted)]">Farm</span>
            <span className="font-medium text-[var(--color-foreground)]">{purchase.farmName}</span>
          </div>
        </div>

        {item && (
          <div className="mt-3 border-t border-dashed border-[var(--color-border)] pt-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">Item</p>
            <p className="mt-1 font-medium text-[var(--color-foreground)]">{item.itemName}</p>
            {item.category && (
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[var(--color-muted)]">Category</span>
                <span className="text-[var(--color-foreground)]">{item.category}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-muted)]">Use</span>
              <span className="text-[var(--color-foreground)]">Layer Chicken</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-muted)]">Quantity</span>
              <span className="text-[var(--color-foreground)]">{item.quantity.toLocaleString()} {item.unit}</span>
            </div>
            {item.packageSize && (
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-muted)]">Package</span>
                <span className="text-[var(--color-foreground)]">
                  {purchase.purchaseType === "feed" ? formatFeedPackaging(item.packageSize) : item.packageSize}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-muted)]">Price</span>
              <span className="text-[var(--color-foreground)]">{currency(item.unitPrice)} / {item.unit}</span>
            </div>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between border-t border-dashed border-[var(--color-border)] pt-3 text-sm">
          <span className="font-semibold text-[var(--color-foreground)]">Total</span>
          <span className="font-semibold text-[var(--color-foreground)]">{currency(purchase.totalAmount)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-sm">
          <span className="text-[var(--color-muted)]">Payment</span>
          <span className="capitalize text-[var(--color-foreground)]">{purchase.paymentMethod}</span>
        </div>

        <div className="mt-3 border-t border-dashed border-[var(--color-border)] pt-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-[var(--color-muted)]">Inventory</span>
            <span className="font-medium text-[var(--color-success)]">+{item?.quantity.toLocaleString()} {item?.unit}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--color-muted)]">Expense</span>
            <span className="font-medium text-[var(--color-foreground)]">{currency(purchase.totalAmount)}</span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-dashed border-[var(--color-border)] pt-3 text-sm">
          <span className="text-[var(--color-muted)]">Recorded By</span>
          <span className="font-medium text-[var(--color-foreground)]">{purchase.recordedByName ?? "—"}</span>
        </div>

        <p className="mt-4 text-center text-xs text-[var(--color-muted)]">Thank you!</p>

        <button
          type="button"
          onClick={() => window.print()}
          className="purchase-receipt-print mt-4 flex items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white"
        >
          <Printer size={14} /> Print / Save as PDF
        </button>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import ErrorState from "../ui/ErrorState";
import { getEggStockBySize, type EggStockBySize } from "../../services/eggPricingService";
import { splitEggCount } from "../../types/eggPricing";
import { getErrorMessage } from "../../lib/errorMessage";
import { useEscapeKey } from "../../hooks/useEscapeKey";

interface RemainingEggsModalProps {
  farmId: string;
  onClose: () => void;
}

/**
 * Remaining Eggs by size — the same per-size stock Record Sale validates
 * against (get_egg_stock_by_size, migration 0046). Quantities only, no
 * prices, so it's safe for Staff too. Pieces are the real balance; the tray
 * columns are just a display split of that count.
 */
export default function RemainingEggsModal({ farmId, onClose }: RemainingEggsModalProps) {
  useEscapeKey(onClose);
  const [stock, setStock] = useState<EggStockBySize | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStock(await getEggStockBySize(farmId));
    } catch (err) {
      console.error("[RemainingEggsModal] failed to load stock by size:", err);
      setStock(null);
      setError(getErrorMessage(err, "Couldn't load remaining eggs by size."));
    } finally {
      setLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="remaining-eggs-title"
        className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <div>
            <h2 id="remaining-eggs-title" className="font-display text-base font-semibold text-[var(--color-foreground)]">
              Remaining Egg Inventory
            </h2>
            <p className="text-xs text-[var(--color-muted)]">Sellable eggs by size · 1 full tray = 30 · 1 half tray = 15</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)]" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-14 text-sm text-[var(--color-muted)]">
              <Loader2 size={16} className="spinner" /> Loading…
            </div>
          ) : error || !stock ? (
            <ErrorState message={error ?? "Couldn't load remaining eggs by size."} onRetry={() => void load()} />
          ) : (
            <div className="overflow-x-auto px-2 py-2">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-muted)]">
                    <th className="px-3 py-2 font-medium">Egg Size</th>
                    <th className="px-3 py-2 text-right font-medium">Available Pieces</th>
                    <th className="px-3 py-2 text-right font-medium">Full Trays</th>
                    <th className="px-3 py-2 text-right font-medium">Half Trays</th>
                    <th className="px-3 py-2 text-right font-medium">Loose Pieces</th>
                  </tr>
                </thead>
                <tbody>
                  {stock.sizes.map((s) => {
                    const split = splitEggCount(s.available);
                    return (
                      <tr key={s.eggSize} className="border-b border-[var(--color-border)]">
                        <td className="px-3 py-2 font-medium text-[var(--color-foreground)]">{s.eggSize}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-[var(--color-foreground)]">{s.available.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-[var(--color-muted)]">{split.fullTrays}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-[var(--color-muted)]">{split.halfTrays}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-[var(--color-muted)]">{split.loose}</td>
                      </tr>
                    );
                  })}
                  {stock.unclassified !== 0 && (
                    <tr className="border-b border-[var(--color-border)]">
                      <td className="px-3 py-2 text-[var(--color-foreground)]">
                        Unclassified
                        <span className="block text-[11px] text-[var(--color-muted)]">Older records without a size — not sellable by size</span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-[var(--color-foreground)]">{stock.unclassified.toLocaleString()}</td>
                      <td colSpan={3} className="px-3 py-2 text-right text-[var(--color-muted)]">—</td>
                    </tr>
                  )}
                  {stock.unattributedSales !== 0 && (
                    <tr className="border-b border-[var(--color-border)]">
                      <td className="px-3 py-2 text-[var(--color-foreground)]">
                        Older sales without a size
                        <span className="block text-[11px] text-[var(--color-muted)]">Sold before per-size sales existed</span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-[var(--color-foreground)]">{stock.unattributedSales.toLocaleString()}</td>
                      <td colSpan={3} className="px-3 py-2 text-right text-[var(--color-muted)]">—</td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="font-semibold text-[var(--color-foreground)]">
                    <td className="px-3 py-2">Total</td>
                    <td className="px-3 py-2 text-right tabular-nums">{stock.total.toLocaleString()}</td>
                    <td colSpan={3} className="px-3 py-2 text-right text-[var(--color-muted)]">—</td>
                  </tr>
                </tfoot>
              </table>
              <p className="px-3 pb-2 pt-1 text-[11px] text-[var(--color-muted)]">
                Approved good eggs of each size minus eggs of that size sold. Pending/rejected collections and cracked/damaged eggs are never counted.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { listSales, saveEggSale } from "@poultryhub/shared/services/salesExpensesService";
import { computeRemainingEggStockBySize, listEggProductionRecords } from "@poultryhub/shared/services/eggProductionService";
import { listEggPrices } from "@poultryhub/shared/services/eggPricingService";
import { filterIntegerText, parseNumericText } from "@poultryhub/shared/lib/numericInput";
import { EGG_TRAY_SIZES, type EggSaleItemInput, type EggTrayUnit, type SaleRecord } from "@poultryhub/shared/types/salesExpenses";
import { EGG_SIZES, type EggPrice, type EggSize } from "@poultryhub/shared/types/eggPricing";

interface SaleFormDrawerProps {
  /** null = add mode */
  sale: SaleRecord | null;
  fixedFarmId: string;
  onClose: () => void;
  onSaved: () => void;
}

interface ItemRow {
  id: string;
  eggSize: EggSize;
  unitType: EggTrayUnit;
  quantity: number;
  quantityText: string;
}

let rowSeq = 0;
const nextRowId = () => `row-${++rowSeq}`;

function defaultRow(): ItemRow {
  return { id: nextRowId(), eggSize: EGG_SIZES[0], unitType: "Full Tray", quantity: 1, quantityText: "1" };
}

/** Seeds rows from the sale being edited — from its sale_items if it has any (the normal case), or a single row from its legacy flat fields as a starting point if it predates the multi-item Sales feature. */
function initialRows(sale: SaleRecord | null): ItemRow[] {
  if (!sale) return [defaultRow()];
  if (sale.items.length > 0) {
    return sale.items.map((item) => ({
      id: nextRowId(),
      eggSize: item.eggSize,
      unitType: item.unitType === "half_tray" ? "Half Tray" : "Full Tray",
      quantity: item.quantity,
      quantityText: String(item.quantity),
    }));
  }
  if (sale.eggSize && (sale.unit === "Full Tray" || sale.unit === "Half Tray") && sale.quantity) {
    return [
      {
        id: nextRowId(),
        eggSize: sale.eggSize as EggSize,
        unitType: sale.unit,
        quantity: sale.quantity,
        quantityText: String(sale.quantity),
      },
    ];
  }
  return [defaultRow()];
}

const inputClass =
  "rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)]";

const eggsForRow = (row: Pick<ItemRow, "unitType" | "quantity">) => row.quantity * EGG_TRAY_SIZES[row.unitType];

const currency = (v: number) => `₱${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function SaleFormDrawer({ sale, fixedFarmId, onClose, onSaved }: SaleFormDrawerProps) {
  const isEdit = sale !== null;
  const [saleDate, setSaleDate] = useState(sale?.saleDate ?? new Date().toISOString().slice(0, 10));
  const [buyerName, setBuyerName] = useState(sale?.buyerName ?? "");
  const [remarks, setRemarks] = useState(sale?.remarks ?? "");
  const [rows, setRows] = useState<ItemRow[]>(() => initialRows(sale));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stock-by-size and current Egg Prices, fetched once on open. availableBySize
  // is null while loading, so validation can't fire on a not-yet-fetched value.
  const [availableBySize, setAvailableBySize] = useState<Record<EggSize, number> | null>(null);
  const [eggPrices, setEggPrices] = useState<EggPrice[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listEggProductionRecords(), listSales()])
      .then(([records, sales]) => {
        if (cancelled) return;
        const bySize = computeRemainingEggStockBySize(records, sales);
        // Editing: the sale's own current items are already subtracted out of
        // bySize (they're part of `sales`) — add them back so editing a sale
        // down doesn't look like it's short on its own already-claimed stock.
        if (isEdit && sale.items.length > 0) {
          for (const item of sale.items) bySize[item.eggSize] += item.eggsCount;
        }
        setAvailableBySize(bySize);
      })
      .catch((err) => console.error("[SaleFormDrawer] failed to load egg stock:", err));
    listEggPrices()
      .then((prices) => {
        if (!cancelled) setEggPrices(prices);
      })
      .catch((err) => console.error("[SaleFormDrawer] failed to load egg prices:", err));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const priceFor = (eggSize: EggSize, unitType: EggTrayUnit): number => {
    const price = eggPrices.find((p) => p.eggSize === eggSize);
    if (!price) return 0;
    return unitType === "Half Tray" ? price.halfTrayPrice : price.fullTrayPrice;
  };

  /** How many eggs of this size are left for THIS row, after every other row's own claim on the same size is set aside — not just raw DB stock. */
  const availableForRow = (row: ItemRow): number | null => {
    if (availableBySize === null) return null;
    const claimedByOthers = rows.filter((r) => r.id !== row.id && r.eggSize === row.eggSize).reduce((sum, r) => sum + eggsForRow(r), 0);
    return Math.max(availableBySize[row.eggSize] - claimedByOthers, 0);
  };

  const totalEggs = useMemo(() => rows.reduce((sum, r) => sum + eggsForRow(r), 0), [rows]);
  const totalAmount = useMemo(() => rows.reduce((sum, r) => sum + r.quantity * priceFor(r.eggSize, r.unitType), 0), [rows, eggPrices]);

  /** Merges a row's new (eggSize, unitType) into an existing matching row instead of allowing two rows for the same combination — section 14's "automatically combine matching egg size + unit rows". */
  const mergeIfDuplicate = (changedRowId: string, next: ItemRow[]): ItemRow[] => {
    const changed = next.find((r) => r.id === changedRowId);
    if (!changed) return next;
    const duplicate = next.find((r) => r.id !== changedRowId && r.eggSize === changed.eggSize && r.unitType === changed.unitType);
    if (!duplicate) return next;
    const mergedQuantity = duplicate.quantity + changed.quantity;
    return next
      .filter((r) => r.id !== changedRowId)
      .map((r) => (r.id === duplicate.id ? { ...r, quantity: mergedQuantity, quantityText: String(mergedQuantity) } : r));
  };

  const updateRow = (id: string, changes: Partial<ItemRow>) => {
    setRows((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, ...changes } : r));
      return mergeIfDuplicate(id, next);
    });
  };

  const handleAddItem = () => setRows((prev) => [...prev, defaultRow()]);

  const handleRemoveItem = (id: string) => setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    for (const row of rows) {
      if (row.quantity <= 0) {
        setError("Every egg item needs a quantity greater than zero.");
        return;
      }
      const available = availableForRow(row);
      if (available !== null && eggsForRow(row) > available) {
        setError(`Insufficient ${row.eggSize} egg stock. Available: ${available}, Required: ${eggsForRow(row)}.`);
        return;
      }
    }
    setSaving(true);
    setError(null);
    try {
      const items: EggSaleItemInput[] = rows.map((r) => ({ eggSize: r.eggSize, unitType: r.unitType, quantity: r.quantity }));
      await saveEggSale(
        {
          farmId: fixedFarmId,
          saleDate,
          buyerName: buyerName || null,
          paymentStatus: sale?.paymentStatus ?? "paid",
          remarks: remarks || null,
          items,
        },
        sale?.id
      );
      onSaved();
    } catch (err) {
      console.error("[SaleFormDrawer] save failed:", err);
      setError(err instanceof Error ? err.message : "Couldn't save this sale. Please try again.");
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

            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="sale-date" className="text-sm font-medium text-[var(--color-foreground)]">Date</label>
                <input id="sale-date" type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} className={inputClass} />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-[var(--color-foreground)]">Category</span>
                <div className={`${inputClass} bg-[var(--color-muted-bg)] text-[var(--color-muted)]`}>Eggs</div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-[var(--color-foreground)]">Payment Method</span>
                <div className={`${inputClass} bg-[var(--color-muted-bg)] text-[var(--color-muted)]`}>Cash</div>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-[var(--color-foreground)]">Egg Items</p>
              <div className="mt-2 flex flex-col gap-3">
                {rows.map((row) => {
                  const available = availableForRow(row);
                  const price = priceFor(row.eggSize, row.unitType);
                  const insufficient = available !== null && eggsForRow(row) > available;
                  return (
                    <div key={row.id} className="rounded-xl border border-[var(--color-border)] p-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-medium text-[var(--color-muted)]">Egg Size</label>
                          <select
                            value={row.eggSize}
                            onChange={(e) => updateRow(row.id, { eggSize: e.target.value as EggSize })}
                            className={inputClass}
                          >
                            {EGG_SIZES.map((size) => (
                              <option key={size} value={size}>{size}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-medium text-[var(--color-muted)]">Unit</label>
                          <select
                            value={row.unitType}
                            onChange={(e) => updateRow(row.id, { unitType: e.target.value as EggTrayUnit })}
                            className={inputClass}
                          >
                            {Object.keys(EGG_TRAY_SIZES).map((u) => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-medium text-[var(--color-muted)]">Quantity</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={row.quantityText}
                            onChange={(e) => {
                              const filtered = filterIntegerText(e.target.value);
                              updateRow(row.id, { quantityText: filtered, quantity: parseNumericText(filtered) });
                            }}
                            className={inputClass}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-medium text-[var(--color-muted)]">Price</label>
                          <div className={`${inputClass} bg-[var(--color-muted-bg)] text-[var(--color-foreground)]`}>{currency(price)}</div>
                        </div>
                      </div>

                      <div className="mt-2 flex items-center justify-between">
                        <p className={`text-xs ${insufficient ? "text-[var(--color-danger)]" : "text-[var(--color-muted)]"}`}>
                          Available: {available === null ? "Loading…" : `${available.toLocaleString()} eggs`}
                        </p>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(row.id)}
                          disabled={rows.length === 1}
                          className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)] disabled:opacity-30"
                          aria-label="Remove item"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={handleAddItem}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--color-border)] py-2 text-sm font-medium text-[var(--color-primary)] hover:bg-[var(--color-muted-bg)]"
              >
                <Plus size={15} /> Add Egg Item
              </button>
            </div>

            <div className="flex flex-col gap-1.5 rounded-lg bg-[var(--color-muted-bg)] px-3 py-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-muted)]">Total Eggs</span>
                <span className="font-semibold text-[var(--color-foreground)]">{totalEggs.toLocaleString()} eggs</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-muted)]">Total Amount</span>
                <span className="font-semibold text-[var(--color-foreground)]">{currency(totalAmount)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="sale-buyer" className="text-sm font-medium text-[var(--color-foreground)]">Buyer Name</label>
              <input
                id="sale-buyer"
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                placeholder="Optional"
                className={inputClass}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="sale-remarks" className="text-sm font-medium text-[var(--color-foreground)]">Remarks</label>
              <textarea
                id="sale-remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
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
              {isEdit ? "Save changes" : "Record Sale"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

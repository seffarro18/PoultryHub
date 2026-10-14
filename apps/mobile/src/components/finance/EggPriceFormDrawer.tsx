import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { updateEggPrice } from "@poultryhub/shared/services/eggPricingService";
import { filterDecimalText } from "@poultryhub/shared/lib/numericInput";
import { getErrorMessage } from "@poultryhub/shared/lib/errorMessage";
import { EGG_SIZES, type EggPrice, type EggSize } from "@poultryhub/shared/types/eggPricing";

interface EggPriceFormDrawerProps {
  farmId: string;
  prices: EggPrice[];
  onClose: () => void;
  onSaved: () => void;
}

type Field = "full" | "half" | "piece";

const inputClass =
  "w-full rounded-lg border bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)]";

const FIELD_LABEL: Record<Field, string> = { full: "Full Tray", half: "Half Tray", piece: "Per Piece" };

/** Two-decimal currency text, or "" when the value isn't set. */
const toText = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(Number(v)));

/** A valid peso amount: digits with at most two decimals. */
const isValidAmount = (text: string) => /^\d+(\.\d{1,2})?$/.test(text.trim());

/**
 * One drawer edits all 6 sizes at once. Full Tray and Half Tray are
 * required; Per Piece is optional — left empty, it stays "not configured"
 * and Piece sales are disabled for that size (never derived from the tray
 * prices, never saved as ₱0).
 */
export default function EggPriceFormDrawer({ farmId, prices, onClose, onSaved }: EggPriceFormDrawerProps) {
  const [values, setValues] = useState<Record<EggSize, Record<Field, string>>>(
    () =>
      Object.fromEntries(
        EGG_SIZES.map((size) => {
          const p = prices.find((x) => x.eggSize === size);
          return [size, { full: toText(p?.fullTrayPrice), half: toText(p?.halfTrayPrice), piece: toText(p?.piecePrice) }];
        })
      ) as Record<EggSize, Record<Field, string>>
  );
  const [invalid, setInvalid] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setValue = (size: EggSize, field: Field, text: string) => {
    setValues((prev) => ({ ...prev, [size]: { ...prev[size], [field]: filterDecimalText(text) } }));
    setInvalid((prev) => {
      const next = new Set(prev);
      next.delete(`${size}-${field}`);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const bad = new Set<string>();
    // Every price is optional: empty = "Not set", and that unit simply can't
    // be sold for that size until it's configured (never saved as ₱0).
    const parsed = (text: string) => (text.trim() === "" ? null : Number(text));
    for (const size of EGG_SIZES) {
      const v = values[size];
      for (const field of ["full", "half", "piece"] as Field[]) {
        if (v[field].trim() !== "" && !isValidAmount(v[field])) bad.add(`${size}-${field}`);
      }
    }
    if (bad.size > 0) {
      setInvalid(bad);
      setError("Enter valid prices (₱, up to 2 decimals), or leave a price empty to keep that unit disabled.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Only sizes that actually changed are written, so price history logs
      // real changes only (the database trigger logs per changed price).
      const changed = EGG_SIZES.filter((size) => {
        const p = prices.find((x) => x.eggSize === size);
        const v = values[size];
        if (!p) return v.full.trim() !== "" || v.half.trim() !== "" || v.piece.trim() !== "";
        return parsed(v.full) !== p.fullTrayPrice || parsed(v.half) !== p.halfTrayPrice || parsed(v.piece) !== p.piecePrice;
      });
      for (const size of changed) {
        const v = values[size];
        await updateEggPrice(farmId, size, parsed(v.full), parsed(v.half), parsed(v.piece));
      }
      onSaved();
    } catch (err) {
      console.error("[EggPriceFormDrawer] save failed:", err);
      setError(getErrorMessage(err, "Couldn't save egg prices. Please try again."));
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
          <h2 className="font-display text-base font-semibold text-[var(--color-foreground)]">Edit Egg Prices</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)]" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex flex-col gap-4 px-5 py-4">
            {error && <p className="rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">{error}</p>}
            <p className="text-xs text-[var(--color-muted)]">
              New prices apply to future sales only — recorded sales keep the price they were sold at. Leave a price empty ("Not set") to keep that unit disabled for that size.
            </p>

            {EGG_SIZES.map((size) => (
              <div key={size} className="rounded-xl border border-[var(--color-border)] p-3">
                <p className="text-sm font-semibold text-[var(--color-foreground)]">{size}</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(["full", "half", "piece"] as Field[]).map((field) => {
                    const id = `ep-${field}-${size}`;
                    const isInvalid = invalid.has(`${size}-${field}`);
                    return (
                      <div key={field} className="flex min-w-0 flex-col gap-1.5">
                        <label htmlFor={id} className="text-xs font-medium text-[var(--color-muted)]">
                          {FIELD_LABEL[field]}
                        </label>
                        <input
                          id={id}
                          type="text"
                          inputMode="decimal"
                          placeholder="Not set"
                          value={values[size][field]}
                          onChange={(e) => setValue(size, field, e.target.value)}
                          aria-invalid={isInvalid}
                          className={`${inputClass} ${isInvalid ? "border-[var(--color-danger)]" : "border-[var(--color-border)]"}`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] px-5 py-4">
            <button type="button" onClick={onClose} className="rounded-lg px-3.5 py-2 text-sm font-medium text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)]">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-70">
              {saving && <Loader2 size={14} className="spinner" />}
              Save changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

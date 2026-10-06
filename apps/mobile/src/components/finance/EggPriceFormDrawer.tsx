import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { updateEggPrice } from "@poultryhub/shared/services/eggPricingService";
import { filterDecimalText, parseNumericText } from "@poultryhub/shared/lib/numericInput";
import { EGG_SIZES, type EggPrice } from "@poultryhub/shared/types/eggPricing";

interface EggPriceFormDrawerProps {
  farmId: string;
  prices: EggPrice[];
  onClose: () => void;
  onSaved: () => void;
}

const inputClass =
  "rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)]";

/** One drawer edits all 6 sizes at once — matches the mobile mockup's single "Edit Prices" action rather than per-row edit buttons. */
export default function EggPriceFormDrawer({ farmId, prices, onClose, onSaved }: EggPriceFormDrawerProps) {
  const [fullTrayText, setFullTrayText] = useState<Record<string, string>>(() =>
    Object.fromEntries(EGG_SIZES.map((size) => [size, String(prices.find((p) => p.eggSize === size)?.fullTrayPrice ?? 0)]))
  );
  const [halfTrayText, setHalfTrayText] = useState<Record<string, string>>(() =>
    Object.fromEntries(EGG_SIZES.map((size) => [size, String(prices.find((p) => p.eggSize === size)?.halfTrayPrice ?? 0)]))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    for (const size of EGG_SIZES) {
      if (parseNumericText(fullTrayText[size]) < 0 || parseNumericText(halfTrayText[size]) < 0) {
        setError("Prices cannot be negative.");
        return;
      }
    }
    setSaving(true);
    setError(null);
    try {
      await Promise.all(
        EGG_SIZES.map((size) => updateEggPrice(farmId, size, parseNumericText(fullTrayText[size]), parseNumericText(halfTrayText[size])))
      );
      onSaved();
    } catch (err) {
      console.error("[EggPriceFormDrawer] save failed:", err);
      setError("Couldn't save egg prices. Please try again.");
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

            {EGG_SIZES.map((size) => (
              <div key={size} className="rounded-xl border border-[var(--color-border)] p-3">
                <p className="text-sm font-semibold text-[var(--color-foreground)]">{size}</p>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor={`ep-full-${size}`} className="text-xs font-medium text-[var(--color-muted)]">
                      Full Tray Price
                    </label>
                    <input
                      id={`ep-full-${size}`}
                      type="text"
                      inputMode="decimal"
                      value={fullTrayText[size]}
                      onChange={(e) => setFullTrayText((prev) => ({ ...prev, [size]: filterDecimalText(e.target.value) }))}
                      className={inputClass}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor={`ep-half-${size}`} className="text-xs font-medium text-[var(--color-muted)]">
                      Half Tray Price
                    </label>
                    <input
                      id={`ep-half-${size}`}
                      type="text"
                      inputMode="decimal"
                      value={halfTrayText[size]}
                      onChange={(e) => setHalfTrayText((prev) => ({ ...prev, [size]: filterDecimalText(e.target.value) }))}
                      className={inputClass}
                    />
                  </div>
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

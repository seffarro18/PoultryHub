import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { updateProductionSettings } from "@poultryhub/shared/services/eggPricingService";
import { filterIntegerText, parseNumericText } from "@poultryhub/shared/lib/numericInput";

interface ProductionSettingsFormDrawerProps {
  farmId: string;
  currentRate: number;
  onClose: () => void;
  onSaved: () => void;
}

const inputClass =
  "rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)]";

export default function ProductionSettingsFormDrawer({ farmId, currentRate, onClose, onSaved }: ProductionSettingsFormDrawerProps) {
  const [rateText, setRateText] = useState(String(currentRate));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rate = parseNumericText(rateText);
    if (rate < 0 || rate > 100) {
      setError("Production rate must be between 0% and 100%.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateProductionSettings(farmId, rate);
      onSaved();
    } catch (err) {
      console.error("[ProductionSettingsFormDrawer] save failed:", err);
      setError("Couldn't save the production rate. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="flex w-full max-w-sm flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <h2 className="font-display text-base font-semibold text-[var(--color-foreground)]">Edit Production Rate</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)]" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="flex flex-col gap-4 px-5 py-4">
            {error && <p className="rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">{error}</p>}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="ps-rate" className="text-sm font-medium text-[var(--color-foreground)]">
                Expected Production Rate (%)
              </label>
              <input
                id="ps-rate"
                type="text"
                inputMode="numeric"
                value={rateText}
                onChange={(e) => setRateText(filterIntegerText(e.target.value))}
                className={inputClass}
              />
              <p className="text-xs text-[var(--color-muted)]">
                Used only to estimate expected daily egg production. Actual production may vary depending on farm conditions.
              </p>
            </div>
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

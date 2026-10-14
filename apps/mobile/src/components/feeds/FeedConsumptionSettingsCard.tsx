import { useEffect, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { getProductionSettings, updateFeedConsumptionUnit } from "@poultryhub/shared/services/eggPricingService";
import { useToast } from "@poultryhub/shared/components/ui/ToastContext";
import { getErrorMessage } from "@poultryhub/shared/lib/errorMessage";
import type { FeedConsumptionUnit } from "@poultryhub/shared/types/feedVitamin";
import { announceFeedConsumptionUnit } from "@poultryhub/shared/hooks/useFeedConsumptionUnit";

const OPTIONS: { value: FeedConsumptionUnit; label: string; hint: string }[] = [
  { value: "sack", label: "Sack", hint: "Staff record sacks used, including half sacks (0.5)." },
  { value: "kg", label: "Kilogram (kg)", hint: "Staff record kilograms used; converted with each feed's own sack size." },
];

/**
 * Farm Admin/Manager: how the farm records feed consumption
 * (production_settings.feed_consumption_unit, migration 0052). Stock is always
 * kept in sacks, so switching only changes how future entries are typed and
 * how stock is shown — no inventory or history changes.
 */
export default function FeedConsumptionSettingsCard({ farmId, onUnitChange }: { farmId: string; onUnitChange?: (unit: FeedConsumptionUnit) => void }) {
  const toast = useToast();
  const [unit, setUnit] = useState<FeedConsumptionUnit | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState<FeedConsumptionUnit | null>(null);
  const [loadKey, setLoadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    getProductionSettings()
      .then((s) => {
        if (cancelled) return;
        const loaded = s?.feedConsumptionUnit ?? "sack";
        setUnit(loaded);
        onUnitChange?.(loaded);
      })
      .catch((err) => {
        console.error("[FeedConsumptionSettingsCard] load failed:", err);
        if (!cancelled) setLoadError(getErrorMessage(err, "Couldn't load the feed consumption setting."));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onUnitChange is a parent callback; reload only on retry
  }, [loadKey]);

  const choose = async (next: FeedConsumptionUnit) => {
    if (next === unit || saving) return;
    setSaving(next);
    try {
      await updateFeedConsumptionUnit(farmId, next);
      setUnit(next);
      onUnitChange?.(next);
      announceFeedConsumptionUnit(next);
      toast.success(next === "kg" ? "Feed consumption will now be recorded in kilograms." : "Feed consumption will now be recorded in sacks.");
    } catch (err) {
      console.error("[FeedConsumptionSettingsCard] save failed:", err);
      toast.error(getErrorMessage(err, "Couldn't save the feed consumption setting."));
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <h2 className="font-display text-sm font-semibold text-[var(--color-foreground)]">Feed Consumption Settings</h2>
      <p className="mt-0.5 text-xs text-[var(--color-muted)]">Choose how your farm records daily feed consumption.</p>
      {loadError ? (
        <div className="mt-3 flex items-center justify-between gap-2 text-sm text-[var(--color-danger)]">
          {loadError}
          <button type="button" onClick={() => setLoadKey((k) => k + 1)} className="flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)]">
            <RotateCcw size={12} /> Retry
          </button>
        </div>
      ) : unit === null ? (
        <div className="mt-3 flex items-center gap-2 text-sm text-[var(--color-muted)]">
          <Loader2 size={14} className="spinner" /> Loading…
        </div>
      ) : (
        <>
          <p className="mt-3 text-xs font-medium text-[var(--color-foreground)]">Feed Consumption Unit</p>
          <div role="radiogroup" aria-label="Feed Consumption Unit" className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={unit === o.value}
                onClick={() => void choose(o.value)}
                disabled={saving !== null}
                className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left disabled:opacity-70 ${
                  unit === o.value ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5" : "border-[var(--color-border)]"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                    unit === o.value ? "border-[var(--color-primary)]" : "border-[var(--color-muted)]"
                  }`}
                >
                  {saving === o.value ? (
                    <Loader2 size={10} className="spinner" />
                  ) : unit === o.value ? (
                    <span className="h-2 w-2 rounded-full bg-[var(--color-primary)]" />
                  ) : null}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-[var(--color-foreground)]">{o.label}</span>
                  <span className="block text-xs text-[var(--color-muted)]">{o.hint}</span>
                </span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-[var(--color-muted)]">
            Stock is always kept per sack, so switching never changes your inventory or past records — only how new entries are typed and how stock is shown.
          </p>
        </>
      )}
    </div>
  );
}

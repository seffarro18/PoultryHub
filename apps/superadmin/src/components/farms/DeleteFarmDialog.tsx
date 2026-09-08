import { useEffect, useState } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import { getFarmDeleteImpact } from "@poultryhub/shared/services/farmService";
import type { FarmDeleteImpact, ManagedFarm } from "@poultryhub/shared/types/farm";

interface DeleteFarmDialogProps {
  farm: ManagedFarm;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function DeleteFarmDialog({ farm, onCancel, onConfirm }: DeleteFarmDialogProps) {
  const [impact, setImpact] = useState<FarmDeleteImpact | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    let cancelled = false;
    getFarmDeleteImpact(farm.id)
      .then((result) => {
        if (!cancelled) setImpact(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Couldn't check what's linked to this farm.");
      });
    return () => {
      cancelled = true;
    };
  }, [farm.id]);

  const nameMatches = confirmText.trim() === farm.name;
  const hasHistory = impact ? impact.productionRecords > 0 || impact.inventoryEvents > 0 || impact.staffCount > 0 : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-danger)]/10 text-[var(--color-danger)]">
            <TriangleAlert size={18} strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-base font-semibold text-[var(--color-foreground)]">Delete Farm</h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              This will permanently delete <span className="font-medium text-[var(--color-foreground)]">{farm.name}</span>
              {impact === null && !loadError ? "…" : "."}
            </p>
          </div>
        </div>

        <div className="mt-3">
          {loadError ? (
            <p className="text-sm text-[var(--color-danger)]">{loadError}</p>
          ) : impact === null ? (
            <div className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
              <Loader2 size={14} className="spinner" /> Checking what's linked to this farm…
            </div>
          ) : hasHistory ? (
            <ul className="flex flex-col gap-1 rounded-lg bg-[var(--color-danger)]/5 px-3 py-2.5 text-sm text-[var(--color-foreground)]">
              {impact.productionRecords > 0 && <li>• {impact.productionRecords.toLocaleString()} egg production records</li>}
              {impact.inventoryEvents > 0 && <li>• {impact.inventoryEvents.toLocaleString()} inventory events</li>}
              {impact.staffCount > 0 && <li>• Unassign {impact.staffCount.toLocaleString()} staff account(s)</li>}
            </ul>
          ) : (
            <p className="text-sm text-[var(--color-muted)]">This farm has no production, inventory, or staff records.</p>
          )}
        </div>

        <p className="mt-3 text-sm text-[var(--color-muted)]">This cannot be undone.</p>

        <div className="mt-3 flex flex-col gap-1.5">
          <label htmlFor="confirm-farm-name" className="text-sm font-medium text-[var(--color-foreground)]">
            Type <span className="font-semibold">{farm.name}</span> to confirm
          </label>
          <input
            id="confirm-farm-name"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoComplete="off"
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-danger)]"
          />
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3.5 py-2 text-sm font-medium text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!nameMatches || impact === null}
            className="rounded-lg bg-[var(--color-danger)] px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            Delete Farm
          </button>
        </div>
      </div>
    </div>
  );
}

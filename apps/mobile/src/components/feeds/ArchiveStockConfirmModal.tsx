import { Loader2, ShieldAlert, X } from "lucide-react";

interface ArchiveStockConfirmModalProps {
  title: string;
  itemLabel: string;
  quantityLabel: string;
  /** Shown when the batch has already been partly distributed/used — matches this feature's own "will be archived, not permanently deleted" warning. */
  hasUsage: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Shared by Feed and Vitamin "Delete" — the action is always a soft
 * archive (never a hard delete, see archive_feed_batch/archive_vitamin_batch
 * RPCs), so this confirms that plainly rather than just asking "are you
 * sure?" the way a destructive-delete dialog normally would.
 */
export default function ArchiveStockConfirmModal({
  title,
  itemLabel,
  quantityLabel,
  hasUsage,
  busy,
  onCancel,
  onConfirm,
}: ArchiveStockConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onCancel}>
      <div
        className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-danger)]/10 text-[var(--color-danger)]">
              <ShieldAlert size={18} />
            </span>
            <h2 className="font-display text-base font-semibold text-[var(--color-foreground)]">{title}</h2>
          </div>
          <button type="button" onClick={onCancel} className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)]" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-[var(--color-muted)]">
          This stock record will be removed from active inventory but preserved in history.
        </p>

        <div className="rounded-lg bg-[var(--color-muted-bg)] px-3 py-2.5 text-sm">
          <p className="font-medium text-[var(--color-foreground)]">{itemLabel}</p>
          <p className="text-[var(--color-muted)]">{quantityLabel}</p>
        </div>

        {hasUsage && (
          <p className="rounded-lg bg-[var(--color-warning)]/10 px-3 py-2 text-xs text-[var(--color-warning)]">
            This stock has already been used in distribution records. It will be archived rather than permanently deleted — historical records will remain unchanged.
          </p>
        )}

        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-lg px-3.5 py-2 text-sm font-medium text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)]">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="flex items-center gap-2 rounded-lg bg-[var(--color-danger)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
          >
            {busy && <Loader2 size={14} className="spinner" />}
            Delete Stock
          </button>
        </div>
      </div>
    </div>
  );
}

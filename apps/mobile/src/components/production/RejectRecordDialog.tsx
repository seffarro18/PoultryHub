import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Button from "@poultryhub/shared/components/ui/Button";

interface RejectRecordDialogProps {
  onCancel: () => void;
  onConfirm: (reason: string) => void;
  confirming?: boolean;
}

/**
 * Same overlay/card shell as ConfirmDialog, plus a required reason field —
 * replaces window.prompt() for rejecting a record. A native browser prompt
 * can't be styled, doesn't match the rest of the app, and gives no way to
 * validate the input before it's submitted.
 */
export default function RejectRecordDialog({ onCancel, onConfirm, confirming = false }: RejectRecordDialogProps) {
  const [reason, setReason] = useState("");
  const trimmed = reason.trim();
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0.01 : 0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, scale: reducedMotion ? 1 : 0.96, y: reducedMotion ? 0 : 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0.01 : 0.25, ease: [0.22, 1, 0.36, 1] }}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="reject-dialog-title"
        className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="reject-dialog-title" className="font-display text-base font-semibold text-[var(--color-foreground)]">
          Reject this record?
        </h2>
        <p className="mt-1.5 text-sm text-[var(--color-muted)]">
          Explain why — this is shown to the staff member who recorded it.
        </p>

        <label htmlFor="reject-reason" className="sr-only">
          Reason for rejecting
        </label>
        <textarea
          id="reject-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          autoFocus
          placeholder="e.g. Collected count doesn't match the house tally"
          className="mt-3 w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
        />

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            loading={confirming}
            loadingText="Rejecting…"
            disabled={!trimmed}
            onClick={() => onConfirm(trimmed)}
            className="!bg-[var(--color-danger)] !text-white hover:!brightness-95"
          >
            Reject
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

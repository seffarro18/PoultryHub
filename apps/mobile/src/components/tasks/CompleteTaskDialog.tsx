import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Button from "@poultryhub/shared/components/ui/Button";
import { useEscapeKey } from "@poultryhub/shared/hooks/useEscapeKey";

interface CompleteTaskDialogProps {
  onCancel: () => void;
  onConfirm: (comment: string) => void;
  confirming?: boolean;
}

export default function CompleteTaskDialog({ onCancel, onConfirm, confirming = false }: CompleteTaskDialogProps) {
  const [comment, setComment] = useState("");
  const reducedMotion = useReducedMotion();

  useEscapeKey(onCancel);

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
        aria-labelledby="complete-dialog-title"
        className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="complete-dialog-title" className="font-display text-base font-semibold text-[var(--color-foreground)]">
          Mark this task complete?
        </h2>
        <p className="mt-1.5 text-sm text-[var(--color-muted)]">
          Add a note for whoever assigned it, if useful — optional.
        </p>

        <label htmlFor="complete-comment" className="sr-only">
          Completion note
        </label>
        <textarea
          id="complete-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          autoFocus
          placeholder="Optional note…"
          className="mt-3 w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
        />

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="success" loading={confirming} loadingText="Completing…" onClick={() => onConfirm(comment.trim())}>
            Mark Complete
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

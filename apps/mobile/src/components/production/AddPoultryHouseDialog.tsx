import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Button from "@poultryhub/shared/components/ui/Button";
import { useEscapeKey } from "@poultryhub/shared/hooks/useEscapeKey";

interface AddPoultryHouseDialogProps {
  onCancel: () => void;
  onConfirm: (name: string) => Promise<void>;
  creating?: boolean;
}

/** Same overlay/card shell as RejectRecordDialog — Farm Admin/Manager's quick way to register a new poultry house/pen right from the Egg Production form, instead of a native window.prompt(). */
export default function AddPoultryHouseDialog({ onCancel, onConfirm, creating = false }: AddPoultryHouseDialogProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const trimmed = name.trim();
  const reducedMotion = useReducedMotion();

  useEscapeKey(onCancel);

  const handleConfirm = async () => {
    if (!trimmed) return;
    setError(null);
    try {
      await onConfirm(trimmed);
    } catch (err) {
      console.error("[AddPoultryHouseDialog] failed to create house:", err);
      const code = (err as { code?: string } | null)?.code;
      setError(code === "23505" ? "A house/pen with that name already exists." : "Couldn't add that poultry house. Please try again.");
    }
  };

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
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-house-dialog-title"
        className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="add-house-dialog-title" className="font-display text-base font-semibold text-[var(--color-foreground)]">
          Add Poultry House / Pen
        </h2>
        <p className="mt-1.5 text-sm text-[var(--color-muted)]">This becomes available to your farm's staff right away.</p>

        <label htmlFor="new-house-name" className="sr-only">
          Poultry house/pen name
        </label>
        <input
          id="new-house-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          placeholder="e.g. House 5"
          className="mt-3 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
        />
        {error && <p className="mt-2 text-sm text-[var(--color-danger)]">{error}</p>}

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" loading={creating} loadingText="Adding…" disabled={!trimmed} onClick={() => void handleConfirm()}>
            Add House
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

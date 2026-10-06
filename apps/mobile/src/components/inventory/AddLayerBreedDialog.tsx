import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Button from "@poultryhub/shared/components/ui/Button";
import { useEscapeKey } from "@poultryhub/shared/hooks/useEscapeKey";
import { EGG_COLORS, type EggColor } from "@poultryhub/shared/types/layerBreed";

interface AddLayerBreedDialogProps {
  onCancel: () => void;
  onConfirm: (name: string, eggColor: EggColor) => Promise<void>;
  creating?: boolean;
}

/** Same overlay/card shell as AddPoultryHouseDialog — Farm Admin/Manager's quick way to register a strain specific to their own farm right from the poultry event form. */
export default function AddLayerBreedDialog({ onCancel, onConfirm, creating = false }: AddLayerBreedDialogProps) {
  const [name, setName] = useState("");
  const [eggColor, setEggColor] = useState<EggColor>("White");
  const [error, setError] = useState<string | null>(null);
  const trimmed = name.trim();
  const reducedMotion = useReducedMotion();

  useEscapeKey(onCancel);

  const handleConfirm = async () => {
    if (!trimmed) return;
    setError(null);
    try {
      await onConfirm(trimmed, eggColor);
    } catch (err) {
      console.error("[AddLayerBreedDialog] failed to create layer breed:", err);
      setError("Couldn't add that Layer Breed/Strain. Please try again.");
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
        aria-labelledby="add-layer-breed-dialog-title"
        className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="add-layer-breed-dialog-title" className="font-display text-base font-semibold text-[var(--color-foreground)]">
          Add Layer Breed / Strain
        </h2>
        <p className="mt-1.5 text-sm text-[var(--color-muted)]">This becomes available to your farm's staff right away.</p>

        <label htmlFor="new-layer-breed-name" className="mt-3 block text-sm font-medium text-[var(--color-foreground)]">
          Layer Breed / Strain Name
        </label>
        <input
          id="new-layer-breed-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          placeholder="e.g. Bovans Brown"
          className="mt-1.5 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
        />

        <label htmlFor="new-layer-breed-color" className="mt-3 block text-sm font-medium text-[var(--color-foreground)]">
          Egg Color
        </label>
        <select
          id="new-layer-breed-color"
          value={eggColor}
          onChange={(e) => setEggColor(e.target.value as EggColor)}
          className="mt-1.5 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
        >
          {EGG_COLORS.map((c) => (
            <option key={c} value={c}>{c === "Other" ? "Other / Not Specified" : c}</option>
          ))}
        </select>

        {error && <p className="mt-2 text-sm text-[var(--color-danger)]">{error}</p>}

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" loading={creating} loadingText="Adding…" disabled={!trimmed} onClick={() => void handleConfirm()}>
            Add Strain
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

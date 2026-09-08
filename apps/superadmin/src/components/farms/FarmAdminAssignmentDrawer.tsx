import { useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import { assignFarm, listUsers, type ManagedUser } from "@poultryhub/shared/services/userManagementService";
import type { ManagedFarm } from "@poultryhub/shared/types/farm";

interface FarmAdminAssignmentDrawerProps {
  farm: ManagedFarm;
  onClose: () => void;
  onSaved: () => void;
}

export default function FarmAdminAssignmentDrawer({ farm, onClose, onSaved }: FarmAdminAssignmentDrawerProps) {
  const [candidates, setCandidates] = useState<ManagedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listUsers()
      .then((users) => {
        if (cancelled) return;
        const eligible = users.filter(
          (u) => (u.role === "Farm Admin" || u.role === "Manager") && (u.farmId === null || u.farmId === farm.id)
        );
        setCandidates(eligible);
        setSelected(new Set(eligible.filter((u) => u.farmId === farm.id).map((u) => u.id)));
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load Farm Admin accounts.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [farm.id]);

  const initiallyAssigned = useMemo(
    () => new Set(candidates.filter((u) => u.farmId === farm.id).map((u) => u.id)),
    [candidates, farm.id]
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    const changed = candidates.filter((u) => selected.has(u.id) !== initiallyAssigned.has(u.id));
    if (changed.length === 0) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      await Promise.all(changed.map((u) => assignFarm(u.id, selected.has(u.id) ? farm.id : null)));
      onSaved();
    } catch (err) {
      console.error("[FarmAdminAssignmentDrawer] save failed:", err);
      alert("Couldn't update farm admin assignments.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <div>
            <h2 className="font-display text-base font-semibold text-[var(--color-foreground)]">Assign Farm Admins</h2>
            <p className="mt-0.5 text-xs text-[var(--color-muted)]">{farm.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)]"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-[var(--color-muted)]">
              <Loader2 size={16} className="spinner" /> Loading accounts…
            </div>
          ) : loadError ? (
            <p className="text-sm text-[var(--color-danger)]">{loadError}</p>
          ) : candidates.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">
              No unassigned Farm Admin/Manager accounts. Create one from the Users page first.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {candidates.map((u) => (
                <label
                  key={u.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 hover:bg-[var(--color-muted-bg)]"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(u.id)}
                    onChange={() => toggle(u.id)}
                    className="h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-primary)]"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--color-foreground)]">{u.name}</p>
                    <p className="truncate text-xs text-[var(--color-muted)]">
                      {u.role}
                      {u.farmId && u.farmId !== farm.id ? " · assigned elsewhere" : ""}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3.5 py-2 text-sm font-medium text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || isLoading}
            className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
          >
            {saving && <Loader2 size={14} className="spinner" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { updatePasswordWithSupabase, verifyCurrentPassword } from "../../services/authService";
import { getSecuritySettings, signOutOtherSessions, validatePassword } from "../../services/securityService";
import type { SecuritySettings } from "../../types/security";

const inputClass =
  "rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)]";

interface ChangePasswordDrawerProps {
  onClose: () => void;
  onSaved: () => void;
}

export default function ChangePasswordDrawer({ onClose, onSaved }: ChangePasswordDrawerProps) {
  const [settings, setSettings] = useState<SecuritySettings | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [signOutOthers, setSignOutOthers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSecuritySettings()
      .then(setSettings)
      .catch((err) => console.error("[ChangePasswordDrawer] failed to load password policy:", err));
  }, []);

  const requirementErrors = settings && newPassword ? validatePassword(newPassword, settings).errors : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation don't match.");
      return;
    }
    if (settings && !validatePassword(newPassword, settings).valid) {
      setError("Your new password doesn't meet the requirements below.");
      return;
    }

    setSaving(true);
    try {
      const verified = await verifyCurrentPassword(currentPassword);
      if (!verified) {
        setError("Your current password is incorrect.");
        return;
      }

      await updatePasswordWithSupabase(newPassword);
      if (signOutOthers) await signOutOtherSessions();

      onSaved();
      onClose();
    } catch (err) {
      console.error("[ChangePasswordDrawer] change failed:", err);
      setError(err instanceof Error ? err.message : "Couldn't change your password.");
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
          <h2 className="font-display text-base font-semibold text-[var(--color-foreground)]">Change Password</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)]" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex flex-col gap-4 px-5 py-4">
            {error && <p className="rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">{error}</p>}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="current-password" className="text-sm font-medium text-[var(--color-foreground)]">Current Password</label>
              <input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={inputClass}
                autoComplete="current-password"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="new-password" className="text-sm font-medium text-[var(--color-foreground)]">New Password</label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputClass}
                autoComplete="new-password"
                required
              />
              {settings && newPassword && (
                <ul className="mt-1 flex flex-col gap-1">
                  {(requirementErrors.length > 0 ? requirementErrors : ["Meets all password requirements"]).map((line) => (
                    <li
                      key={line}
                      className={`flex items-center gap-1.5 text-xs ${requirementErrors.length > 0 ? "text-[var(--color-danger)]" : "text-[var(--color-success)]"}`}
                    >
                      {requirementErrors.length === 0 && <Check size={12} />}
                      {line}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirm-password" className="text-sm font-medium text-[var(--color-foreground)]">Confirm Password</label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass}
                autoComplete="new-password"
                required
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-[var(--color-foreground)]">
              <input type="checkbox" checked={signOutOthers} onChange={(e) => setSignOutOthers(e.target.checked)} />
              Sign out other devices after changing password
            </label>
          </div>

          <div className="flex justify-end gap-2 border-t border-[var(--color-border)] px-5 py-4">
            <button type="button" onClick={onClose} className="rounded-lg px-3.5 py-2 text-sm font-medium text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)]">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
            >
              {saving && <Loader2 size={14} className="spinner" />}
              Update Password
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

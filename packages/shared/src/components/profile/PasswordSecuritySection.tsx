import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { getLastPasswordChangeAt } from "../../services/auditLogService";
import ChangePasswordDrawer from "./ChangePasswordDrawer";

function daysAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export default function PasswordSecuritySection() {
  const [lastChangedAt, setLastChangedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDrawer, setShowDrawer] = useState(false);

  const refresh = () => {
    setLoading(true);
    getLastPasswordChangeAt()
      .then(setLastChangedAt)
      .catch((err) => console.error("[PasswordSecuritySection] failed to load last password change:", err))
      .finally(() => setLoading(false));
  };

  useEffect(refresh, []);

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
      <h2 className="font-display text-sm font-semibold text-[var(--color-foreground)]">Password & Security</h2>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
            <KeyRound size={16} />
          </span>
          <div>
            <p className="text-sm font-medium text-[var(--color-foreground)]">Password</p>
            <p className="text-xs text-[var(--color-muted)]">
              {loading ? "Loading…" : lastChangedAt ? `Last changed ${daysAgo(lastChangedAt)}` : "Never changed since sign-up"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowDrawer(true)}
          className="shrink-0 rounded-lg border border-[var(--color-border)] px-3.5 py-2 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]"
        >
          Change Password
        </button>
      </div>

      {showDrawer && <ChangePasswordDrawer onClose={() => setShowDrawer(false)} onSaved={refresh} />}
    </div>
  );
}

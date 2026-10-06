import { useEffect, useState } from "react";
import { LogOut, Loader2, Monitor, Smartphone, Tablet } from "lucide-react";
import { listMySessions, signOutOtherSessions } from "../../services/securityService";
import { timeAgo } from "../../lib/timeAgo";
import ConfirmDialog from "../layout/ConfirmDialog";
import type { UserSession } from "../../types/profile";

function DeviceIcon({ device }: { device: string }) {
  if (device === "Mobile") return <Smartphone size={18} />;
  if (device === "Tablet") return <Tablet size={18} />;
  return <Monitor size={18} />;
}

export default function ActiveSessionsSection() {
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const refresh = () => {
    setLoading(true);
    listMySessions()
      .then(setSessions)
      .catch((err) => console.error("[ActiveSessionsSection] failed to load sessions:", err))
      .finally(() => setLoading(false));
  };

  useEffect(refresh, []);

  const handleSignOutOthers = async () => {
    setSigningOut(true);
    try {
      await signOutOtherSessions();
      refresh();
    } catch (err) {
      console.error("[ActiveSessionsSection] sign out others failed:", err);
      alert("Couldn't sign out of your other sessions.");
    } finally {
      setSigningOut(false);
      setConfirming(false);
    }
  };

  const otherSessionsCount = sessions.filter((s) => !s.isCurrent).length;

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-sm font-semibold text-[var(--color-foreground)]">Active Sessions</h2>
        {otherSessionsCount > 0 && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]"
          >
            <LogOut size={13} /> Sign out other devices
          </button>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-[var(--color-muted)]">
            <Loader2 size={16} className="spinner" /> Loading…
          </div>
        ) : sessions.length === 0 ? (
          <p className="py-4 text-center text-sm text-[var(--color-muted)]">No active sessions found.</p>
        ) : (
          sessions.map((session) => (
            <div key={session.id} className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] px-3.5 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-muted-bg)] text-[var(--color-muted)]">
                <DeviceIcon device={session.device} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--color-foreground)]">
                  {session.operatingSystem} · {session.browser}
                </p>
                <p className="text-xs text-[var(--color-muted)]">
                  {session.isCurrent ? "Current Session" : `Last active: ${timeAgo(session.lastActivity)}`}
                </p>
              </div>
              {session.isCurrent && (
                <span className="shrink-0 rounded-full bg-[var(--color-success)]/10 px-2 py-0.5 text-xs font-medium text-[var(--color-success)]">
                  Current
                </span>
              )}
            </div>
          ))
        )}
      </div>

      {confirming && (
        <ConfirmDialog
          title="Sign Out Other Devices?"
          message="This will sign you out from all other devices where you're currently logged in."
          confirmLabel={signingOut ? "Signing out…" : "Sign Out"}
          danger
          onConfirm={() => void handleSignOutOthers()}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}

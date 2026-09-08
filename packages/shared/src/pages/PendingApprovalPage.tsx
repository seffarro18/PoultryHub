import { useState } from "react";
import { Clock, LogOut, RefreshCw, ShieldX } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import ConfirmDialog from "../components/layout/ConfirmDialog";

export default function PendingApprovalPage() {
  const { user, signOut, refreshUser } = useAuth();
  const [checking, setChecking] = useState(false);
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  const isDisabled = user?.status === "disabled";

  const handleCheckAgain = async () => {
    setChecking(true);
    try {
      await refreshUser();
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center">
        <div
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{
            backgroundColor: isDisabled ? "color-mix(in srgb, var(--color-danger) 12%, transparent)" : "color-mix(in srgb, var(--color-warning) 14%, transparent)",
            color: isDisabled ? "var(--color-danger)" : "var(--color-warning)",
          }}
        >
          {isDisabled ? <ShieldX size={26} strokeWidth={1.75} /> : <Clock size={26} strokeWidth={1.75} />}
        </div>

        <h1 className="font-display mt-4 text-lg font-semibold text-[var(--color-foreground)]">
          {isDisabled ? "Account disabled" : "Awaiting approval"}
        </h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          {isDisabled
            ? "Your account has been disabled. Contact your Super Admin if you believe this is a mistake."
            : "A Super Admin needs to approve your account before you can sign in. This usually doesn't take long."}
        </p>

        {user?.email && (
          <p className="mt-3 text-xs text-[var(--color-muted)]">
            Signed in as <span className="font-medium text-[var(--color-foreground)]">{user.email}</span>
          </p>
        )}

        <div className="mt-6 flex flex-col gap-2">
          {!isDisabled && (
            <button
              type="button"
              onClick={handleCheckAgain}
              disabled={checking}
              className="flex items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-70"
            >
              <RefreshCw size={15} className={checking ? "spinner" : ""} />
              {checking ? "Checking…" : "Check again"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setConfirmingLogout(true)}
            className="flex items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] px-4 py-2.5 text-sm font-medium text-[var(--color-muted)] transition-colors hover:bg-[var(--color-muted-bg)] hover:text-[var(--color-foreground)]"
          >
            <LogOut size={15} />
            Logout
          </button>
        </div>
      </div>

      {confirmingLogout && (
        <ConfirmDialog
          title="Log out"
          message="Are you sure you want to logout?"
          confirmLabel="Logout"
          onCancel={() => setConfirmingLogout(false)}
          onConfirm={() => {
            setConfirmingLogout(false);
            void signOut();
          }}
        />
      )}
    </div>
  );
}

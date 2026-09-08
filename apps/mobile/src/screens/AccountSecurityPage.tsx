import { useEffect, useState } from "react";
import { listMyLoginHistory } from "@poultryhub/shared/services/securityService";
import MfaEnrollmentPanel from "@poultryhub/shared/components/security/MfaEnrollmentPanel";
import LoginHistoryTable from "@poultryhub/shared/components/security/LoginHistoryTable";
import ActiveSessionsSection from "@poultryhub/shared/components/profile/ActiveSessionsSection";
import type { LoginHistoryEntry } from "@poultryhub/shared/types/security";
import AccountScreenHeader from "../components/AccountScreenHeader";

export default function AccountSecurityPage() {
  const [history, setHistory] = useState<LoginHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listMyLoginHistory()
      .then((rows) => {
        if (!cancelled) setHistory(rows);
      })
      .catch((err: unknown) => console.error("[AccountSecurityPage] failed to load login history:", err))
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <AccountScreenHeader title="Security" subtitle="Two-factor authentication, active devices, and recent sign-ins." />

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        <h2 className="font-display text-sm font-semibold text-[var(--color-foreground)]">Two-Factor Authentication</h2>
        <p className="mt-1 text-xs text-[var(--color-muted)]">Add an extra step when signing in using an authenticator app.</p>
        <div className="mt-4">
          <MfaEnrollmentPanel />
        </div>
      </div>

      <ActiveSessionsSection />

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        <h2 className="font-display text-sm font-semibold text-[var(--color-foreground)]">Login History</h2>
        <div className="mt-4">
          <LoginHistoryTable entries={history} isLoading={historyLoading} />
        </div>
      </div>
    </div>
  );
}

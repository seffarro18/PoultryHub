import { useEffect, useState } from "react";
import { AlertCircle, AlertTriangle, Loader2 } from "lucide-react";
import { getSecuritySettings, listFailedLoginAttempts, listLoginHistory } from "@poultryhub/shared/services/securityService";
import SecuritySettingsForm from "../components/security/SecuritySettingsForm";
import LoginHistoryTable from "@poultryhub/shared/components/security/LoginHistoryTable";
import type { FailedLoginAttempt, LoginHistoryEntry, SecuritySettings } from "@poultryhub/shared/types/security";

export default function SecurityManagementPage() {
  const [settings, setSettings] = useState<SecuritySettings | null>(null);
  const [loginHistory, setLoginHistory] = useState<LoginHistoryEntry[]>([]);
  const [failedAttempts, setFailedAttempts] = useState<FailedLoginAttempt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getSecuritySettings(), listLoginHistory(), listFailedLoginAttempts()])
      .then(([settingsRow, history, failed]) => {
        if (cancelled) return;
        setSettings(settingsRow);
        setLoginHistory(history);
        setFailedAttempts(failed);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load security data.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-xl font-semibold text-[var(--color-foreground)]">Security</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Password policy, two-factor authentication, session behavior, and login monitoring across the platform.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-24 text-sm text-[var(--color-muted)]">
          <Loader2 size={16} className="spinner" /> Loading security data…
        </div>
      ) : loadError || !settings ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-24 text-center">
          <AlertCircle size={20} className="text-[var(--color-danger)]" />
          <p className="text-sm text-[var(--color-foreground)]">{loadError ?? "Couldn't load security settings."}</p>
        </div>
      ) : (
        <>
          <SecuritySettingsForm settings={settings} onSaved={setSettings} />

          <div>
            <h2 className="font-display text-base font-semibold text-[var(--color-foreground)]">Login History</h2>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Every sign-in this app has observed, across all users. Only captures logins made through this app's own
              login form/OAuth flow.
            </p>
            <div className="mt-3">
              <LoginHistoryTable entries={loginHistory} isLoading={false} showUser />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-[var(--color-warning)]" />
              <h2 className="font-display text-base font-semibold text-[var(--color-foreground)]">Failed Login Monitoring</h2>
            </div>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Recent failed sign-in attempts by email. Feeds the account lockout policy above.
            </p>
            <div className="mt-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
              {failedAttempts.length === 0 ? (
                <div className="py-12 text-center text-sm text-[var(--color-muted)]">No failed attempts recorded.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-muted)]">
                        <th className="px-4 py-3 font-medium">Email</th>
                        <th className="px-4 py-3 font-medium">Date & Time</th>
                        <th className="px-4 py-3 font-medium">Device / Browser</th>
                      </tr>
                    </thead>
                    <tbody>
                      {failedAttempts.map((attempt) => (
                        <tr key={attempt.id} className="border-b border-[var(--color-border)] last:border-0">
                          <td className="px-4 py-3 text-[var(--color-foreground)]">{attempt.email}</td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">{new Date(attempt.createdAt).toLocaleString()}</td>
                          <td className="max-w-[280px] truncate px-4 py-3 text-[var(--color-muted)]">{attempt.userAgent ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import { enrollMfa, listMfaFactors, unenrollMfa, verifyMfaEnrollment } from "../../services/securityService";
import ConfirmDialog from "../layout/ConfirmDialog";

export default function MfaEnrollmentPanel() {
  const [isLoading, setIsLoading] = useState(true);
  const [verifiedFactorId, setVerifiedFactorId] = useState<string | null>(null);
  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null);
  const [qrCodeSvgDataUrl, setQrCodeSvgDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingUnenroll, setConfirmingUnenroll] = useState(false);

  const refresh = async () => {
    setIsLoading(true);
    try {
      const factors = await listMfaFactors();
      const verified = factors.find((f) => f.factor_type === "totp" && f.status === "verified");
      setVerifiedFactorId(verified?.id ?? null);
    } catch (err) {
      console.error("[MfaEnrollmentPanel] failed to load factors:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const handleStartEnroll = async () => {
    setError(null);
    try {
      const enrolled = await enrollMfa();
      setPendingFactorId(enrolled.factorId);
      setQrCodeSvgDataUrl(enrolled.qrCodeSvgDataUrl);
      setSecret(enrolled.secret);
    } catch (err) {
      console.error("[MfaEnrollmentPanel] enroll failed:", err);
      setError("Couldn't start enrollment. Please try again.");
    }
  };

  const cancelEnrollment = () => {
    setPendingFactorId(null);
    setQrCodeSvgDataUrl(null);
    setSecret(null);
    setCode("");
    setError(null);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingFactorId) return;
    setBusy(true);
    setError(null);
    try {
      await verifyMfaEnrollment(pendingFactorId, code.trim());
      cancelEnrollment();
      await refresh();
    } catch (err) {
      console.error("[MfaEnrollmentPanel] verify failed:", err);
      setError("That code didn't work. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleUnenroll = async () => {
    if (!verifiedFactorId) return;
    setBusy(true);
    try {
      await unenrollMfa(verifiedFactorId);
      await refresh();
    } catch (err) {
      console.error("[MfaEnrollmentPanel] unenroll failed:", err);
      alert("Couldn't turn off two-factor authentication.");
    } finally {
      setBusy(false);
      setConfirmingUnenroll(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
        <Loader2 size={15} className="spinner" /> Loading…
      </div>
    );
  }

  if (verifiedFactorId) {
    return (
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm text-[var(--color-success)]">
            <ShieldCheck size={16} /> Enabled
          </div>
          <p className="mt-0.5 text-xs text-[var(--color-muted)]">Authenticator App</p>
        </div>
        <button
          type="button"
          onClick={() => setConfirmingUnenroll(true)}
          disabled={busy}
          className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 disabled:opacity-60"
        >
          Disable 2FA
        </button>

        {confirmingUnenroll && (
          <ConfirmDialog
            title="Turn Off Two-Factor Authentication?"
            message="Your account will only require a password to sign in from now on."
            confirmLabel={busy ? "Turning off…" : "Disable 2FA"}
            danger
            onConfirm={() => void handleUnenroll()}
            onCancel={() => setConfirmingUnenroll(false)}
          />
        )}
      </div>
    );
  }

  if (pendingFactorId && qrCodeSvgDataUrl) {
    return (
      <form onSubmit={handleVerify} className="flex flex-col gap-3">
        {error && <p className="rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">{error}</p>}
        <p className="text-sm text-[var(--color-muted)]">
          Scan this QR code with your authenticator app, then enter the 6-digit code it shows.
        </p>
        <img src={qrCodeSvgDataUrl} alt="2FA QR code" className="h-40 w-40 self-center rounded-lg border border-[var(--color-border)] bg-white p-2" />
        {secret && (
          <p className="text-center text-xs text-[var(--color-muted)]">
            Or enter this key manually: <span className="font-mono">{secret}</span>
          </p>
        )}
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          inputMode="numeric"
          maxLength={6}
          placeholder="000000"
          className="self-center rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-center text-lg tracking-[0.3em] text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
        />
        <div className="flex justify-center gap-2">
          <button
            type="button"
            onClick={cancelEnrollment}
            className="rounded-lg px-3.5 py-2 text-sm font-medium text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || code.trim().length < 6}
            className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
          >
            {busy && <Loader2 size={14} className="spinner" />}
            Verify & Enable
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
        <ShieldOff size={16} /> Two-factor authentication is off.
      </div>
      <button
        type="button"
        onClick={() => void handleStartEnroll()}
        className="rounded-lg bg-[var(--color-primary)] px-3.5 py-1.5 text-xs font-semibold text-white"
      >
        Set up 2FA
      </button>
      {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}

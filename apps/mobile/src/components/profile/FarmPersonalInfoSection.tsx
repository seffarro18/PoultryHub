import { useState } from "react";
import { Loader2, UserRound } from "lucide-react";
import { updateOwnProfileNickname, uploadAvatar } from "@poultryhub/shared/services/profileService";
import type { User } from "@poultryhub/shared/types/auth";
import PhotoField from "../PhotoField";

const inputClass =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]";

interface FarmPersonalInfoSectionProps {
  user: User;
  onSaved: () => Promise<void> | void;
}

export default function FarmPersonalInfoSection({ user, onSaved }: FarmPersonalInfoSectionProps) {
  const [nickname, setNickname] = useState(user.nickname ?? user.name);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [avatar, setAvatar] = useState(user.avatar ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handlePhotoSelected = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const url = await uploadAvatar(file);
      setAvatar(url);
    } catch (err) {
      console.error("[FarmPersonalInfoSection] avatar upload failed:", err);
      setError(err instanceof Error ? err.message : "Couldn't upload that photo.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const emailChanged = email.trim() !== user.email;
      await updateOwnProfileNickname({
        nickname: nickname.trim(),
        phone: phone.trim(),
        avatar,
        email: emailChanged ? email.trim() : undefined,
      });
      await onSaved();
      setSuccess(
        emailChanged
          ? "Profile updated. Check your new email address for a confirmation link to finish the email change."
          : "Profile updated."
      );
    } catch (err) {
      console.error("[FarmPersonalInfoSection] save failed:", err);
      setError(err instanceof Error ? err.message : "Couldn't save your changes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
      <h2 className="font-display text-sm font-semibold text-[var(--color-foreground)]">Personal Information</h2>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        {error && <p className="rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">{error}</p>}
        {success && <p className="rounded-lg bg-[var(--color-primary)]/10 px-3 py-2 text-sm text-[var(--color-primary)]">{success}</p>}

        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--color-primary)]/15 text-[var(--color-primary)]">
            {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : <UserRound size={24} />}
          </span>
          <PhotoField previewUrl={null} uploading={uploading} label="Upload Photo" onPhotoSelected={(file) => void handlePhotoSelected(file)} />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--color-muted)]">Nickname</label>
          <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} className={inputClass} required />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--color-muted)]">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} required />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--color-muted)]">Phone Number</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+63 XXX XXX XXXX" className={inputClass} />
          </div>
        </div>

        <div>
          <button
            type="submit"
            disabled={saving || uploading}
            className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
          >
            {saving && <Loader2 size={14} className="spinner" />}
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}

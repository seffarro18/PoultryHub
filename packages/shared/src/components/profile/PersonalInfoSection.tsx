import { useState } from "react";
import { Loader2, Upload, UserRound } from "lucide-react";
import { updateOwnProfile, uploadAvatar } from "../../services/profileService";
import type { User } from "../../types/auth";

const inputClass =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]";

function splitLegacyName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/);
  return { firstName: parts[0] ?? "", lastName: parts.length > 1 ? parts.slice(1).join(" ") : "" };
}

interface PersonalInfoSectionProps {
  user: User;
  onSaved: () => Promise<void> | void;
}

export default function PersonalInfoSection({ user, onSaved }: PersonalInfoSectionProps) {
  const fallback = splitLegacyName(user.name);
  const [firstName, setFirstName] = useState(user.firstName ?? fallback.firstName);
  const [middleName, setMiddleName] = useState(user.middleName ?? "");
  const [lastName, setLastName] = useState(user.lastName ?? fallback.lastName);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [avatar, setAvatar] = useState(user.avatar ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadAvatar(file);
      setAvatar(url);
    } catch (err) {
      console.error("[PersonalInfoSection] avatar upload failed:", err);
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
      await updateOwnProfile({
        firstName: firstName.trim(),
        middleName: middleName.trim(),
        lastName: lastName.trim(),
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
      console.error("[PersonalInfoSection] save failed:", err);
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
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
            {uploading ? <Loader2 size={14} className="spinner" /> : <Upload size={14} />}
            {avatar ? "Replace Photo" : "Upload Photo"}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => void handlePhotoChange(e)} disabled={uploading} />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--color-muted)]">First Name</label>
            <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} required />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--color-muted)]">Middle Name</label>
            <input type="text" value={middleName} onChange={(e) => setMiddleName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--color-muted)]">Last Name</label>
            <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} required />
          </div>
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

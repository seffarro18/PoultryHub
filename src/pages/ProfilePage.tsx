import { Mail, Phone, ShieldCheck, UserRound } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function ProfilePage() {
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--color-primary)]/15 text-[var(--color-primary)]">
            {user?.avatar ? (
              <img src={user.avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <UserRound size={28} />
            )}
          </span>
          <div>
            <h1 className="font-display text-lg font-semibold text-[var(--color-foreground)]">
              {user?.name ?? "Super Admin"}
            </h1>
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[var(--color-primary)]/10 px-2.5 py-0.5 text-xs font-semibold text-[var(--color-primary)]">
              <ShieldCheck size={12} />
              {user?.role ?? "Super Admin"}
            </span>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t border-[var(--color-border)] pt-5">
          <div className="flex items-center gap-3 text-sm">
            <Mail size={16} className="text-[var(--color-muted)]" />
            <span className="text-[var(--color-foreground)]">{user?.email ?? "—"}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Phone size={16} className="text-[var(--color-muted)]" />
            <span className="text-[var(--color-muted)]">No phone number on file</span>
          </div>
        </div>
      </div>
    </div>
  );
}

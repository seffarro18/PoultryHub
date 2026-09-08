import { Link } from "react-router-dom";
import { ChevronRight, ShieldCheck, UserRound } from "lucide-react";
import { useAuth } from "@poultryhub/shared/context/AuthContext";
import AccountStatusBadge from "@poultryhub/shared/components/users/AccountStatusBadge";
import { getAccountMenuItems } from "../config/farmNavigation";

/** Mobile's Profile tab landing screen — an identity header plus a role-filtered settings menu (see getAccountMenuItems), each row drilling into its own screen. Replaces the shared ProfilePage for the farm-side app only; Super Admin's /dashboard/profile is unaffected. */
export default function ProfileMenuPage() {
  const { user } = useAuth();
  if (!user) return null;

  const items = getAccountMenuItems(user.role);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--color-primary)]/15 text-[var(--color-primary)]">
            {user.avatar ? <img src={user.avatar} alt="" className="h-full w-full object-cover" /> : <UserRound size={28} />}
          </span>
          <div>
            <h1 className="font-display text-lg font-semibold text-[var(--color-foreground)]">{user.name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-primary)]/10 px-2.5 py-0.5 text-xs font-semibold text-[var(--color-primary)]">
                <ShieldCheck size={12} />
                {user.role}
              </span>
              <AccountStatusBadge status={user.status} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-4 transition-colors hover:bg-[var(--color-muted-bg)]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                <Icon size={18} strokeWidth={2} />
              </span>
              <span className="flex-1 text-sm font-medium text-[var(--color-foreground)]">{item.label}</span>
              <ChevronRight size={16} className="shrink-0 text-[var(--color-muted)]" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

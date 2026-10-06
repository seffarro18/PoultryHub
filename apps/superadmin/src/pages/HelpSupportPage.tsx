import { Link } from "react-router-dom";
import { BookOpen, Mail } from "lucide-react";
import { useSystemSettings } from "@poultryhub/shared/context/SystemSettingsContext";
import ProfilePageHeader from "../components/profile/ProfilePageHeader";
import { GENERAL_SETTINGS_PATH } from "../config/navigation";

const GUIDE_ITEMS: { label: string; description: string }[] = [
  { label: "Dashboard", description: "Platform-wide overview — production, inventory, and farm activity at a glance." },
  { label: "Farm Management", description: "Farms and Locations — the full registry of every farm on the platform." },
  { label: "User Management", description: "Users, Roles, and Permissions — accounts, RBAC roles, and what each can do." },
  { label: "Production", description: "Egg Production, Poultry Inventory, Feed & Vitamins, Health, and Mortality — oversight across every farm." },
  { label: "Sales & Expenses", description: "Cross-farm financial records and reports." },
  { label: "Reports & Analytics", description: "Production, inventory, and farm-performance reports, exportable." },
  { label: "Notifications", description: "Platform-wide alerts — low stock, pending approvals, and anything needing attention." },
  { label: "Audit Logs", description: "An immutable trail of administrative actions across the platform." },
  { label: "Backup & Restore", description: "Snapshot farm operational data and restore from a previous backup." },
  { label: "System Settings", description: "Branding, security policy, email configuration, and other platform-wide settings." },
];

export default function HelpSupportPage() {
  const { settings } = useSystemSettings();
  const supportEmail = settings?.supportEmail;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <ProfilePageHeader title="Help & Support" subtitle="A quick guide to the platform, and how to reach us if something's wrong." />

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
            <BookOpen size={16} />
          </span>
          <h2 className="font-display text-sm font-semibold text-[var(--color-foreground)]">User Guide</h2>
        </div>
        <div className="mt-4 flex flex-col gap-3">
          {GUIDE_ITEMS.map((item) => (
            <div key={item.label}>
              <p className="text-sm font-medium text-[var(--color-foreground)]">{item.label}</p>
              <p className="mt-0.5 text-sm text-[var(--color-muted)]">{item.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
            <Mail size={16} />
          </span>
          <h2 className="font-display text-sm font-semibold text-[var(--color-foreground)]">Report a Problem</h2>
        </div>
        {supportEmail ? (
          <>
            <p className="mt-2 text-sm text-[var(--color-muted)]">Ran into a bug or something not working right? Let us know by email.</p>
            <a
              href={`mailto:${supportEmail}?subject=${encodeURIComponent("PoultryHub — Problem Report")}`}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white"
            >
              <Mail size={14} /> Email {supportEmail}
            </a>
          </>
        ) : (
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            No support email is configured yet — set one in{" "}
            <Link to={GENERAL_SETTINGS_PATH} className="font-medium text-[var(--color-primary)]">
              General Settings
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  );
}

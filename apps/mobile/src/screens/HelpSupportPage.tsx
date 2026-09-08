import { BookOpen, Mail } from "lucide-react";
import { useAuth } from "@poultryhub/shared/context/AuthContext";
import { useSystemSettings } from "@poultryhub/shared/context/SystemSettingsContext";
import AccountScreenHeader from "../components/AccountScreenHeader";

const GUIDE_ITEMS: Record<string, string> = {
  Dashboard: "A quick overview of your farm's recent activity when you open the app.",
  "Staff Management": "Add staff accounts, assign them to a house/pen, and activate or deactivate access — Farm Admin only.",
  "Egg Production": "Log daily egg collection (good, broken, damaged). Staff submissions are reviewed and approved by a Farm Admin or Manager before they count as official.",
  "Poultry Inventory": "Track flock counts, feed and vitamin distribution, and mortality — all under one tabbed screen.",
  "Health Records": "Log health cases and treatments for review and approval, same workflow as Egg Production.",
  "Sales & Expenses": "Record sales and farm expenses, and see reports — Farm Admin/Manager only.",
  Notifications: "Alerts for low stock, pending approvals, and anything that needs your attention.",
};

const ROLE_ITEMS: Record<string, string[]> = {
  "Farm Admin": ["Dashboard", "Staff Management", "Egg Production", "Poultry Inventory", "Health Records", "Sales & Expenses", "Notifications"],
  Manager: ["Dashboard", "Egg Production", "Poultry Inventory", "Health Records", "Sales & Expenses", "Notifications"],
  Staff: ["Dashboard", "Egg Production", "Poultry Inventory", "Health Records", "Notifications"],
};

export default function HelpSupportPage() {
  const { user } = useAuth();
  const { settings } = useSystemSettings();
  const items = ROLE_ITEMS[user?.role ?? "Staff"] ?? ROLE_ITEMS.Staff;
  const supportEmail = settings?.supportEmail;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <AccountScreenHeader title="Help & Support" subtitle="A quick guide to the app, and how to reach us if something's wrong." />

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
            <BookOpen size={16} />
          </span>
          <h2 className="font-display text-sm font-semibold text-[var(--color-foreground)]">User Guide</h2>
        </div>
        <div className="mt-4 flex flex-col gap-3">
          {items.map((label) => (
            <div key={label}>
              <p className="text-sm font-medium text-[var(--color-foreground)]">{label}</p>
              <p className="mt-0.5 text-sm text-[var(--color-muted)]">{GUIDE_ITEMS[label]}</p>
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
            No support email has been set up yet — ask your Farm Admin or Super Admin to configure one in System Settings.
          </p>
        )}
      </div>
    </div>
  );
}

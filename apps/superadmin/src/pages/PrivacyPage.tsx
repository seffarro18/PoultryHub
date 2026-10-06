import { Database, Eye, ShieldCheck, Target } from "lucide-react";
import ProfilePageHeader from "../components/profile/ProfilePageHeader";

function Block({ icon: Icon, title, children }: { icon: typeof Database; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
          <Icon size={16} />
        </span>
        <h2 className="font-display text-sm font-semibold text-[var(--color-foreground)]">{title}</h2>
      </div>
      <div className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">{children}</div>
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <ProfilePageHeader title="Data Privacy" subtitle="How platform data is collected, used, and protected." />

      <Block icon={Database} title="What the platform collects">
        Every user's name, email, phone number, and profile photo; their role and farm assignment; and every record
        entered across every farm — egg production, poultry inventory, health and mortality records, feed and vitamin
        logs, and sales and expenses.
      </Block>

      <Block icon={Target} title="Why Super Admin sees all of it">
        Platform administration genuinely needs cross-farm visibility — comparing farm performance, managing user
        accounts and roles, investigating an audit trail, keeping the system healthy. This is the one role in
        PoultryHub with that scope; it exists for oversight, not day-to-day farm operations.
      </Block>

      <Block icon={Eye} title="What farm-level users can see">
        Everyone below Super Admin is still boundaried by row-level security at the database itself, not just hidden
        UI — a Farm Admin or Manager only ever sees their own farm's data, and Staff only what their role needs. Super
        Admin's broader access doesn't loosen those boundaries for anyone else.
      </Block>

      <Block icon={ShieldCheck} title="Your own account">
        You can update your own name, contact details, and photo any time from My Account. Audit Logs records
        administrative actions — including yours — as an immutable trail, consistent with the same transparency
        principle every role in this system is held to.
      </Block>
    </div>
  );
}

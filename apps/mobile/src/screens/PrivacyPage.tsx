import { Database, Eye, ShieldCheck, Target } from "lucide-react";
import AccountScreenHeader from "../components/AccountScreenHeader";

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
      <AccountScreenHeader title="Data Privacy" subtitle="How your information is collected, used, and protected." />

      <Block icon={Database} title="What we collect">
        Your name/nickname, email, phone number, and profile photo; your role and which farm you're assigned to; and the
        records you personally enter — egg production, poultry inventory, health and mortality records, feed and vitamin
        logs, and sales and expenses (if your role has access to those).
      </Block>

      <Block icon={Target} title="Why we collect it">
        Solely to run day-to-day farm operations — tracking production and inventory, monitoring flock health, keeping a
        record of who recorded or approved what, and letting your Farm Admin manage staff assigned to their farm. Nothing
        here is used for advertising or sold to anyone.
      </Block>

      <Block icon={Eye} title="Who can see it">
        This isn't just a policy — it's enforced by the database itself (row-level security), not just hidden in the app.
        Staff can see their own farm's records relevant to their role. Farm Admins and Managers can see everything for
        their own assigned farm, and nothing from any other farm. Super Admins can see platform-wide data, since they're
        responsible for the whole system. No one outside PoultryHub has access.
      </Block>

      <Block icon={ShieldCheck} title="Your rights">
        You can update your own name/nickname, contact details, and photo any time from My Account. For anything you
        can't change yourself — like your role or farm assignment — ask your Farm Admin, or a Super Admin if you're a
        Farm Admin. This follows the Philippine Data Privacy Act's principles of transparency, legitimate purpose, and
        proportionality: we only collect what's needed to run the farm, and only the people who need it can see it.
      </Block>
    </div>
  );
}

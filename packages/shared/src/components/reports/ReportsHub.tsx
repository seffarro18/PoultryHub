import { Bird, ChevronRight, ClipboardList, Egg, LayoutDashboard, Skull, Syringe, Wallet, Wheat, type LucideIcon } from "lucide-react";
import { reportsForRole } from "../../lib/reportCatalog";
import { REPORT_CATEGORY_DESCRIPTION, REPORT_CATEGORY_LABEL, type ReportCategory, type ReportRole } from "../../types/report";

const CATEGORY_ICON: Record<ReportCategory, LucideIcon> = {
  overview: LayoutDashboard,
  layers: Bird,
  eggs: Egg,
  feed: Wheat,
  vitamins: Syringe,
  mortality: Skull,
  finance: Wallet,
  activity: ClipboardList,
};

const CATEGORY_ORDER: ReportCategory[] = ["overview", "layers", "eggs", "feed", "vitamins", "mortality", "finance", "activity"];

interface ReportsHubProps {
  role: ReportRole;
  /** Optional category to scroll to/highlight (e.g. arriving from Sales & Expenses). */
  focusCategory?: ReportCategory | null;
  onOpen: (reportId: string) => void;
}

/** The Reports landing page — every report this role may open, grouped by category. */
export default function ReportsHub({ role, focusCategory, onOpen }: ReportsHubProps) {
  const reports = reportsForRole(role);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-xl font-semibold text-[var(--color-foreground)]">Reports</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Detailed, filterable reports built from your farm's actual records — export any of them to CSV or print / save as PDF.
          {role === "Staff" ? " Financial reports are available to Farm Admin and Manager accounts." : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {CATEGORY_ORDER.map((category) => {
          const items = reports.filter((r) => r.category === category);
          if (items.length === 0) return null;
          const Icon = CATEGORY_ICON[category];
          return (
            <section
              key={category}
              id={`reports-${category}`}
              className={`rounded-2xl border bg-[var(--color-card)] p-4 ${focusCategory === category ? "border-[var(--color-primary)]" : "border-[var(--color-border)]"}`}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                  <Icon size={18} strokeWidth={1.75} />
                </div>
                <div className="min-w-0">
                  <h2 className="font-display text-sm font-semibold text-[var(--color-foreground)]">{REPORT_CATEGORY_LABEL[category]}</h2>
                  <p className="mt-0.5 text-xs text-[var(--color-muted)]">{REPORT_CATEGORY_DESCRIPTION[category]}</p>
                </div>
              </div>
              <ul className="mt-3 flex flex-col divide-y divide-[var(--color-border)]">
                {items.map((report) => (
                  <li key={report.id}>
                    <button
                      type="button"
                      onClick={() => onOpen(report.id)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg px-1 py-2.5 text-left hover:bg-[var(--color-muted-bg)]"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-[var(--color-foreground)]">{report.title}</span>
                        <span className="block text-xs text-[var(--color-muted)]">{report.description}</span>
                      </span>
                      <ChevronRight size={16} className="shrink-0 text-[var(--color-muted)]" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

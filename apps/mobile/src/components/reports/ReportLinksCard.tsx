import { useNavigate } from "react-router-dom";
import { ChevronRight, FileChartColumn } from "lucide-react";
import { FARM_REPORTS_PATH } from "../../config/farmNavigation";

interface ReportLinksCardProps {
  reports: { id: string; label: string }[];
  /** Hub category to highlight from "All reports". */
  category?: string;
}

/** A module's shortcut into the Reports module — each link opens the full, filterable report (CSV + Print / Save as PDF live there). */
export default function ReportLinksCard({ reports, category }: ReportLinksCardProps) {
  const navigate = useNavigate();
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 print:hidden">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-[var(--color-foreground)]">
          <FileChartColumn size={15} className="text-[var(--color-primary)]" /> Reports
        </h2>
        <button
          type="button"
          onClick={() => navigate(`${FARM_REPORTS_PATH}${category ? `?category=${category}` : ""}`)}
          className="text-xs font-semibold text-[var(--color-primary)] hover:opacity-80"
        >
          All reports
        </button>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {reports.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => navigate(`${FARM_REPORTS_PATH}/${r.id}`)}
            className="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-left text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]"
          >
            {r.label}
            <ChevronRight size={14} className="shrink-0 text-[var(--color-muted)]" />
          </button>
        ))}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import ReportsHub from "@poultryhub/shared/components/reports/ReportsHub";
import ReportViewer, { type SelectRenderProps } from "@poultryhub/shared/components/reports/ReportViewer";
import { findReport } from "@poultryhub/shared/lib/reportCatalog";
import { listFarms } from "@poultryhub/shared/services/eggProductionService";
import { useAuth } from "@poultryhub/shared/context/AuthContext";
import type { ReportCategory } from "@poultryhub/shared/types/report";
import MobileSelect from "../components/ui/MobileSelect";
import { FARM_REPORTS_PATH } from "../config/farmNavigation";

function ReportSelect({ id, label, value, onChange, options }: SelectRenderProps) {
  return <MobileSelect id={id} value={value} onChange={onChange} options={options} sheetTitle={label} searchable={options.length > 8} className="bg-[var(--color-background)]" />;
}

/**
 * /farm/reports (hub) and /farm/reports/:reportId (one report). Role access is
 * checked here — an unpermitted report id (e.g. a Staff member opening a
 * financial report by URL) is refused — and again by RLS, which never
 * returns sales/expense/purchase rows to Staff at all.
 */
export default function FarmReportsPage() {
  const { user } = useAuth();
  const { reportId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [farmName, setFarmName] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.farmId) return;
    listFarms()
      .then((farms) => setFarmName(farms.find((f) => f.id === user.farmId)?.name ?? null))
      .catch((err) => console.error("[FarmReportsPage] failed to load farm name:", err));
  }, [user?.farmId]);

  if (!user?.farmId) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-6 py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-warning)]/10 text-[var(--color-warning)]">
          <ShieldAlert size={26} strokeWidth={1.75} />
        </div>
        <p className="max-w-sm text-sm text-[var(--color-muted)]">Ask your Super Admin to assign your account to a farm before viewing reports.</p>
      </div>
    );
  }

  const role = user.role === "Super Admin" ? "Farm Admin" : user.role;

  if (!reportId) {
    const focus = new URLSearchParams(location.search).get("category") as ReportCategory | null;
    return <ReportsHub role={role} focusCategory={focus} onOpen={(id) => navigate(`${FARM_REPORTS_PATH}/${id}`)} />;
  }

  const report = findReport(reportId, role);
  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-6 py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-warning)]/10 text-[var(--color-warning)]">
          <ShieldAlert size={26} strokeWidth={1.75} />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold text-[var(--color-foreground)]">Report unavailable</h2>
          <p className="mt-1.5 max-w-sm text-sm text-[var(--color-muted)]">
            This report doesn't exist or isn't available to your role. Financial reports are limited to Farm Admin and Manager accounts.
          </p>
        </div>
        <button type="button" onClick={() => navigate(FARM_REPORTS_PATH)} className="text-sm font-semibold text-[var(--color-primary)]">
          Back to Reports
        </button>
      </div>
    );
  }

  return (
    <ReportViewer
      key={report.id}
      report={report}
      role={role}
      userId={user.id}
      farmName={farmName}
      onBack={() => navigate(FARM_REPORTS_PATH)}
      onOpenReport={(id, search) => navigate(`${FARM_REPORTS_PATH}/${id}${search ? `?${search}` : ""}`)}
      SelectComponent={ReportSelect}
    />
  );
}

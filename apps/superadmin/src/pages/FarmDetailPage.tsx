import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Bird,
  CalendarDays,
  Egg,
  Eye,
  FileText,
  LayoutGrid,
  Loader2,
  Monitor,
  PackageCheck,
  Pill,
  Receipt,
  TrendingDown,
  TrendingUp,
  UsersRound,
  Wallet,
  Wheat,
} from "lucide-react";
import {
  fetchAllFarmsData,
  getFarmDetailOverview,
  type AllFarmsBulkData,
} from "@poultryhub/shared/services/farmMonitoringService";
import FarmStatusBadge from "@poultryhub/shared/components/farms/FarmStatusBadge";
import StatTile from "@poultryhub/shared/components/production/StatTile";
import Button from "@poultryhub/shared/components/ui/Button";
import { useBreakpoint } from "@poultryhub/shared/hooks/useBreakpoint";
import { useDashboardRealtime } from "../hooks/useDashboardRealtime";
import { formatFullAddress, formatAdmins } from "../lib/farmDisplay";
import { ALL_FARMS_PATH } from "../config/navigation";
import FarmOverviewSection from "../components/allFarms/FarmOverviewSection";
import FarmProductionSection from "../components/allFarms/FarmProductionSection";
import FarmPoultryInventorySection from "../components/allFarms/FarmPoultryInventorySection";
import FarmSalesExpensesSection from "../components/allFarms/FarmSalesExpensesSection";
import FarmStaffSection from "../components/allFarms/FarmStaffSection";
import { getErrorMessage } from "@poultryhub/shared/lib/errorMessage";

type Tab = "overview" | "production" | "inventory" | "sales" | "staff";
// Same single-accent segmented-control style as the Farm Admin's own Poultry
// Inventory tab strip (apps/mobile/src/screens/FarmPoultryInventoryPage.tsx
// and this app's own PoultryInventoryPage.tsx) — green for the active tab,
// muted grey otherwise, no per-tab colors.
const TABS: { key: Tab; label: string; icon: typeof Egg }[] = [
  { key: "overview", label: "Overview", icon: LayoutGrid },
  { key: "production", label: "Production", icon: TrendingUp },
  { key: "inventory", label: "Poultry Inventory", icon: Bird },
  { key: "sales", label: "Sales & Expenses", icon: FileText },
  { key: "staff", label: "Staff", icon: UsersRound },
];

export default function FarmDetailPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const breakpoint = useBreakpoint();
  const [data, setData] = useState<AllFarmsBulkData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");

  const refresh = useCallback(async (showSpinner = true) => {
    if (showSpinner) setIsLoading(true);
    setLoadError(null);
    try {
      setData(await fetchAllFarmsData());
    } catch (err) {
      setLoadError(getErrorMessage(err, "Unable to load this farm's data."));
    } finally {
      if (showSpinner) setIsLoading(false);
    }
  }, []);

  // Re-fetches and re-derives everything whenever the URL's :farmId changes
  // (switching farms from the All Farms list, or via back/forward) — nothing
  // from the previously viewed farm is carried over.
  useEffect(() => {
    void refresh(true);
  }, [farmId, refresh]);

  // Staff/Farm Admin submitting or approving an egg record, recording a sale,
  // adjusting stock, etc. — anywhere in the system — re-fetches this same
  // bulk bundle (RLS-scoped to every farm, same as the rest of this app) and
  // re-derives this one farm's numbers. No spinner flash for a background tick.
  useDashboardRealtime(true, () => void refresh(false));

  const farm = useMemo(() => data?.farms.find((f) => f.id === farmId) ?? null, [data, farmId]);
  const overview = useMemo(() => (data && farmId ? getFarmDetailOverview(data, farmId) : null), [data, farmId]);

  if (breakpoint !== "desktop") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-6 py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
          <Monitor size={26} strokeWidth={1.75} />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold text-[var(--color-foreground)]">Best viewed on a larger screen</h2>
          <p className="mt-1.5 max-w-sm text-sm text-[var(--color-muted)]">
            Farm monitoring is designed for desktop. Please switch to a larger screen.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-24 text-sm text-[var(--color-muted)]">
        <Loader2 size={16} className="spinner" /> Loading farm…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-24 text-center">
        <AlertCircle size={20} className="text-[var(--color-danger)]" />
        <p className="text-sm text-[var(--color-foreground)]">{loadError}</p>
        <Button variant="outline" size="sm" onClick={() => void refresh()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!data || !farm || !overview || !farmId) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-24 text-center">
        <AlertCircle size={20} className="text-[var(--color-muted)]" />
        <p className="text-sm text-[var(--color-foreground)]">Farm not found.</p>
        <Link to={ALL_FARMS_PATH} className="text-sm font-medium text-[var(--color-primary)]">
          Back to All Farms
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to={ALL_FARMS_PATH} className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-foreground)]">
            <ArrowLeft size={15} /> All Farms
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-muted-bg)] px-2.5 py-1 text-xs font-medium text-[var(--color-muted)]">
            <Eye size={12} /> Read-only Super Admin View
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-xl font-semibold text-[var(--color-foreground)]">{farm.name}</h1>
          <FarmStatusBadge status={farm.status} />
        </div>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Owner: {farm.owner ?? "—"} · Farm Admin: {formatAdmins(farm)} · Location: {formatFullAddress(farm)}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile icon={Egg} label="Today's Egg Production" value={overview.todaysEggProduction} />
          <StatTile icon={CalendarDays} label="Weekly Egg Production" value={overview.weeklyEggProduction} />
          <StatTile icon={CalendarDays} label="Monthly Egg Production" value={overview.monthlyEggProduction} />
          <StatTile icon={PackageCheck} label="Remaining Egg Stock" value={overview.remainingEggStock} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile icon={Bird} label="Total Chickens" value={overview.totalChickens} />
          <StatTile icon={Egg} label="Total Layers" value={overview.totalLayers} />
          <StatTile icon={Wheat} label="Feed Stock" value={overview.feedStock} />
          <StatTile icon={Pill} label="Vitamins / Medicine Stock" value={overview.vitaminStock} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile icon={TrendingDown} label="Mortality (7d)" value={overview.mortality7d} />
          <StatTile icon={UsersRound} label="Total Staff" value={overview.totalStaff} />
          <StatTile icon={Wallet} label="Today's Sales" value={`₱${overview.todaysSales.toLocaleString()}`} />
          <StatTile icon={Wallet} label="Monthly Sales" value={`₱${overview.monthlySales.toLocaleString()}`} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatTile icon={Receipt} label="Today's Expenses" value={`₱${overview.todaysExpenses.toLocaleString()}`} />
          <StatTile icon={Receipt} label="Monthly Expenses" value={`₱${overview.monthlyExpenses.toLocaleString()}`} />
          <StatTile icon={TrendingUp} label="Net Profit" value={`₱${overview.netProfit.toLocaleString()}`} />
        </div>
      </div>

      <div>
        <div className="flex flex-wrap rounded-lg border border-[var(--color-border)] p-0.5 text-sm font-medium" style={{ width: "fit-content" }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 rounded-md px-3.5 py-2 transition-colors ${
                tab === t.key ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              }`}
            >
              <t.icon size={15} />
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {tab === "overview" && <FarmOverviewSection data={data} farmId={farmId} />}
          {tab === "production" && <FarmProductionSection data={data} farmId={farmId} />}
          {tab === "inventory" && <FarmPoultryInventorySection data={data} farmId={farmId} />}
          {tab === "sales" && <FarmSalesExpensesSection data={data} farmId={farmId} />}
          {tab === "staff" && <FarmStaffSection data={data} farmId={farmId} />}
        </div>
      </div>
    </div>
  );
}

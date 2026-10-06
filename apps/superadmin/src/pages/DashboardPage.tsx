import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import KpiCard from "@poultryhub/shared/components/dashboard/KpiCard";
import NeedsAttentionSection from "@poultryhub/shared/components/dashboard/attention/NeedsAttentionSection";
import Button from "@poultryhub/shared/components/ui/Button";
import { Skeleton, SkeletonCard } from "@poultryhub/shared/components/ui/Skeleton";
import EggProductionChart from "../components/dashboard/charts/EggProductionChart";
import RevenueExpensesChart from "../components/dashboard/charts/RevenueExpensesChart";
import FeedConsumptionChart from "../components/dashboard/charts/FeedConsumptionChart";
import PoultryPopulationChart from "../components/dashboard/charts/PoultryPopulationChart";
import MortalityRateChart from "../components/dashboard/charts/MortalityRateChart";
import FarmComparisonChart from "../components/dashboard/charts/FarmComparisonChart";
import UserGrowthChart from "../components/dashboard/charts/UserGrowthChart";
import SystemActivityChart from "../components/dashboard/charts/SystemActivityChart";
import FarmProductionBreakdownTable from "../components/dashboard/FarmProductionBreakdownTable";
import {
  fetchDashboardData,
  getEggProductionTrend,
  getFarmComparison,
  getFarmProductionBreakdown,
  getFeedConsumption,
  getKpiCards,
  getMortalityByFarm,
  getMortalityRate,
  getPoultryPopulationBreakdown,
  getRevenueExpenses,
  getSystemActivity,
  getUserGrowth,
  type DashboardData,
} from "@poultryhub/shared/services/dashboardService";
import { useAuth } from "@poultryhub/shared/context/AuthContext";
import { useNeedsAttention } from "../hooks/useNeedsAttention";
import { useDashboardRealtime } from "../hooks/useDashboardRealtime";
import { attentionModulePath } from "../lib/attentionRoutes";
import type { AttentionItem } from "@poultryhub/shared/types/attention";
import { getErrorMessage } from "@poultryhub/shared/lib/errorMessage";

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const attention = useNeedsAttention();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Reset at the top of the mount effect below (not just declared once via
  // useRef) so React 18 Strict Mode's dev-only mount→cleanup→remount
  // double-invoke can't permanently strand this at "cancelled" after the
  // very first mount — see FarmDashboardPage's identical fix for the full
  // explanation of why that matters.
  const cancelledRef = useRef(false);
  const dataRef = useRef<DashboardData | null>(null);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const handleAttentionAction = (item: AttentionItem) => {
    void attention.markRead(item);
    navigate(attentionModulePath(item.module));
  };

  const refresh = useCallback((showSpinner = false) => {
    if (showSpinner) setIsLoading(true);
    fetchDashboardData()
      .then((result) => {
        if (!cancelledRef.current) {
          setData(result);
          setLoadError(null);
        }
      })
      .catch((err: unknown) => {
        console.error("[DashboardPage] failed to load dashboard data:", err);
        // A background Realtime-triggered refresh failing shouldn't blank an
        // already-working dashboard into a full error screen — only a
        // failure with nothing loaded yet is fatal enough for that.
        if (!cancelledRef.current && dataRef.current === null) {
          setLoadError(getErrorMessage(err, "Unable to load dashboard data."));
        }
      })
      .finally(() => {
        if (!cancelledRef.current) setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    refresh(true);
    return () => {
      cancelledRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetches the whole dashboard whenever any table it depends on changes
  // for ANY farm — a Staff member recording egg production, a Farm Admin
  // approving/editing/deleting a record, a new farm being registered, etc.
  useDashboardRealtime(Boolean(user), () => refresh(false));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-xl font-semibold text-[var(--color-foreground)]">
          Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">Here's what's happening across your farms today.</p>
      </div>

      <NeedsAttentionSection
        items={attention.items}
        isLoading={attention.isLoading}
        error={attention.error}
        onRetry={() => void attention.refresh()}
        onAction={handleAttentionAction}
        onDismiss={(item) => void attention.dismiss(item)}
        dismissingId={attention.dismissingId}
      />

      {isLoading ? (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        </div>
      ) : loadError || !data ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-24 text-center">
          <AlertCircle size={20} className="text-[var(--color-danger)]" />
          <div>
            <p className="text-sm font-medium text-[var(--color-foreground)]">Unable to load dashboard data.</p>
            <p className="mt-1 text-sm text-[var(--color-muted)]">{loadError ?? "Please try again."}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refresh(true)}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {getKpiCards(data).map((kpi) => (
              <KpiCard key={kpi.id} data={kpi} />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <EggProductionChart dailyData={getEggProductionTrend(data, "daily")} monthlyData={getEggProductionTrend(data, "monthly")} />
            <RevenueExpensesChart data={getRevenueExpenses(data)} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <FarmComparisonChart data={getFarmComparison(data)} />
            <UserGrowthChart data={getUserGrowth(data)} />
          </div>

          <FarmProductionBreakdownTable rows={getFarmProductionBreakdown(data)} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <FeedConsumptionChart data={getFeedConsumption(data)} />
            <PoultryPopulationChart data={getPoultryPopulationBreakdown(data)} />
            <MortalityRateChart data={getMortalityRate(data)} />
            <SystemActivityChart data={getSystemActivity(data)} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <FarmComparisonChart data={getMortalityByFarm(data)} title="Mortality by Farm" subtitle="Approved mortality, all-time" />
          </div>
        </>
      )}
    </div>
  );
}

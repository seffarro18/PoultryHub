import { useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import KpiCard from "@poultryhub/shared/components/dashboard/KpiCard";
import EggProductionChart from "../components/dashboard/charts/EggProductionChart";
import RevenueExpensesChart from "../components/dashboard/charts/RevenueExpensesChart";
import FeedConsumptionChart from "../components/dashboard/charts/FeedConsumptionChart";
import PoultryPopulationChart from "../components/dashboard/charts/PoultryPopulationChart";
import MortalityRateChart from "../components/dashboard/charts/MortalityRateChart";
import FarmComparisonChart from "../components/dashboard/charts/FarmComparisonChart";
import UserGrowthChart from "../components/dashboard/charts/UserGrowthChart";
import SystemActivityChart from "../components/dashboard/charts/SystemActivityChart";
import {
  fetchDashboardData,
  getEggProductionTrend,
  getFarmComparison,
  getFeedConsumption,
  getKpiCards,
  getMortalityRate,
  getPoultryPopulationBreakdown,
  getRevenueExpenses,
  getSystemActivity,
  getUserGrowth,
  type DashboardData,
} from "@poultryhub/shared/services/dashboardService";
import { useAuth } from "@poultryhub/shared/context/AuthContext";

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchDashboardData()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load dashboard data.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-xl font-semibold text-[var(--color-foreground)]">
          Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">Here's what's happening across your farms today.</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-24 text-sm text-[var(--color-muted)]">
          <Loader2 size={16} className="spinner" /> Loading dashboard…
        </div>
      ) : loadError || !data ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-24 text-center">
          <AlertCircle size={20} className="text-[var(--color-danger)]" />
          <p className="text-sm text-[var(--color-foreground)]">{loadError ?? "Couldn't load dashboard data."}</p>
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <FeedConsumptionChart data={getFeedConsumption(data)} />
            <PoultryPopulationChart data={getPoultryPopulationBreakdown(data)} />
            <MortalityRateChart data={getMortalityRate(data)} />
            <SystemActivityChart data={getSystemActivity(data)} />
          </div>
        </>
      )}
    </div>
  );
}

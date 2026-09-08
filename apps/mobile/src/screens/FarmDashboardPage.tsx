import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import KpiCard from "@poultryhub/shared/components/dashboard/KpiCard";
import NeedsAttentionSection from "@poultryhub/shared/components/dashboard/attention/NeedsAttentionSection";
import { Skeleton, SkeletonCard } from "@poultryhub/shared/components/ui/Skeleton";
import FadeIn from "@poultryhub/shared/components/motion/FadeIn";
import { StaggerGroup, StaggerItem } from "@poultryhub/shared/components/motion/Stagger";
import FarmEggProductionChart from "../components/dashboard/charts/FarmEggProductionChart";
import FarmRevenueExpensesChart from "../components/dashboard/charts/FarmRevenueExpensesChart";
import FarmFeedConsumptionChart from "../components/dashboard/charts/FarmFeedConsumptionChart";
import FarmChickenPopulationChart from "../components/dashboard/charts/FarmChickenPopulationChart";
import FarmMortalityRateChart from "../components/dashboard/charts/FarmMortalityRateChart";
import {
  fetchFarmDashboardData,
  getChickenPopulation,
  getEggProductionTrend,
  getFeedConsumption,
  getKpiCards,
  getMortalityRate,
  getRevenueExpenses,
  type FarmDashboardData,
} from "@poultryhub/shared/services/farmDashboardService";
import { useAuth } from "@poultryhub/shared/context/AuthContext";
import { useNeedsAttention } from "../hooks/useNeedsAttention";
import { attentionModulePath, farmAdminAttentionCategories, farmAdminMatchesCategory } from "../lib/attentionRoutes";
import type { AttentionItem } from "@poultryhub/shared/types/attention";

export default function FarmDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const attention = useNeedsAttention();
  const [data, setData] = useState<FarmDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const handleAttentionAction = (item: AttentionItem) => {
    void attention.markRead(item);
    navigate(attentionModulePath(item.module));
  };

  useEffect(() => {
    let cancelled = false;
    fetchFarmDashboardData()
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
        <p className="mt-1 text-sm text-[var(--color-muted)]">Here's how your farm is doing today.</p>
      </div>

      <NeedsAttentionSection
        items={attention.items}
        isLoading={attention.isLoading}
        error={attention.error}
        onRetry={() => void attention.refresh()}
        onAction={handleAttentionAction}
        onDismiss={(item) => void attention.dismiss(item)}
        dismissingId={attention.dismissingId}
        categories={user?.role !== "Staff" ? farmAdminAttentionCategories(user?.role === "Farm Admin") : undefined}
        matchesCategory={user?.role !== "Staff" ? farmAdminMatchesCategory : undefined}
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
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-24 text-center">
          <AlertCircle size={20} className="text-[var(--color-danger)]" />
          <p className="text-sm text-[var(--color-foreground)]">{loadError ?? "Couldn't load dashboard data."}</p>
        </div>
      ) : (
        <>
          <StaggerGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {getKpiCards(data).map((kpi) => (
              <StaggerItem key={kpi.id}>
                <KpiCard data={kpi} />
              </StaggerItem>
            ))}
          </StaggerGroup>

          <FadeIn delay={0.1} className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <FarmEggProductionChart data={getEggProductionTrend(data)} />
            <FarmRevenueExpensesChart data={getRevenueExpenses(data)} />
          </FadeIn>

          <FadeIn delay={0.16} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <FarmFeedConsumptionChart data={getFeedConsumption(data)} />
            <FarmChickenPopulationChart data={getChickenPopulation(data)} />
            <FarmMortalityRateChart data={getMortalityRate(data)} />
          </FadeIn>
        </>
      )}
    </div>
  );
}

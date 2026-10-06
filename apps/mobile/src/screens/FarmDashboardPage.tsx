import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import KpiCard from "@poultryhub/shared/components/dashboard/KpiCard";
import NeedsAttentionSection from "@poultryhub/shared/components/dashboard/attention/NeedsAttentionSection";
import Button from "@poultryhub/shared/components/ui/Button";
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
  getFarmOverview,
  getFeedConsumption,
  getKpiCards,
  getMortalityRate,
  getRevenueExpenses,
  type FarmDashboardData,
} from "@poultryhub/shared/services/farmDashboardService";
import { useAuth } from "@poultryhub/shared/context/AuthContext";
import { useNeedsAttention } from "../hooks/useNeedsAttention";
import { useFarmDashboardRealtime } from "../hooks/useFarmDashboardRealtime";
import { attentionModulePath } from "../lib/attentionRoutes";
import type { AttentionItem } from "@poultryhub/shared/types/attention";
import { getErrorMessage } from "@poultryhub/shared/lib/errorMessage";
import MobileEggHeroCard from "../components/dashboard/MobileEggHeroCard";
import MobileQuickActions, { type MobileQuickAction } from "../components/dashboard/MobileQuickActions";
import {
  FARM_EGG_PRODUCTION_PATH,
  FARM_TASKS_PATH,
  FARM_POULTRY_INVENTORY_PATH,
  FARM_SALES_EXPENSES_PATH,
  FARM_STAFF_PATH,
} from "../config/farmNavigation";
import { Egg, ListChecks, Bird, Wallet, UsersRound } from "lucide-react";

/** Manager shares this dashboard with Farm Admin but has no Staff Management access (same split farmNavigation.ts already applies to the sidebar) — the Staff tile is only included for Farm Admin. */
function getQuickActions(role: string | undefined): MobileQuickAction[] {
  const actions: MobileQuickAction[] = [
    { label: "Egg Production", path: FARM_EGG_PRODUCTION_PATH, icon: Egg },
    { label: "Tasks", path: FARM_TASKS_PATH, icon: ListChecks },
    { label: "Inventory", path: FARM_POULTRY_INVENTORY_PATH, icon: Bird },
    { label: "Sales", path: FARM_SALES_EXPENSES_PATH, icon: Wallet },
  ];
  if (role === "Farm Admin") actions.push({ label: "Staff", path: FARM_STAFF_PATH, icon: UsersRound });
  return actions;
}

export default function FarmDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const attention = useNeedsAttention();
  const [data, setData] = useState<FarmDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Tracks whether the component is still mounted, so a fetch that resolves
  // after unmount never calls setState. Reset to false at the top of the
  // effect (not just declared once via useRef) so React 18 Strict Mode's
  // dev-only mount→cleanup→remount double-invoke self-heals: without the
  // reset, that synthetic cleanup permanently flips this to true after the
  // very first mount, and every subsequent refresh() — including the
  // Realtime-triggered and Retry-triggered ones — silently no-ops its
  // setIsLoading(false), leaving the dashboard stuck on the skeleton forever.
  const cancelledRef = useRef(false);
  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);
  // Mirrors `data` for refresh()'s catch handler below — a background
  // Realtime-triggered refresh failing (a transient network blip) shouldn't
  // blank out an already-working dashboard into a full error screen; only a
  // failure with nothing loaded yet is fatal enough for that.
  const dataRef = useRef<FarmDashboardData | null>(null);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const handleAttentionAction = (item: AttentionItem) => {
    void attention.markRead(item);
    navigate(attentionModulePath(item.module));
  };

  const refresh = useCallback((showSpinner = false) => {
    if (showSpinner) setIsLoading(true);
    fetchFarmDashboardData()
      .then((result) => {
        if (!cancelledRef.current) {
          setData(result);
          setLoadError(null);
        }
      })
      .catch((err: unknown) => {
        console.error("[FarmDashboardPage] failed to load dashboard data:", err);
        if (!cancelledRef.current && dataRef.current === null) {
          setLoadError(getErrorMessage(err, "Failed to load dashboard data."));
        }
      })
      .finally(() => {
        if (!cancelledRef.current) setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    refresh(true);
  }, [refresh]);

  // Re-fetches the whole dashboard whenever any module it depends on
  // changes on the server — Staff recording egg production, a task being
  // created/completed, a sale/expense being logged, stock levels moving,
  // etc. — so the numbers stay live without the user pulling to refresh.
  useFarmDashboardRealtime(user?.farmId, user?.id, () => refresh(false));

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
            <p className="text-sm font-medium text-[var(--color-foreground)]">Unable to load</p>
            <p className="mt-1 text-sm text-[var(--color-muted)]">{loadError ?? "Couldn't load dashboard data."}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refresh(true)}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          {/* Mobile (<768px) — hero card + quick actions, matching the dedicated mobile redesign. */}
          <div className="flex flex-col gap-6 md:hidden">
            <MobileEggHeroCard
              today={getFarmOverview(data).todaysEggProduction}
              weekly={getFarmOverview(data).weeklyEggProduction}
              monthly={getFarmOverview(data).monthlyEggProduction}
            />
            <MobileQuickActions actions={getQuickActions(user?.role)} />
          </div>

          {/* Tablet/desktop (>=768px) — existing KPI grid + charts, unchanged. */}
          <div className="hidden md:flex md:flex-col md:gap-6">
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
          </div>
        </>
      )}
    </div>
  );
}

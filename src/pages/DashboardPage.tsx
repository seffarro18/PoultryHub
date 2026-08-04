import KpiCard from "../components/dashboard/KpiCard";
import EggProductionChart from "../components/dashboard/charts/EggProductionChart";
import RevenueExpensesChart from "../components/dashboard/charts/RevenueExpensesChart";
import FeedConsumptionChart from "../components/dashboard/charts/FeedConsumptionChart";
import PoultryPopulationChart from "../components/dashboard/charts/PoultryPopulationChart";
import MortalityRateChart from "../components/dashboard/charts/MortalityRateChart";
import FarmComparisonChart from "../components/dashboard/charts/FarmComparisonChart";
import UserGrowthChart from "../components/dashboard/charts/UserGrowthChart";
import SystemActivityChart from "../components/dashboard/charts/SystemActivityChart";
import { getKpiCards } from "../services/dashboardService";
import { useAuth } from "../context/AuthContext";

export default function DashboardPage() {
  const { user } = useAuth();
  const kpis = getKpiCards();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-xl font-semibold text-[var(--color-foreground)]">
          Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Here's what's happening across your farms today.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.id} data={kpi} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <EggProductionChart />
        <RevenueExpensesChart />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <FeedConsumptionChart />
        <PoultryPopulationChart />
        <MortalityRateChart />
        <FarmComparisonChart />
        <UserGrowthChart />
        <SystemActivityChart />
      </div>
    </div>
  );
}

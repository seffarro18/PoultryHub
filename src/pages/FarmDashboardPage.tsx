import KpiCard from "../components/dashboard/KpiCard";
import FarmEggProductionChart from "../components/dashboard/charts/FarmEggProductionChart";
import FarmRevenueExpensesChart from "../components/dashboard/charts/FarmRevenueExpensesChart";
import FarmFeedConsumptionChart from "../components/dashboard/charts/FarmFeedConsumptionChart";
import FarmChickenPopulationChart from "../components/dashboard/charts/FarmChickenPopulationChart";
import FarmMortalityRateChart from "../components/dashboard/charts/FarmMortalityRateChart";
import FarmMonthlyProfitChart from "../components/dashboard/charts/FarmMonthlyProfitChart";
import FarmSalesTrendChart from "../components/dashboard/charts/FarmSalesTrendChart";
import { getKpiCards } from "../services/farmDashboardService";
import { useAuth } from "../context/AuthContext";

export default function FarmDashboardPage() {
  const { user } = useAuth();
  const kpis = getKpiCards();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-xl font-semibold text-[var(--color-foreground)]">
          Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">Here's how your farm is doing today.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.id} data={kpi} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <FarmEggProductionChart />
        <FarmRevenueExpensesChart />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <FarmFeedConsumptionChart />
        <FarmChickenPopulationChart />
        <FarmMortalityRateChart />
        <FarmMonthlyProfitChart />
        <FarmSalesTrendChart />
      </div>
    </div>
  );
}

import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { CalendarDays, Egg, Eye, Receipt, TrendingUp, Wallet } from "lucide-react";
import StatTile from "@poultryhub/shared/components/production/StatTile";
import SaleDetailsModal from "@poultryhub/shared/components/finance/SaleDetailsModal";
import { summarizeSaleItems } from "@poultryhub/shared/services/salesExpensesService";
import RevenueExpensesChart from "../dashboard/charts/RevenueExpensesChart";
import FarmAmountTrendChart from "./FarmAmountTrendChart";
import {
  getFarmRecentExpenses,
  getFarmRecentSales,
  getFarmRevenueExpensesTrend,
  getFarmSalesExpensesSummary,
  getFarmSalesTrend,
  getFarmExpensesTrend,
  type AllFarmsBulkData,
} from "@poultryhub/shared/services/farmMonitoringService";
import type { SaleRecord } from "@poultryhub/shared/types/salesExpenses";

interface FarmSalesExpensesSectionProps {
  data: AllFarmsBulkData;
  farmId: string;
}

const currency = (v: number) => `₱${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default function FarmSalesExpensesSection({ data, farmId }: FarmSalesExpensesSectionProps) {
  const summary = useMemo(() => getFarmSalesExpensesSummary(data, farmId), [data, farmId]);
  const revenueExpenseTrend = useMemo(() => getFarmRevenueExpensesTrend(data, farmId), [data, farmId]);
  const salesTrend = useMemo(() => getFarmSalesTrend(data, farmId), [data, farmId]);
  const expensesTrend = useMemo(() => getFarmExpensesTrend(data, farmId), [data, farmId]);
  const recentSales = useMemo(() => getFarmRecentSales(data, farmId), [data, farmId]);
  const recentExpenses = useMemo(() => getFarmRecentExpenses(data, farmId), [data, farmId]);
  const [viewingSale, setViewingSale] = useState<SaleRecord | null>(null);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile icon={CalendarDays} label="Today's Sales" value={currency(summary.todaysSales)} />
        <StatTile icon={Wallet} label="Monthly Sales" value={currency(summary.monthlySales)} />
        <StatTile icon={Receipt} label="Today's Expenses" value={currency(summary.todaysExpenses)} />
        <StatTile icon={Receipt} label="Monthly Expenses" value={currency(summary.monthlyExpenses)} />
        <StatTile icon={TrendingUp} label="Net Profit" value={currency(summary.netProfit)} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatTile icon={Egg} label="Remaining Egg Stock" value={summary.remainingEggStock} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FarmAmountTrendChart title="Sales" subtitle="This farm's sales" data={salesTrend} color="var(--color-success)" />
        <FarmAmountTrendChart title="Expenses" subtitle="This farm's expenses" data={expensesTrend} color="var(--color-danger)" />
      </div>

      <RevenueExpensesChart data={revenueExpenseTrend} />

      <div>
        <h3 className="font-display text-sm font-semibold text-[var(--color-foreground)]">Recent Sales</h3>
        <div className="mt-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
          {recentSales.length === 0 ? (
            <div className="py-16 text-center text-sm text-[var(--color-muted)]">No sales recorded for this farm yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-muted)]">
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Items</th>
                    <th className="px-4 py-3 font-medium">Total</th>
                    <th className="px-4 py-3 font-medium">Recorded By</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSales.map((sale) => (
                    <tr key={sale.id} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="px-4 py-3 text-[var(--color-muted)]">{new Date(`${sale.saleDate}T00:00:00`).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-[var(--color-foreground)]">{sale.itemCategory}</td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{summarizeSaleItems(sale)}</td>
                      <td className="px-4 py-3 font-medium text-[var(--color-foreground)]">{currency(sale.totalAmount)}</td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{sale.recordedByName ?? "—"}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setViewingSale(sale)}
                          title="View Details"
                          className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)] hover:text-[var(--color-foreground)]"
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div>
        <h3 className="font-display text-sm font-semibold text-[var(--color-foreground)]">Recent Expenses</h3>
        <div className="mt-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
          {recentExpenses.length === 0 ? (
            <div className="py-16 text-center text-sm text-[var(--color-muted)]">No expenses recorded for this farm yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-muted)]">
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Description</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Recorded By</th>
                  </tr>
                </thead>
                <tbody>
                  {recentExpenses.map((expense) => (
                    <tr key={expense.id} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="px-4 py-3 text-[var(--color-muted)]">{new Date(`${expense.expenseDate}T00:00:00`).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-[var(--color-foreground)]">{expense.category}</td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{expense.description}</td>
                      <td className="px-4 py-3 font-medium text-[var(--color-foreground)]">{currency(expense.amount)}</td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{expense.recordedByName ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {viewingSale && <SaleDetailsModal sale={viewingSale} onClose={() => setViewingSale(null)} />}
      </AnimatePresence>
    </div>
  );
}

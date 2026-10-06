import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ChartCard from "../dashboard/ChartCard";
import {
  axisTick,
  gridProps,
  legendWrapperStyle,
  tooltipContentStyle,
  tooltipItemStyle,
  tooltipLabelStyle,
} from "../dashboard/charts/chartTheme";
import { expensesByCategory, expensesByFarm, revenueExpensesByMonth, salesByCategory, salesByFarm } from "../../services/salesExpensesService";
import type { ExpenseRecord, SaleRecord } from "../../types/salesExpenses";

const PIE_COLORS = ["var(--chart-series-1)", "var(--chart-series-2)", "var(--chart-series-3)", "var(--chart-series-4)", "var(--chart-series-5)"];

const currencyFormatter = (v: number) => `₱${Number(v).toLocaleString()}`;

interface SalesExpensesAnalyticsProps {
  sales: SaleRecord[];
  expenses: ExpenseRecord[];
  /** Super Admin's cross-farm view adds a Farm Comparison chart — meaningless on the single-farm Farm Admin page. */
  showFarmComparison?: boolean;
}

export default function SalesExpensesAnalytics({ sales, expenses, showFarmComparison = false }: SalesExpensesAnalyticsProps) {
  const trend = useMemo(() => revenueExpensesByMonth(sales, expenses), [sales, expenses]);
  const salesCategories = useMemo(() => salesByCategory(sales), [sales]);
  const expenseCategories = useMemo(() => expensesByCategory(expenses), [expenses]);
  const farmComparison = useMemo(() => {
    const revenue = salesByFarm(sales);
    const cost = expensesByFarm(expenses);
    const farms = new Map<string, string>();
    for (const r of revenue) farms.set(r.label, r.label);
    for (const c of cost) farms.set(c.label, c.label);
    return [...farms.keys()]
      .map((label) => ({
        label,
        revenue: revenue.find((r) => r.label === label)?.value ?? 0,
        expenses: cost.find((c) => c.label === label)?.value ?? 0,
      }))
      .sort((a, b) => b.revenue + b.expenses - (a.revenue + a.expenses))
      .slice(0, 10);
  }, [sales, expenses]);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <ChartCard title="Revenue vs. Expenses" subtitle="By month, last 12 months">
        {trend.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted)]">No records yet</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={currencyFormatter} width={64} />
              <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} formatter={(v) => currencyFormatter(Number(v))} />
              <Legend wrapperStyle={legendWrapperStyle} iconType="circle" iconSize={8} />
              <Bar dataKey="revenue" name="Revenue" fill="var(--color-success)" radius={[4, 4, 0, 0]} maxBarSize={20} />
              <Bar dataKey="expenses" name="Expenses" fill="var(--color-danger)" radius={[4, 4, 0, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Sales by Category" subtitle="Total revenue">
        {salesCategories.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted)]">No sales recorded yet</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={salesCategories} dataKey="value" nameKey="label" innerRadius="55%" outerRadius="80%" paddingAngle={2} stroke="var(--color-card)" strokeWidth={2}>
                {salesCategories.map((entry, i) => (
                  <Cell key={entry.label} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} formatter={(v) => currencyFormatter(Number(v))} />
              <Legend wrapperStyle={legendWrapperStyle} iconType="circle" iconSize={8} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Expenses by Category" subtitle="Total spend">
        {expenseCategories.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted)]">No expenses recorded yet</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={expenseCategories} dataKey="value" nameKey="label" innerRadius="55%" outerRadius="80%" paddingAngle={2} stroke="var(--color-card)" strokeWidth={2}>
                {expenseCategories.map((entry, i) => (
                  <Cell key={entry.label} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} formatter={(v) => currencyFormatter(Number(v))} />
              <Legend wrapperStyle={legendWrapperStyle} iconType="circle" iconSize={8} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {showFarmComparison && (
        <ChartCard title="Farm Comparison" subtitle="Revenue vs. expenses per farm" height={Math.max(200, farmComparison.length * 36)}>
          {farmComparison.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted)]">No records yet</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={farmComparison} layout="vertical" margin={{ top: 8, right: 24, bottom: 0, left: 8 }}>
                <CartesianGrid {...gridProps} horizontal={false} vertical />
                <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} tickFormatter={currencyFormatter} />
                <YAxis type="category" dataKey="label" tick={axisTick} axisLine={false} tickLine={false} width={110} />
                <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} formatter={(v) => currencyFormatter(Number(v))} />
                <Legend wrapperStyle={legendWrapperStyle} iconType="circle" iconSize={8} />
                <Bar dataKey="revenue" name="Revenue" fill="var(--color-success)" radius={[0, 4, 4, 0]} maxBarSize={14} />
                <Bar dataKey="expenses" name="Expenses" fill="var(--color-danger)" radius={[0, 4, 4, 0]} maxBarSize={14} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      )}
    </div>
  );
}

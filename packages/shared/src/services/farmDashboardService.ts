import { Bell, Bird, CalendarDays, CalendarRange, Egg, ListChecks, Pill, Receipt, TrendingDown, TrendingUp, Wallet, Wheat } from "lucide-react";
import { supabase } from "./supabaseClient";
import { aggregateByDay as aggregateEggByDay, aggregateByMonth as aggregateEggByMonth, aggregateByWeek as aggregateEggByWeek, listEggProductionRecords, summarizePeriods } from "./eggProductionService";
import { currentStockByFarm, currentStockByType, listInventoryEvents } from "./poultryInventoryService";
import {
  aggregateFeedByDay,
  formatUnitSummary,
  listFeedBatches,
  listFeedDistributionRecords,
  listVitaminBatches,
  lowStockFeeds,
  lowStockVitamins,
} from "./feedVitaminService";
import { listMortalityRecords } from "./mortalityRecordService";
import { getUnreadCount, listNotifications } from "./notificationService";
import { listExpenses, listSales, revenueExpensesByMonth, totalExpenses, totalSales, type RevenueExpensePoint } from "./salesExpensesService";
import { computeTrend, countByDay } from "../lib/trend";
import type { CategorySlice, KpiCardData, KpiStatus, SeriesPoint } from "../types/dashboard";
import type { EggProductionRecord } from "../types/eggProduction";
import type { PoultryEvent } from "../types/poultryInventory";
import type { FeedBatch, FeedDistributionRecord, VitaminBatch } from "../types/feedVitamin";
import type { AppNotification } from "../types/notification";
import type { ExpenseRecord, SaleRecord } from "../types/salesExpenses";
import type { MortalityRecord } from "../types/mortality";

/**
 * Real Supabase-backed data layer for the Farm Admin dashboard, replacing the
 * earlier "Phase-1 demo" mock — same shape/reasoning as `dashboardService.ts`.
 * Every query here is automatically scoped to the caller's own farm by RLS,
 * same as every other Farm Admin page in this app — no client-side farm
 * filtering needed. Revenue/Expenses/Profit are now real, backed by the
 * `sales`/`expenses` tables — reintroduced after being dropped earlier this
 * session (no table existed at the time).
 */

export interface FarmOverview {
  todaysEggProduction: number;
  weeklyEggProduction: number;
  monthlyEggProduction: number;
  totalChickens: number;
  feedRemaining: string;
  medicineStock: string;
  mortalityCount7d: number;
  pendingTasks: number;
  notifications: number;
  revenue: number;
  expenses: number;
  profit: number;
}

export interface FarmDashboardData {
  eggRecords: EggProductionRecord[];
  events: PoultryEvent[];
  mortalityRecords: MortalityRecord[];
  feeds: FeedBatch[];
  vitamins: VitaminBatch[];
  feedDistribution: FeedDistributionRecord[];
  notifications: AppNotification[];
  unreadNotifications: number;
  pendingApprovals: number;
  sales: SaleRecord[];
  expenses: ExpenseRecord[];
}

const PENDING_TABLES = ["egg_production", "feed_distribution", "vitamin_administration", "health_records", "mortality_records"] as const;

/** Real cross-module count, RLS-scoped to the caller's own farm automatically — count-only queries, no row data transferred. */
export async function countPendingApprovals(): Promise<number> {
  const results = await Promise.all(
    PENDING_TABLES.map((table) => supabase.from(table).select("id", { count: "exact", head: true }).eq("status", "pending"))
  );
  return results.reduce((sum, r) => sum + (r.count ?? 0), 0);
}

export async function fetchFarmDashboardData(): Promise<FarmDashboardData> {
  const [eggRecords, events, mortalityRecords, feeds, vitamins, feedDistribution, notifications, unreadNotifications, pendingApprovals, sales, expenses] = await Promise.all([
    listEggProductionRecords(),
    listInventoryEvents(),
    listMortalityRecords(),
    listFeedBatches(),
    listVitaminBatches(),
    listFeedDistributionRecords(),
    listNotifications(),
    getUnreadCount(),
    countPendingApprovals(),
    listSales(),
    listExpenses(),
  ]);
  return { eggRecords, events, mortalityRecords, feeds, vitamins, feedDistribution, notifications, unreadNotifications, pendingApprovals, sales, expenses };
}

export function getFarmOverview(data: FarmDashboardData): FarmOverview {
  const { dailyTotal, weeklyTotal, monthlyTotal } = summarizePeriods(data.eggRecords);
  const totalChickens = currentStockByFarm(data.events, data.mortalityRecords).reduce((sum, f) => sum + f.totalStock, 0);

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const mortalityCount7d = data.mortalityRecords
    .filter((r) => r.status === "approved" && new Date(`${r.recordDate}T00:00:00`) >= sevenDaysAgo)
    .reduce((sum, r) => sum + r.deadBirds, 0);

  const revenue = totalSales(data.sales);
  const expenses = totalExpenses(data.expenses);

  return {
    todaysEggProduction: dailyTotal,
    weeklyEggProduction: weeklyTotal,
    monthlyEggProduction: monthlyTotal,
    totalChickens,
    feedRemaining: formatUnitSummary(data.feeds),
    medicineStock: formatUnitSummary(data.vitamins),
    mortalityCount7d,
    pendingTasks: data.pendingApprovals,
    notifications: data.unreadNotifications,
    revenue,
    expenses,
    profit: revenue - expenses,
  };
}

export function getKpiCards(data: FarmDashboardData): KpiCardData[] {
  const o = getFarmOverview(data);

  const eggDaily = aggregateEggByDay(data.eggRecords);
  const eggDailySparkline = eggDaily.map((p) => p.collected);
  const recentAvg = eggDaily.length > 1 ? eggDaily.slice(0, -1).reduce((s, p) => s + p.collected, 0) / (eggDaily.length - 1) : 0;
  const todaysEggStatus: KpiStatus = recentAvg > 0 && o.todaysEggProduction < 0.7 * recentAvg ? "warning" : "good";

  const eggWeeklySparkline = aggregateEggByWeek(data.eggRecords).map((p) => p.collected);
  const eggMonthlySparkline = aggregateEggByMonth(data.eggRecords).map((p) => p.collected);
  const notificationSparkline = countByDay(data.notifications.map((n) => n.createdAt), 14).map((p) => p.value);

  const feedIsLow = lowStockFeeds(data.feeds).length > 0;
  const vitaminsAreLow = lowStockVitamins(data.vitamins).length > 0;
  const revenueExpenseTrend = revenueExpensesByMonth(data.sales, data.expenses);
  const profitSparkline = revenueExpenseTrend.map((p) => p.revenue - p.expenses);

  return [
    {
      id: "todays-egg-production",
      label: "Today's Egg Production",
      value: o.todaysEggProduction.toLocaleString(),
      icon: Egg,
      status: todaysEggStatus,
      ...computeTrend(eggDailySparkline),
    },
    {
      id: "weekly-production",
      label: "Weekly Production",
      value: o.weeklyEggProduction.toLocaleString(),
      icon: CalendarRange,
      status: "good",
      ...computeTrend(eggWeeklySparkline),
    },
    {
      id: "monthly-production",
      label: "Monthly Production",
      value: o.monthlyEggProduction.toLocaleString(),
      icon: CalendarDays,
      status: "good",
      ...computeTrend(eggMonthlySparkline),
    },
    {
      id: "total-chickens",
      label: "Total Chickens",
      value: o.totalChickens.toLocaleString(),
      icon: Bird,
      status: "good",
    },
    {
      id: "feed-remaining",
      label: "Feed Remaining",
      value: o.feedRemaining,
      icon: Wheat,
      status: feedIsLow ? "critical" : "good",
    },
    {
      id: "medicine-stock",
      label: "Medicine Stock",
      value: o.medicineStock,
      icon: Pill,
      status: vitaminsAreLow ? "critical" : "good",
    },
    {
      id: "mortality-count",
      label: "Mortality (7d)",
      value: o.mortalityCount7d.toLocaleString(),
      icon: TrendingDown,
      status: o.mortalityCount7d > 0 ? "warning" : "good",
    },
    {
      id: "pending-tasks",
      label: "Pending Tasks",
      value: o.pendingTasks.toLocaleString(),
      icon: ListChecks,
      status: o.pendingTasks > 0 ? "warning" : "good",
    },
    {
      id: "notifications",
      label: "Notifications",
      value: o.notifications.toLocaleString(),
      icon: Bell,
      status: o.notifications > 10 ? "warning" : "good",
      ...computeTrend(notificationSparkline, "down"),
    },
    {
      id: "revenue",
      label: "Revenue",
      value: `₱${o.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      icon: Wallet,
      status: "good",
      ...computeTrend(revenueExpenseTrend.map((p) => p.revenue)),
    },
    {
      id: "expenses",
      label: "Expenses",
      value: `₱${o.expenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      icon: Receipt,
      status: "good",
      ...computeTrend(revenueExpenseTrend.map((p) => p.expenses), "down"),
    },
    {
      id: "profit",
      label: "Profit",
      value: `₱${o.profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      icon: TrendingUp,
      status: o.profit >= 0 ? "good" : "critical",
      ...computeTrend(profitSparkline),
    },
  ];
}

export function getEggProductionTrend(data: FarmDashboardData): SeriesPoint[] {
  return aggregateEggByDay(data.eggRecords).map((p) => ({ label: p.period, value: p.collected }));
}

export function getFeedConsumption(data: FarmDashboardData): SeriesPoint[] {
  return aggregateFeedByDay(data.feedDistribution);
}

export const MORTALITY_TARGET_RATE = 0.3;

/** Monthly mortality rate — approved mortality_records (dead birds) over current total stock, last 12 months with data. */
export function getMortalityRate(data: FarmDashboardData): SeriesPoint[] {
  const totalStock = currentStockByFarm(data.events, data.mortalityRecords).reduce((sum, f) => sum + f.totalStock, 0);
  if (totalStock <= 0) return [];

  const buckets = new Map<string, number>();
  for (const record of data.mortalityRecords) {
    if (record.status !== "approved") continue;
    const key = record.recordDate.slice(0, 7);
    buckets.set(key, (buckets.get(key) ?? 0) + record.deadBirds);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([key, qty]) => ({
      label: new Date(`${key}-01T00:00:00`).toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
      value: Math.round((qty / totalStock) * 1000) / 10,
    }));
}

export function getChickenPopulation(data: FarmDashboardData): CategorySlice[] {
  const byType = currentStockByType(data.events, data.mortalityRecords);
  return Object.entries(byType)
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({ name, value }));
}

export function getRevenueExpenses(data: FarmDashboardData): RevenueExpensePoint[] {
  return revenueExpensesByMonth(data.sales, data.expenses);
}

import { Bell, Bird, CalendarDays, Egg, Receipt, UserCog, Users, UsersRound, Wallet, Warehouse, Wheat } from "lucide-react";
import { supabase } from "./supabaseClient";
import { listUsers, type ManagedUser } from "./userManagementService";
import {
  aggregateByDay as aggregateEggByDay,
  aggregateByFarm,
  aggregateByMonth as aggregateEggByMonth,
  listEggProductionRecords,
  summarizePeriods,
} from "./eggProductionService";
import { currentStockByFarm, currentStockByType, listInventoryEvents } from "./poultryInventoryService";
import { aggregateFeedByDay, formatUnitSummary, listFeedBatches, listFeedDistributionRecords, lowStockFeeds } from "./feedVitaminService";
import { listMortalityRecords } from "./mortalityRecordService";
import { listAuditLogs } from "./auditLogService";
import { getUnreadCount, listNotifications } from "./notificationService";
import { listExpenses, listSales, revenueExpensesByMonth, totalExpenses, totalSales, type RevenueExpensePoint } from "./salesExpensesService";
import { computeTrend, countByDay } from "../lib/trend";
import type { CategorySlice, DashboardOverview, KpiCardData, KpiStatus, SeriesPoint } from "../types/dashboard";
import type { EggProductionRecord } from "../types/eggProduction";
import type { PoultryEvent } from "../types/poultryInventory";
import type { FeedBatch, FeedDistributionRecord } from "../types/feedVitamin";
import type { AuditLogEntry } from "../types/auditLog";
import type { AppNotification } from "../types/notification";
import type { ExpenseRecord, SaleRecord } from "../types/salesExpenses";
import type { MortalityRecord } from "../types/mortality";

/**
 * Real Supabase-backed dashboard data layer, replacing the earlier "Phase-1
 * demo" mock. One bundled fetch (`fetchDashboardData`) up front, then every
 * KPI/chart getter below is a pure, synchronous function over that bundle —
 * same shape as every other aggregation helper in this app (e.g.
 * `eggProductionService.aggregateByFarm`), and lets every chart component
 * become prop-driven instead of each doing its own fetch.
 *
 * Revenue/Expenses/Profit are now real, backed by the `sales`/`expenses`
 * tables — reintroduced after being deliberately dropped earlier this
 * session (no table existed yet at the time).
 */

interface FarmRow {
  id: string;
  name: string;
  status: string;
  created_at: string;
}

export interface DashboardData {
  farms: FarmRow[];
  users: ManagedUser[];
  eggRecords: EggProductionRecord[];
  events: PoultryEvent[];
  mortalityRecords: MortalityRecord[];
  feeds: FeedBatch[];
  feedDistribution: FeedDistributionRecord[];
  auditLogs: AuditLogEntry[];
  notifications: AppNotification[];
  unreadNotifications: number;
  sales: SaleRecord[];
  expenses: ExpenseRecord[];
}

export async function fetchDashboardData(): Promise<DashboardData> {
  const [farmsRes, users, eggRecords, events, mortalityRecords, feeds, feedDistribution, auditLogs, notifications, unreadNotifications, sales, expenses] = await Promise.all([
    supabase.from("farms").select("id, name, status, created_at"),
    listUsers(),
    listEggProductionRecords(),
    listInventoryEvents(),
    listMortalityRecords(),
    listFeedBatches(),
    listFeedDistributionRecords(),
    listAuditLogs(),
    listNotifications(),
    getUnreadCount(),
    listSales(),
    listExpenses(),
  ]);
  if (farmsRes.error) throw farmsRes.error;

  return {
    farms: (farmsRes.data ?? []) as FarmRow[],
    users,
    eggRecords,
    events,
    mortalityRecords,
    feeds,
    feedDistribution,
    auditLogs,
    notifications,
    unreadNotifications,
    sales,
    expenses,
  };
}

export function getDashboardOverview(data: DashboardData): DashboardOverview {
  const activeManagers = data.users.filter((u) => u.role === "Manager" && u.status === "active").length;
  const activeStaff = data.users.filter((u) => u.role === "Staff" && u.status === "active").length;
  const { dailyTotal, monthlyTotal } = summarizePeriods(data.eggRecords);
  const totalPoultryPopulation = currentStockByFarm(data.events, data.mortalityRecords).reduce((sum, f) => sum + f.totalStock, 0);

  return {
    totalFarms: data.farms.length,
    totalUsers: data.users.length,
    activeManagers,
    activeStaff,
    todaysEggProduction: dailyTotal,
    monthlyEggProduction: monthlyTotal,
    totalPoultryPopulation,
    activeNotifications: data.unreadNotifications,
  };
}

export function getKpiCards(data: DashboardData): KpiCardData[] {
  const o = getDashboardOverview(data);

  const farmSparkline = countByDay(data.farms.map((f) => f.created_at), 14).map((p) => p.value);
  const userSparkline = countByDay(data.users.map((u) => u.createdAt), 14).map((p) => p.value);

  const eggDaily = aggregateEggByDay(data.eggRecords);
  const eggDailySparkline = eggDaily.map((p) => p.collected);
  const recentAvg = eggDaily.length > 1 ? eggDaily.slice(0, -1).reduce((s, p) => s + p.collected, 0) / (eggDaily.length - 1) : 0;
  const todaysEggStatus: KpiStatus = recentAvg > 0 && o.todaysEggProduction < 0.7 * recentAvg ? "warning" : "good";

  const eggMonthlySparkline = aggregateEggByMonth(data.eggRecords).map((p) => p.collected);

  const notificationSparkline = countByDay(data.notifications.map((n) => n.createdAt), 14).map((p) => p.value);

  const feedIsLow = lowStockFeeds(data.feeds).length > 0;
  const revenueExpenseTrend = revenueExpensesByMonth(data.sales, data.expenses);

  return [
    {
      id: "total-farms",
      label: "Total Farms",
      value: o.totalFarms.toLocaleString(),
      icon: Warehouse,
      status: "good",
      ...computeTrend(farmSparkline),
    },
    {
      id: "total-users",
      label: "Total Users",
      value: o.totalUsers.toLocaleString(),
      icon: Users,
      status: "good",
      ...computeTrend(userSparkline),
    },
    {
      id: "active-managers",
      label: "Active Managers",
      value: o.activeManagers.toLocaleString(),
      icon: UserCog,
      status: "good",
    },
    {
      id: "active-staff",
      label: "Active Staff",
      value: o.activeStaff.toLocaleString(),
      icon: UsersRound,
      status: "good",
    },
    {
      id: "todays-egg-production",
      label: "Today's Egg Production",
      value: o.todaysEggProduction.toLocaleString(),
      icon: Egg,
      status: todaysEggStatus,
      ...computeTrend(eggDailySparkline),
    },
    {
      id: "monthly-egg-production",
      label: "Monthly Egg Production",
      value: o.monthlyEggProduction.toLocaleString(),
      icon: CalendarDays,
      status: "good",
      ...computeTrend(eggMonthlySparkline),
    },
    {
      id: "total-poultry-population",
      label: "Total Poultry Population",
      value: o.totalPoultryPopulation.toLocaleString(),
      icon: Bird,
      status: "good",
    },
    {
      id: "feed-stock-remaining",
      label: "Feed Stock Remaining",
      value: formatUnitSummary(data.feeds),
      icon: Wheat,
      status: feedIsLow ? "critical" : "good",
    },
    {
      id: "active-notifications",
      label: "Active Notifications",
      value: o.activeNotifications.toLocaleString(),
      icon: Bell,
      status: o.activeNotifications > 10 ? "warning" : "good",
      ...computeTrend(notificationSparkline, "down"),
    },
    {
      id: "revenue",
      label: "Revenue",
      value: `₱${totalSales(data.sales).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      icon: Wallet,
      status: "good",
      ...computeTrend(revenueExpenseTrend.map((p) => p.revenue)),
    },
    {
      id: "expenses",
      label: "Expenses",
      value: `₱${totalExpenses(data.expenses).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      icon: Receipt,
      status: "good",
      ...computeTrend(revenueExpenseTrend.map((p) => p.expenses), "down"),
    },
  ];
}

export function getEggProductionTrend(data: DashboardData, period: "daily" | "monthly"): SeriesPoint[] {
  const points = period === "daily" ? aggregateEggByDay(data.eggRecords) : aggregateEggByMonth(data.eggRecords);
  return points.map((p) => ({ label: p.period, value: p.collected }));
}

export function getFeedConsumption(data: DashboardData): SeriesPoint[] {
  return aggregateFeedByDay(data.feedDistribution);
}

export function getPoultryPopulationBreakdown(data: DashboardData): CategorySlice[] {
  const byType = currentStockByType(data.events, data.mortalityRecords);
  return Object.entries(byType)
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({ name, value }));
}

export const MORTALITY_TARGET_RATE = 0.5;

/** Monthly mortality rate — approved mortality_records (dead birds) over current total stock, last 12 months with data. */
export function getMortalityRate(data: DashboardData): SeriesPoint[] {
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

export function getFarmComparison(data: DashboardData): SeriesPoint[] {
  return aggregateByFarm(data.eggRecords)
    .slice(0, 10)
    .map((f) => ({ label: f.farmName, value: f.totalCollected }));
}

/** Cumulative registered-user count by month — includes every month before the displayed window in the running total. */
export function getUserGrowth(data: DashboardData): SeriesPoint[] {
  const signupsByMonth = new Map<string, number>();
  for (const u of data.users) {
    const key = u.createdAt.slice(0, 7);
    signupsByMonth.set(key, (signupsByMonth.get(key) ?? 0) + 1);
  }
  const months = [...signupsByMonth.keys()].sort();
  let cumulative = 0;
  const points = months.map((key) => {
    cumulative += signupsByMonth.get(key) ?? 0;
    return { label: new Date(`${key}-01T00:00:00`).toLocaleDateString(undefined, { month: "short", year: "2-digit" }), value: cumulative };
  });
  return points.slice(-12);
}

export function getSystemActivity(data: DashboardData): SeriesPoint[] {
  return countByDay(data.auditLogs.map((l) => l.createdAt), 7);
}

export function getRevenueExpenses(data: DashboardData): RevenueExpensePoint[] {
  return revenueExpensesByMonth(data.sales, data.expenses);
}

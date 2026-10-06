import { Bird, CalendarDays, CalendarRange, Egg, ListChecks, PackageCheck, Pill, Receipt, TrendingDown, TrendingUp, Wallet, Wheat } from "lucide-react";
import { supabase } from "./supabaseClient";
import {
  aggregateByDay as aggregateEggByDay,
  aggregateByMonth as aggregateEggByMonth,
  aggregateByWeek as aggregateEggByWeek,
  computeRemainingEggStock,
  getRemainingEggStockForFarm,
  listEggProductionRecords,
  summarizePeriods,
} from "./eggProductionService";
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
import { listExpenses, listSales, revenueExpensesByMonth, totalExpenses, totalSales, type RevenueExpensePoint } from "./salesExpensesService";
import { listTasks } from "./taskService";
import { computeTrend } from "../lib/trend";
import type { CategorySlice, KpiCardData, KpiStatus, SeriesPoint } from "../types/dashboard";
import type { EggProductionRecord } from "../types/eggProduction";
import type { PoultryEvent } from "../types/poultryInventory";
import type { FeedBatch, FeedDistributionRecord, VitaminBatch } from "../types/feedVitamin";
import type { ExpenseRecord, SaleRecord } from "../types/salesExpenses";
import type { MortalityRecord } from "../types/mortality";
import type { Task } from "../types/task";

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
  remainingEggs: number;
  totalChickens: number;
  feedRemaining: string;
  medicineStock: string;
  mortalityCount7d: number;
  pendingTasks: number;
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
  tasks: Task[];
  sales: SaleRecord[];
  expenses: ExpenseRecord[];
}

const PENDING_TABLES = ["egg_production", "feed_distribution", "vitamin_administration", "health_records", "mortality_records"] as const;

/** Real cross-module count, RLS-scoped to the caller's own farm automatically — count-only queries, no row data transferred. Powers FarmAuditLogsPage's own "Pending Approvals" stat tile, a distinct concept from the Dashboard's "Pending Tasks" card (that one now reads the actual `tasks` table below). */
export async function countPendingApprovals(): Promise<number> {
  const results = await Promise.all(
    PENDING_TABLES.map((table) => supabase.from(table).select("id", { count: "exact", head: true }).eq("status", "pending"))
  );
  return results.reduce((sum, r) => sum + (r.count ?? 0), 0);
}

/** Never lets one module's failure take down the rest — logs it and degrades to `fallback` instead of rejecting, so a single bad query (RLS denial, transient network error, a table momentarily missing from PostgREST's schema cache) can't block every other card from rendering with real data. */
function safe<T>(promise: Promise<T>, label: string, fallback: T): Promise<T> {
  return promise.catch((err: unknown) => {
    console.error(`[farmDashboardService] ${label} failed to load:`, err);
    return fallback;
  });
}

/**
 * Same resilience as safe(), but for fields where "0"/"empty" is itself a
 * meaningful, real value (stock quantities) — collapsing a failed fetch
 * into the same `[]` a genuinely-empty farm would return makes "no stock"
 * and "couldn't check stock" indistinguishable, which is exactly what the
 * Staff Dashboard must not do for Feed/Vitamin stock. Returns null instead,
 * so callers can render a distinct "unavailable, retry" state.
 */
function safeOrNull<T>(promise: Promise<T>, label: string): Promise<T | null> {
  return promise.catch((err: unknown) => {
    console.error(`[farmDashboardService] ${label} failed to load:`, err);
    return null;
  });
}

export async function fetchFarmDashboardData(): Promise<FarmDashboardData> {
  const [eggRecords, events, mortalityRecords, feeds, vitamins, feedDistribution, tasks, sales, expenses] = await Promise.all([
    safe(listEggProductionRecords(), "egg production", []),
    safe(listInventoryEvents(), "poultry inventory events", []),
    safe(listMortalityRecords(), "mortality records", []),
    safe(listFeedBatches(), "feed batches", []),
    safe(listVitaminBatches(), "vitamin batches", []),
    safe(listFeedDistributionRecords(), "feed distribution", []),
    safe(listTasks(), "tasks", []),
    safe(listSales(), "sales", []),
    safe(listExpenses(), "expenses", []),
  ]);
  return { eggRecords, events, mortalityRecords, feeds, vitamins, feedDistribution, tasks, sales, expenses };
}

/** Only egg_production rows that actually cleared review — matches how every other page in this app (FarmEggProductionPage's own charts/reports, EggReportsSection) already treats "official" production, the Dashboard just hadn't been following it. */
function approvedEggRecords(data: FarmDashboardData): EggProductionRecord[] {
  return data.eggRecords.filter((r) => r.status === "approved");
}

export function getFarmOverview(data: FarmDashboardData): FarmOverview {
  const { dailyTotal, weeklyTotal, monthlyTotal } = summarizePeriods(approvedEggRecords(data));
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
    remainingEggs: computeRemainingEggStock(data.eggRecords, data.sales),
    totalChickens,
    feedRemaining: formatUnitSummary(data.feeds),
    medicineStock: formatUnitSummary(data.vitamins),
    mortalityCount7d,
    pendingTasks: data.tasks.filter((t) => t.status !== "completed").length,
    revenue,
    expenses,
    profit: revenue - expenses,
  };
}

export function getKpiCards(data: FarmDashboardData): KpiCardData[] {
  const o = getFarmOverview(data);
  const approvedEggs = approvedEggRecords(data);

  const eggDaily = aggregateEggByDay(approvedEggs);
  const eggDailySparkline = eggDaily.map((p) => p.collected);
  const recentAvg = eggDaily.length > 1 ? eggDaily.slice(0, -1).reduce((s, p) => s + p.collected, 0) / (eggDaily.length - 1) : 0;
  const todaysEggStatus: KpiStatus = recentAvg > 0 && o.todaysEggProduction < 0.7 * recentAvg ? "warning" : "good";

  const eggWeeklySparkline = aggregateEggByWeek(approvedEggs).map((p) => p.collected);
  const eggMonthlySparkline = aggregateEggByMonth(approvedEggs).map((p) => p.collected);

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
      id: "remaining-eggs",
      label: "Remaining Eggs",
      value: o.remainingEggs.toLocaleString(),
      caption: "Available for Sale",
      icon: PackageCheck,
      status: "good",
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
  return aggregateEggByDay(approvedEggRecords(data)).map((p) => ({ label: p.period, value: p.collected }));
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

// ── Staff Dashboard — operational-only, no financial data fetched ──────────
// Staff must never see Revenue/Expenses/Profit or any ₱ amount (egg prices,
// purchase costs, etc.) — not just hidden in the UI, but never requested in
// the first place. This is a deliberately separate data shape from
// FarmDashboardData rather than a filtered view of it: it never calls
// listSales()/listExpenses() (RLS already denies Staff those tables anyway,
// see 0001_07_sales_expenses.sql) and gets "Remaining Eggs" from the
// get_remaining_egg_stock() RPC instead of reading sale_items directly,
// since those rows carry unit_price/line_total.

export interface StaffDashboardData {
  eggRecords: EggProductionRecord[];
  events: PoultryEvent[];
  mortalityRecords: MortalityRecord[];
  /** null = the fetch itself failed — distinct from a farm that genuinely has no batches yet ([]). */
  feeds: FeedBatch[] | null;
  vitamins: VitaminBatch[] | null;
  tasks: Task[];
  remainingEggs: number;
}

export interface StaffOverview {
  todaysEggProduction: number;
  weeklyEggProduction: number;
  monthlyEggProduction: number;
  remainingEggs: number;
  totalLayers: number;
  /** null = couldn't load (show "Unavailable" + retry), never collapsed into "0". */
  feedRemaining: string | null;
  medicineStock: string | null;
  pendingTasks: number;
}

export async function fetchStaffDashboardData(farmId: string): Promise<StaffDashboardData> {
  const [eggRecords, events, mortalityRecords, feeds, vitamins, tasks, remainingEggs] = await Promise.all([
    safe(listEggProductionRecords(), "egg production", []),
    safe(listInventoryEvents(), "poultry inventory events", []),
    safe(listMortalityRecords(), "mortality records", []),
    safeOrNull(listFeedBatches(), "feed batches"),
    safeOrNull(listVitaminBatches(), "vitamin batches"),
    safe(listTasks(), "tasks", []),
    safe(getRemainingEggStockForFarm(farmId), "remaining egg stock", 0),
  ]);
  return { eggRecords, events, mortalityRecords, feeds, vitamins, tasks, remainingEggs };
}

function approvedStaffEggRecords(data: StaffDashboardData): EggProductionRecord[] {
  return data.eggRecords.filter((r) => r.status === "approved");
}

export function getStaffOverview(data: StaffDashboardData): StaffOverview {
  const { dailyTotal, weeklyTotal, monthlyTotal } = summarizePeriods(approvedStaffEggRecords(data));
  const totalLayers = currentStockByFarm(data.events, data.mortalityRecords).reduce((sum, f) => sum + f.totalStock, 0);
  return {
    todaysEggProduction: dailyTotal,
    weeklyEggProduction: weeklyTotal,
    monthlyEggProduction: monthlyTotal,
    remainingEggs: data.remainingEggs,
    totalLayers,
    feedRemaining: data.feeds === null ? null : formatUnitSummary(data.feeds),
    medicineStock: data.vitamins === null ? null : formatUnitSummary(data.vitamins),
    pendingTasks: data.tasks.filter((t) => t.status !== "completed").length,
  };
}

/** True when any stock field failed to load — StaffDashboardPage shows a dedicated "couldn't load, retry" notice whenever this is true, instead of letting the KPI cards' own "Unavailable" value be the only sign something's wrong. */
export function hasStaffDataGap(data: StaffDashboardData): boolean {
  return data.feeds === null || data.vitamins === null;
}

export function getStaffKpiCards(data: StaffDashboardData): KpiCardData[] {
  const o = getStaffOverview(data);
  const approvedEggs = approvedStaffEggRecords(data);

  const eggDailySparkline = aggregateEggByDay(approvedEggs).map((p) => p.collected);
  const eggWeeklySparkline = aggregateEggByWeek(approvedEggs).map((p) => p.collected);
  const eggMonthlySparkline = aggregateEggByMonth(approvedEggs).map((p) => p.collected);

  const feedIsLow = data.feeds !== null && lowStockFeeds(data.feeds).length > 0;
  const vitaminsAreLow = data.vitamins !== null && lowStockVitamins(data.vitamins).length > 0;

  return [
    {
      id: "todays-egg-production",
      label: "Today's Egg Production",
      value: o.todaysEggProduction.toLocaleString(),
      icon: Egg,
      status: "good",
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
      id: "remaining-eggs",
      label: "Remaining Eggs",
      value: o.remainingEggs.toLocaleString(),
      caption: "Operational Egg Inventory",
      icon: PackageCheck,
      status: "good",
    },
    {
      id: "total-layers",
      label: "Total Layers",
      value: o.totalLayers.toLocaleString(),
      icon: Bird,
      status: "good",
    },
    {
      id: "feed-remaining",
      label: "Feed Remaining",
      value: o.feedRemaining ?? "Unavailable",
      caption: o.feedRemaining === null ? "Couldn't load — tap Retry below" : undefined,
      icon: Wheat,
      status: o.feedRemaining === null ? "critical" : feedIsLow ? "critical" : "good",
    },
    {
      id: "vitamin-stock",
      label: "Vitamin Stock",
      value: o.medicineStock ?? "Unavailable",
      caption: o.medicineStock === null ? "Couldn't load — tap Retry below" : undefined,
      icon: Pill,
      status: o.medicineStock === null ? "critical" : vitaminsAreLow ? "critical" : "good",
    },
    {
      id: "pending-tasks",
      label: "Pending Tasks",
      value: o.pendingTasks.toLocaleString(),
      icon: ListChecks,
      status: o.pendingTasks > 0 ? "warning" : "good",
    },
  ];
}

export function getStaffEggProductionTrend(data: StaffDashboardData): SeriesPoint[] {
  return aggregateEggByDay(approvedStaffEggRecords(data)).map((p) => ({ label: p.period, value: p.collected }));
}

import { Bird, CalendarDays, CalendarRange, Egg, ListChecks, PackageCheck, Pill, Receipt, TrendingUp, Wallet, Wheat } from "lucide-react";
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
import { getProductionSettings } from "./eggPricingService";
import { computeTrend } from "../lib/trend";
import type { CategorySlice, KpiCardData, KpiStatus, SeriesPoint } from "../types/dashboard";
import type { EggProductionRecord } from "../types/eggProduction";
import type { PoultryEvent } from "../types/poultryInventory";
import { formatFeedStockTotal, type FeedBatch, type FeedConsumptionUnit, type FeedDistributionRecord, type VitaminBatch } from "../types/feedVitamin";
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
 *
 * Every source list is `T[] | null` — null means the fetch itself failed,
 * distinct from a farm that genuinely has none yet ([]). Every KPI/overview
 * field derived from a failed source is also null, cascading through to a
 * dedicated "Unavailable — tap Retry below" card (see `unavailableCard`
 * below), never collapsed into a bare, indistinguishable 0.
 */

export interface FarmOverview {
  todaysEggProduction: number | null;
  weeklyEggProduction: number | null;
  monthlyEggProduction: number | null;
  remainingEggs: number | null;
  totalLayers: number | null;
  feedRemaining: string | null;
  vitaminStock: string | null;
  pendingTasks: number | null;
  revenue: number | null;
  expenses: number | null;
  profit: number | null;
}

export interface FarmDashboardData {
  eggRecords: EggProductionRecord[] | null;
  events: PoultryEvent[] | null;
  mortalityRecords: MortalityRecord[] | null;
  feeds: FeedBatch[] | null;
  vitamins: VitaminBatch[] | null;
  feedDistribution: FeedDistributionRecord[] | null;
  tasks: Task[] | null;
  sales: SaleRecord[] | null;
  expenses: ExpenseRecord[] | null;
  /** The farm's Feed Consumption Unit — every feed figure is shown in it. null = failed to load. */
  feedUnit: FeedConsumptionUnit | null;
}

const PENDING_TABLES = ["egg_production", "feed_distribution", "vitamin_administration", "health_records", "mortality_records"] as const;

/** Real cross-module count, RLS-scoped to the caller's own farm automatically — count-only queries, no row data transferred. Powers FarmAuditLogsPage's own "Pending Approvals" stat tile, a distinct concept from the Dashboard's "Pending Tasks" card (that one now reads the actual `tasks` table below). */
export async function countPendingApprovals(): Promise<number> {
  const results = await Promise.all(
    PENDING_TABLES.map((table) => supabase.from(table).select("id", { count: "exact", head: true }).eq("status", "pending"))
  );
  return results.reduce((sum, r) => sum + (r.count ?? 0), 0);
}

/**
 * Never lets one module's failure take down the rest, and never collapses a
 * failed fetch into the same `[]`/`0` a genuinely-empty farm would return —
 * returns null instead, so every card built from it can render a distinct
 * "Unavailable, retry" state rather than a false zero.
 */
function safeOrNull<T>(promise: Promise<T>, label: string): Promise<T | null> {
  return promise.catch((err: unknown) => {
    console.error(`[farmDashboardService] ${label} failed to load:`, err);
    return null;
  });
}

/** The farm-wide Feed Consumption Unit (production_settings). Every farm has a row (0021); the column defaults to sack (0052). */
function loadFeedUnit(): Promise<FeedConsumptionUnit> {
  return getProductionSettings().then((s) => s?.feedConsumptionUnit ?? "sack");
}

/** Feed stock in the farm's unit — null (shown as "Unavailable") if the batches or the setting failed to load, never a guessed unit. */
function feedRemainingText(feeds: FeedBatch[] | null, unit: FeedConsumptionUnit | null): string | null {
  return feeds === null || unit === null ? null : formatFeedStockTotal(feeds, unit);
}

/** Shared by every KPI card below whose underlying source failed to load — one consistent "something's wrong, not just zero" treatment. */
function unavailableCard(): Pick<KpiCardData, "value" | "caption" | "status"> {
  return { value: "Unavailable", caption: "Couldn't load — tap Retry below", status: "critical" };
}

export async function fetchFarmDashboardData(): Promise<FarmDashboardData> {
  const [eggRecords, events, mortalityRecords, feeds, vitamins, feedDistribution, tasks, sales, expenses, feedUnit] = await Promise.all([
    safeOrNull(listEggProductionRecords(), "egg production"),
    safeOrNull(listInventoryEvents(), "poultry inventory events"),
    safeOrNull(listMortalityRecords(), "mortality records"),
    safeOrNull(listFeedBatches(), "feed batches"),
    safeOrNull(listVitaminBatches(), "vitamin batches"),
    safeOrNull(listFeedDistributionRecords(), "feed distribution"),
    safeOrNull(listTasks(), "tasks"),
    safeOrNull(listSales(), "sales"),
    safeOrNull(listExpenses(), "expenses"),
    safeOrNull(loadFeedUnit(), "feed consumption unit"),
  ]);
  return { eggRecords, events, mortalityRecords, feeds, vitamins, feedDistribution, tasks, sales, expenses, feedUnit };
}

/** True when any source failed to load — FarmDashboardPage shows a dedicated "couldn't load, retry" notice whenever this is true, instead of letting each KPI card's own "Unavailable" value be the only sign something's wrong. */
export function hasFarmDataGap(data: FarmDashboardData): boolean {
  return (
    data.eggRecords === null ||
    data.events === null ||
    data.mortalityRecords === null ||
    data.feeds === null ||
    data.vitamins === null ||
    data.feedDistribution === null ||
    data.tasks === null ||
    data.sales === null ||
    data.expenses === null ||
    data.feedUnit === null
  );
}

/** Only egg_production rows that actually cleared review — matches how every other page in this app (FarmEggProductionPage's own charts/reports, EggReportsSection) already treats "official" production, the Dashboard just hadn't been following it. */
function approvedEggRecords(data: FarmDashboardData): EggProductionRecord[] | null {
  return data.eggRecords === null ? null : data.eggRecords.filter((r) => r.status === "approved");
}

export function getFarmOverview(data: FarmDashboardData): FarmOverview {
  const approvedEggs = approvedEggRecords(data);
  const periods = approvedEggs === null ? null : summarizePeriods(approvedEggs);

  const totalLayers =
    data.events === null || data.mortalityRecords === null
      ? null
      : currentStockByFarm(data.events, data.mortalityRecords).reduce((sum, f) => sum + f.totalStock, 0);

  const revenue = data.sales === null ? null : totalSales(data.sales);
  const expensesTotal = data.expenses === null ? null : totalExpenses(data.expenses);

  return {
    todaysEggProduction: periods?.dailyTotal ?? null,
    weeklyEggProduction: periods?.weeklyTotal ?? null,
    monthlyEggProduction: periods?.monthlyTotal ?? null,
    remainingEggs: data.eggRecords === null || data.sales === null ? null : computeRemainingEggStock(data.eggRecords, data.sales),
    totalLayers,
    feedRemaining: feedRemainingText(data.feeds, data.feedUnit),
    vitaminStock: data.vitamins === null ? null : formatUnitSummary(data.vitamins),
    pendingTasks: data.tasks === null ? null : data.tasks.filter((t) => t.status !== "completed").length,
    revenue,
    expenses: expensesTotal,
    profit: revenue === null || expensesTotal === null ? null : revenue - expensesTotal,
  };
}

export function getKpiCards(data: FarmDashboardData): KpiCardData[] {
  const o = getFarmOverview(data);
  const approvedEggs = approvedEggRecords(data);

  const eggDaily = approvedEggs === null ? null : aggregateEggByDay(approvedEggs);
  const eggDailySparkline = eggDaily?.map((p) => p.collected) ?? [];
  const recentAvg =
    eggDaily && eggDaily.length > 1 ? eggDaily.slice(0, -1).reduce((s, p) => s + p.collected, 0) / (eggDaily.length - 1) : 0;
  const todaysEggStatus: KpiStatus =
    o.todaysEggProduction !== null && recentAvg > 0 && o.todaysEggProduction < 0.7 * recentAvg ? "warning" : "good";

  const eggWeeklySparkline = approvedEggs === null ? [] : aggregateEggByWeek(approvedEggs).map((p) => p.collected);
  const eggMonthlySparkline = approvedEggs === null ? [] : aggregateEggByMonth(approvedEggs).map((p) => p.collected);

  const feedIsLow = data.feeds !== null && lowStockFeeds(data.feeds).length > 0;
  const vitaminsAreLow = data.vitamins !== null && lowStockVitamins(data.vitamins).length > 0;
  const revenueExpenseTrend = data.sales === null || data.expenses === null ? null : revenueExpensesByMonth(data.sales, data.expenses);

  return [
    {
      id: "todays-egg-production",
      label: "Today's Egg Production",
      icon: Egg,
      ...(o.todaysEggProduction === null
        ? unavailableCard()
        : { value: o.todaysEggProduction.toLocaleString(), status: todaysEggStatus, ...computeTrend(eggDailySparkline) }),
    },
    {
      id: "weekly-production",
      label: "Weekly Production",
      icon: CalendarRange,
      ...(o.weeklyEggProduction === null
        ? unavailableCard()
        : { value: o.weeklyEggProduction.toLocaleString(), status: "good" as KpiStatus, ...computeTrend(eggWeeklySparkline) }),
    },
    {
      id: "monthly-production",
      label: "Monthly Production",
      icon: CalendarDays,
      ...(o.monthlyEggProduction === null
        ? unavailableCard()
        : { value: o.monthlyEggProduction.toLocaleString(), status: "good" as KpiStatus, ...computeTrend(eggMonthlySparkline) }),
    },
    {
      id: "remaining-eggs",
      label: "Remaining Eggs",
      icon: PackageCheck,
      ...(o.remainingEggs === null
        ? unavailableCard()
        : { value: o.remainingEggs.toLocaleString(), caption: "Available for Sale", status: "good" as KpiStatus }),
    },
    {
      id: "total-layers",
      label: "Total Layers",
      icon: Bird,
      ...(o.totalLayers === null ? unavailableCard() : { value: o.totalLayers.toLocaleString(), status: "good" as KpiStatus }),
    },
    {
      id: "feed-remaining",
      label: "Feed Remaining",
      icon: Wheat,
      ...(o.feedRemaining === null
        ? unavailableCard()
        : { value: o.feedRemaining, status: (feedIsLow ? "critical" : "good") as KpiStatus }),
    },
    {
      id: "vitamin-stock",
      label: "Vitamin Stock",
      icon: Pill,
      ...(o.vitaminStock === null
        ? unavailableCard()
        : { value: o.vitaminStock, status: (vitaminsAreLow ? "critical" : "good") as KpiStatus }),
    },
    {
      id: "pending-tasks",
      label: "Pending Tasks",
      icon: ListChecks,
      ...(o.pendingTasks === null
        ? unavailableCard()
        : { value: o.pendingTasks.toLocaleString(), status: (o.pendingTasks > 0 ? "warning" : "good") as KpiStatus }),
    },
    {
      id: "revenue",
      label: "Revenue",
      icon: Wallet,
      ...(o.revenue === null
        ? unavailableCard()
        : {
            value: `₱${o.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
            status: "good" as KpiStatus,
            ...(revenueExpenseTrend ? computeTrend(revenueExpenseTrend.map((p) => p.revenue)) : {}),
          }),
    },
    {
      id: "expenses",
      label: "Expenses",
      icon: Receipt,
      ...(o.expenses === null
        ? unavailableCard()
        : {
            value: `₱${o.expenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
            status: "good" as KpiStatus,
            ...(revenueExpenseTrend ? computeTrend(revenueExpenseTrend.map((p) => p.expenses), "down") : {}),
          }),
    },
    {
      id: "profit",
      label: "Profit",
      icon: TrendingUp,
      ...(o.profit === null
        ? unavailableCard()
        : {
            value: `₱${o.profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
            status: (o.profit >= 0 ? "good" : "critical") as KpiStatus,
            ...(revenueExpenseTrend ? computeTrend(revenueExpenseTrend.map((p) => p.revenue - p.expenses)) : {}),
          }),
    },
  ];
}

export function getEggProductionTrend(data: FarmDashboardData): SeriesPoint[] {
  const approvedEggs = approvedEggRecords(data);
  return approvedEggs === null ? [] : aggregateEggByDay(approvedEggs).map((p) => ({ label: p.period, value: p.collected }));
}

export function getFeedConsumption(data: FarmDashboardData): SeriesPoint[] {
  return data.feedDistribution === null || data.feedUnit === null ? [] : aggregateFeedByDay(data.feedDistribution, data.feedUnit);
}

export const MORTALITY_TARGET_RATE = 0.3;

/** Monthly mortality rate — approved mortality_records (dead birds) over current total stock, last 12 months with data. */
export function getMortalityRate(data: FarmDashboardData): SeriesPoint[] {
  if (data.events === null || data.mortalityRecords === null) return [];
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
  if (data.events === null) return [];
  const byType = currentStockByType(data.events, data.mortalityRecords ?? []);
  return Object.entries(byType)
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({ name, value }));
}

export function getRevenueExpenses(data: FarmDashboardData): RevenueExpensePoint[] {
  return data.sales === null || data.expenses === null ? [] : revenueExpensesByMonth(data.sales, data.expenses);
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
  eggRecords: EggProductionRecord[] | null;
  events: PoultryEvent[] | null;
  mortalityRecords: MortalityRecord[] | null;
  feeds: FeedBatch[] | null;
  vitamins: VitaminBatch[] | null;
  tasks: Task[] | null;
  remainingEggs: number | null;
  feedUnit: FeedConsumptionUnit | null;
}

export interface StaffOverview {
  todaysEggProduction: number | null;
  weeklyEggProduction: number | null;
  monthlyEggProduction: number | null;
  remainingEggs: number | null;
  totalLayers: number | null;
  feedRemaining: string | null;
  vitaminStock: string | null;
  pendingTasks: number | null;
}

export async function fetchStaffDashboardData(farmId: string): Promise<StaffDashboardData> {
  const [eggRecords, events, mortalityRecords, feeds, vitamins, tasks, remainingEggs, feedUnit] = await Promise.all([
    safeOrNull(listEggProductionRecords(), "egg production"),
    safeOrNull(listInventoryEvents(), "poultry inventory events"),
    safeOrNull(listMortalityRecords(), "mortality records"),
    safeOrNull(listFeedBatches(), "feed batches"),
    safeOrNull(listVitaminBatches(), "vitamin batches"),
    safeOrNull(listTasks(), "tasks"),
    safeOrNull(getRemainingEggStockForFarm(farmId), "remaining egg stock"),
    safeOrNull(loadFeedUnit(), "feed consumption unit"),
  ]);
  return { eggRecords, events, mortalityRecords, feeds, vitamins, tasks, remainingEggs, feedUnit };
}

function approvedStaffEggRecords(data: StaffDashboardData): EggProductionRecord[] | null {
  return data.eggRecords === null ? null : data.eggRecords.filter((r) => r.status === "approved");
}

export function getStaffOverview(data: StaffDashboardData): StaffOverview {
  const approvedEggs = approvedStaffEggRecords(data);
  const periods = approvedEggs === null ? null : summarizePeriods(approvedEggs);
  const totalLayers =
    data.events === null || data.mortalityRecords === null
      ? null
      : currentStockByFarm(data.events, data.mortalityRecords).reduce((sum, f) => sum + f.totalStock, 0);
  return {
    todaysEggProduction: periods?.dailyTotal ?? null,
    weeklyEggProduction: periods?.weeklyTotal ?? null,
    monthlyEggProduction: periods?.monthlyTotal ?? null,
    remainingEggs: data.remainingEggs,
    totalLayers,
    feedRemaining: feedRemainingText(data.feeds, data.feedUnit),
    vitaminStock: data.vitamins === null ? null : formatUnitSummary(data.vitamins),
    pendingTasks: data.tasks === null ? null : data.tasks.filter((t) => t.status !== "completed").length,
  };
}

/** True when any source failed to load — StaffDashboardPage shows a dedicated "couldn't load, retry" notice whenever this is true, instead of letting the KPI cards' own "Unavailable" value be the only sign something's wrong. */
export function hasStaffDataGap(data: StaffDashboardData): boolean {
  return (
    data.eggRecords === null ||
    data.events === null ||
    data.mortalityRecords === null ||
    data.feeds === null ||
    data.vitamins === null ||
    data.tasks === null ||
    data.remainingEggs === null ||
    data.feedUnit === null
  );
}

export function getStaffKpiCards(data: StaffDashboardData): KpiCardData[] {
  const o = getStaffOverview(data);
  const approvedEggs = approvedStaffEggRecords(data);

  const eggDailySparkline = approvedEggs === null ? [] : aggregateEggByDay(approvedEggs).map((p) => p.collected);
  const eggWeeklySparkline = approvedEggs === null ? [] : aggregateEggByWeek(approvedEggs).map((p) => p.collected);
  const eggMonthlySparkline = approvedEggs === null ? [] : aggregateEggByMonth(approvedEggs).map((p) => p.collected);

  const feedIsLow = data.feeds !== null && lowStockFeeds(data.feeds).length > 0;
  const vitaminsAreLow = data.vitamins !== null && lowStockVitamins(data.vitamins).length > 0;

  return [
    {
      id: "todays-egg-production",
      label: "Today's Egg Production",
      icon: Egg,
      ...(o.todaysEggProduction === null
        ? unavailableCard()
        : { value: o.todaysEggProduction.toLocaleString(), status: "good" as KpiStatus, ...computeTrend(eggDailySparkline) }),
    },
    {
      id: "weekly-production",
      label: "Weekly Production",
      icon: CalendarRange,
      ...(o.weeklyEggProduction === null
        ? unavailableCard()
        : { value: o.weeklyEggProduction.toLocaleString(), status: "good" as KpiStatus, ...computeTrend(eggWeeklySparkline) }),
    },
    {
      id: "monthly-production",
      label: "Monthly Production",
      icon: CalendarDays,
      ...(o.monthlyEggProduction === null
        ? unavailableCard()
        : { value: o.monthlyEggProduction.toLocaleString(), status: "good" as KpiStatus, ...computeTrend(eggMonthlySparkline) }),
    },
    {
      id: "remaining-eggs",
      label: "Remaining Eggs",
      icon: PackageCheck,
      ...(o.remainingEggs === null
        ? unavailableCard()
        : { value: o.remainingEggs.toLocaleString(), caption: "Operational Egg Inventory", status: "good" as KpiStatus }),
    },
    {
      id: "total-layers",
      label: "Total Layers",
      icon: Bird,
      ...(o.totalLayers === null ? unavailableCard() : { value: o.totalLayers.toLocaleString(), status: "good" as KpiStatus }),
    },
    {
      id: "feed-remaining",
      label: "Feed Remaining",
      icon: Wheat,
      ...(o.feedRemaining === null
        ? unavailableCard()
        : { value: o.feedRemaining, status: (feedIsLow ? "critical" : "good") as KpiStatus }),
    },
    {
      id: "vitamin-stock",
      label: "Vitamin Stock",
      icon: Pill,
      ...(o.vitaminStock === null
        ? unavailableCard()
        : { value: o.vitaminStock, status: (vitaminsAreLow ? "critical" : "good") as KpiStatus }),
    },
    {
      id: "pending-tasks",
      label: "Pending Tasks",
      icon: ListChecks,
      ...(o.pendingTasks === null
        ? unavailableCard()
        : { value: o.pendingTasks.toLocaleString(), status: (o.pendingTasks > 0 ? "warning" : "good") as KpiStatus }),
    },
  ];
}

export function getStaffEggProductionTrend(data: StaffDashboardData): SeriesPoint[] {
  const approvedEggs = approvedStaffEggRecords(data);
  return approvedEggs === null ? [] : aggregateEggByDay(approvedEggs).map((p) => ({ label: p.period, value: p.collected }));
}

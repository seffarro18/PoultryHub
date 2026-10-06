import { listManagedFarms } from "./farmService";
import { listUsers, type ManagedUser } from "./userManagementService";
import {
  aggregateByDay,
  aggregateByMonth,
  aggregateByWeek,
  computeRemainingEggStock,
  listEggProductionRecords,
  summarizePeriods,
} from "./eggProductionService";
import { currentStockByType, listInventoryEvents } from "./poultryInventoryService";
import { aggregateMortalityByMonth, listMortalityRecords } from "./mortalityRecordService";
import { formatUnitSummary, listFeedBatches, listVitaminBatches, lowStockFeeds, lowStockVitamins } from "./feedVitaminService";
import {
  aggregateExpensesByDay,
  aggregateSalesByDay,
  listExpenses,
  listSales,
  revenueExpensesByMonth,
  summarizeSaleItems,
  totalExpenses,
  totalSales,
  type DailyAmountPoint,
  type RevenueExpensePoint,
} from "./salesExpensesService";
import type { SeriesPoint } from "../types/dashboard";
import type { ManagedFarm } from "../types/farm";
import type { EggProductionRecord } from "../types/eggProduction";
import type { PoultryEvent } from "../types/poultryInventory";
import type { MortalityRecord } from "../types/mortality";
import type { FeedBatch, VitaminBatch } from "../types/feedVitamin";
import type { SaleRecord, ExpenseRecord } from "../types/salesExpenses";

/**
 * Per-farm monitoring data for Super Admin's "All Farms" module — a
 * read-only drill-down, distinct from dashboardService.ts's ACROSS-all-farms
 * aggregates. Every getter below filters these same bulk arrays (RLS already
 * grants Super Admin every farm's rows, same as every other oversight page
 * in this app) down to one farmId, then calls the exact pure functions every
 * other page already uses — no new formulas, no per-farm database queries.
 */

export interface AllFarmsBulkData {
  farms: ManagedFarm[];
  users: ManagedUser[];
  eggRecords: EggProductionRecord[];
  events: PoultryEvent[];
  mortalityRecords: MortalityRecord[];
  feeds: FeedBatch[];
  vitamins: VitaminBatch[];
  sales: SaleRecord[];
  expenses: ExpenseRecord[];
}

export async function fetchAllFarmsData(): Promise<AllFarmsBulkData> {
  const [farms, users, eggRecords, events, mortalityRecords, feeds, vitamins, sales, expenses] = await Promise.all([
    listManagedFarms(),
    listUsers(),
    listEggProductionRecords(),
    listInventoryEvents(),
    listMortalityRecords(),
    listFeedBatches(),
    listVitaminBatches(),
    listSales(),
    listExpenses(),
  ]);
  return { farms, users, eggRecords, events, mortalityRecords, feeds, vitamins, sales, expenses };
}

function forFarm<T extends { farmId: string }>(records: T[], farmId: string): T[] {
  return records.filter((r) => r.farmId === farmId);
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/** Approved mortality, trailing 7 days — same cutoff/status rule as farmDashboardService.getFarmOverview's mortalityCount7d (mobile app's Farm Admin dashboard). */
function mortality7d(records: MortalityRecord[], today = new Date()): number {
  const cutoff = new Date(today.getTime() - SEVEN_DAYS_MS);
  return records
    .filter((r) => r.status === "approved" && new Date(`${r.recordDate}T00:00:00`) >= cutoff)
    .reduce((sum, r) => sum + r.deadBirds, 0);
}

function totalStock(events: PoultryEvent[], mortalityRecords: MortalityRecord[]) {
  const byType = currentStockByType(events, mortalityRecords);
  return { byType, total: Object.values(byType).reduce((sum, v) => sum + v, 0) };
}

// ── All Farms page ─────────────────────────────────────────────────────────
// The All Farms list itself is a directory (name/owner/location/admin/staff/
// status/registered) — production/inventory/sales KPIs are deliberately not
// duplicated here; they only ever appear after opening a specific farm
// (getFarmDetailOverview below), so there's nothing else to compute for this
// page beyond the plain ManagedFarm/ManagedUser records it already has.

// ── Farm Detail — Farm Overview stat block ──────────────────────────────────

interface SalesExpensesSnapshot {
  todaysSales: number;
  monthlySales: number;
  todaysExpenses: number;
  monthlyExpenses: number;
  netProfit: number;
}

/** Today's/monthly sales, expenses, and net profit for one farm — shared by the Overview KPI block and the Sales & Expenses tab so the two can never disagree. */
function salesExpensesSnapshot(data: AllFarmsBulkData, farmId: string, today = new Date()): SalesExpensesSnapshot {
  const farmSales = forFarm(data.sales, farmId);
  const farmExpenses = forFarm(data.expenses, farmId);
  const todayStr = today.toISOString().slice(0, 10);
  const monthPrefix = todayStr.slice(0, 7);
  const monthlySales = totalSales(farmSales.filter((s) => s.saleDate.slice(0, 7) === monthPrefix));
  const monthlyExpenses = totalExpenses(farmExpenses.filter((e) => e.expenseDate.slice(0, 7) === monthPrefix));

  return {
    todaysSales: totalSales(farmSales.filter((s) => s.saleDate === todayStr)),
    monthlySales,
    todaysExpenses: totalExpenses(farmExpenses.filter((e) => e.expenseDate === todayStr)),
    monthlyExpenses,
    netProfit: monthlySales - monthlyExpenses,
  };
}

export interface FarmDetailOverview {
  todaysEggProduction: number;
  weeklyEggProduction: number;
  monthlyEggProduction: number;
  remainingEggStock: number;
  totalChickens: number;
  totalLayers: number;
  feedStock: string;
  vitaminStock: string;
  mortality7d: number;
  totalStaff: number;
  todaysSales: number;
  monthlySales: number;
  todaysExpenses: number;
  monthlyExpenses: number;
  netProfit: number;
}

export function getFarmDetailOverview(data: AllFarmsBulkData, farmId: string): FarmDetailOverview {
  const farmEggRecords = forFarm(data.eggRecords, farmId);
  const approvedEggRecords = farmEggRecords.filter((r) => r.status === "approved");
  const farmMortality = forFarm(data.mortalityRecords, farmId);
  const { byType, total } = totalStock(forFarm(data.events, farmId), farmMortality);
  const { dailyTotal, weeklyTotal, monthlyTotal } = summarizePeriods(approvedEggRecords);

  return {
    todaysEggProduction: dailyTotal,
    weeklyEggProduction: weeklyTotal,
    monthlyEggProduction: monthlyTotal,
    remainingEggStock: computeRemainingEggStock(farmEggRecords, forFarm(data.sales, farmId)),
    totalChickens: total,
    totalLayers: byType.Layer ?? 0,
    feedStock: formatUnitSummary(forFarm(data.feeds, farmId)),
    vitaminStock: formatUnitSummary(forFarm(data.vitamins, farmId)),
    mortality7d: mortality7d(farmMortality),
    totalStaff: data.users.filter((u) => u.farmId === farmId && u.role === "Staff").length,
    ...salesExpensesSnapshot(data, farmId),
  };
}

// ── PRODUCTION tab ───────────────────────────────────────────────────────────

/** Daily/weekly/monthly egg production trend for one farm. */
export function getFarmEggProductionTrend(data: AllFarmsBulkData, farmId: string, period: "daily" | "weekly" | "monthly"): SeriesPoint[] {
  const approved = forFarm(data.eggRecords, farmId).filter((r) => r.status === "approved");
  const aggregate = period === "daily" ? aggregateByDay(approved) : period === "weekly" ? aggregateByWeek(approved) : aggregateByMonth(approved);
  return aggregate.map((p) => ({ label: p.period, value: p.collected }));
}

export interface FarmEggQuality {
  goodEggs: number;
  damagedCrackedEggs: number;
}

/** Approved records only — matches how Good/Damaged-Cracked are treated everywhere else in this app. */
export function getFarmEggQuality(data: AllFarmsBulkData, farmId: string): FarmEggQuality {
  const approved = forFarm(data.eggRecords, farmId).filter((r) => r.status === "approved");
  return {
    goodEggs: approved.reduce((sum, r) => sum + r.goodEggs, 0),
    damagedCrackedEggs: approved.reduce((sum, r) => sum + r.damagedCrackedEggs, 0),
  };
}

export interface FarmProductionTotals {
  totalEggsAllTime: number;
  approvedRecordCount: number;
}

/** All-time approved totals for this farm — distinct from the Overview's Today/Week/Month figures. */
export function getFarmProductionTotals(data: AllFarmsBulkData, farmId: string): FarmProductionTotals {
  const approved = forFarm(data.eggRecords, farmId).filter((r) => r.status === "approved");
  return {
    totalEggsAllTime: approved.reduce((sum, r) => sum + r.eggsCollected, 0),
    approvedRecordCount: approved.length,
  };
}

export interface HousePenProduction {
  housePen: string;
  totalEggs: number;
}

/** Approved eggs collected, grouped by this farm's own house/pen — descending. */
export function getFarmProductionByHousePen(data: AllFarmsBulkData, farmId: string): HousePenProduction[] {
  const approved = forFarm(data.eggRecords, farmId).filter((r) => r.status === "approved");
  const totals = new Map<string, number>();
  for (const r of approved) totals.set(r.housePen, (totals.get(r.housePen) ?? 0) + r.eggsCollected);
  return [...totals.entries()].map(([housePen, totalEggs]) => ({ housePen, totalEggs })).sort((a, b) => b.totalEggs - a.totalEggs);
}

/** Already ordered by production_date desc from listEggProductionRecords(). */
export function getFarmProductionRecords(data: AllFarmsBulkData, farmId: string, limit = 10): EggProductionRecord[] {
  return forFarm(data.eggRecords, farmId).slice(0, limit);
}

// ── POULTRY INVENTORY tab ────────────────────────────────────────────────────

export function getFarmFeedStock(data: AllFarmsBulkData, farmId: string): string {
  return formatUnitSummary(forFarm(data.feeds, farmId));
}

export function getFarmVitaminStock(data: AllFarmsBulkData, farmId: string): string {
  return formatUnitSummary(forFarm(data.vitamins, farmId));
}

export interface NamedStockSummary {
  name: string;
  summary: string;
}

function groupByNameSummary<T extends { unit: string; remainingStock: number }>(
  items: T[],
  nameOf: (item: T) => string
): NamedStockSummary[] {
  const byName = new Map<string, T[]>();
  for (const item of items) {
    const name = nameOf(item);
    const existing = byName.get(name);
    if (existing) existing.push(item);
    else byName.set(name, [item]);
  }
  return [...byName.entries()]
    .map(([name, group]) => ({ name, summary: formatUnitSummary(group) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Feed stock broken out by feed name (e.g. "Layer Feed: 38 sacks + 3 kg"), for this farm only. */
export function getFarmFeedBreakdown(data: AllFarmsBulkData, farmId: string): NamedStockSummary[] {
  return groupByNameSummary(forFarm(data.feeds, farmId), (f) => f.feedName);
}

/** Vitamin stock broken out by vitamin name, for this farm only. */
export function getFarmVitaminBreakdown(data: AllFarmsBulkData, farmId: string): NamedStockSummary[] {
  return groupByNameSummary(forFarm(data.vitamins, farmId), (v) => v.vitaminName);
}

export interface FarmLowStockCounts {
  feed: number;
  vitamin: number;
}

export function getFarmLowStockCounts(data: AllFarmsBulkData, farmId: string): FarmLowStockCounts {
  return {
    feed: lowStockFeeds(forFarm(data.feeds, farmId)).length,
    vitamin: lowStockVitamins(forFarm(data.vitamins, farmId)).length,
  };
}

export function getFarmMortalityTrend(data: AllFarmsBulkData, farmId: string): SeriesPoint[] {
  return aggregateMortalityByMonth(forFarm(data.mortalityRecords, farmId));
}

/** Already ordered by record_date desc from listMortalityRecords(). */
export function getFarmRecentMortality(data: AllFarmsBulkData, farmId: string, limit = 10): MortalityRecord[] {
  return forFarm(data.mortalityRecords, farmId).slice(0, limit);
}

export interface FarmPoultryStockBreakdown {
  totalChickens: number;
  layers: number;
  chicks: number;
}

export function getFarmPoultryStock(data: AllFarmsBulkData, farmId: string): FarmPoultryStockBreakdown {
  const { byType, total } = totalStock(forFarm(data.events, farmId), forFarm(data.mortalityRecords, farmId));
  return { totalChickens: total, layers: byType.Layer ?? 0, chicks: byType.Chick ?? 0 };
}

export interface FarmMortalityCounts {
  today: number;
  last7d: number;
  last30d: number;
}

function mortalitySince(records: MortalityRecord[], cutoff: Date): number {
  return records
    .filter((r) => r.status === "approved" && new Date(`${r.recordDate}T00:00:00`) >= cutoff)
    .reduce((sum, r) => sum + r.deadBirds, 0);
}

export function getFarmMortalityCounts(data: AllFarmsBulkData, farmId: string, today = new Date()): FarmMortalityCounts {
  const records = forFarm(data.mortalityRecords, farmId);
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return {
    today: mortalitySince(records, startOfDay),
    last7d: mortality7d(records, today),
    last30d: mortalitySince(records, new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)),
  };
}

// ── SALES & EXPENSES tab ─────────────────────────────────────────────────────

export interface FarmSalesExpensesSummary extends SalesExpensesSnapshot {
  remainingEggStock: number;
}

export function getFarmSalesExpensesSummary(data: AllFarmsBulkData, farmId: string, today = new Date()): FarmSalesExpensesSummary {
  return {
    ...salesExpensesSnapshot(data, farmId, today),
    remainingEggStock: computeRemainingEggStock(forFarm(data.eggRecords, farmId), forFarm(data.sales, farmId)),
  };
}

export function getFarmRevenueExpensesTrend(data: AllFarmsBulkData, farmId: string): RevenueExpensePoint[] {
  return revenueExpensesByMonth(forFarm(data.sales, farmId), forFarm(data.expenses, farmId));
}

export interface FarmDailyMonthlyTrend {
  daily: DailyAmountPoint[];
  monthly: SeriesPoint[];
}

export function getFarmSalesTrend(data: AllFarmsBulkData, farmId: string): FarmDailyMonthlyTrend {
  const farmSales = forFarm(data.sales, farmId);
  return {
    daily: aggregateSalesByDay(farmSales),
    monthly: revenueExpensesByMonth(farmSales, []).map((p) => ({ label: p.label, value: p.revenue })),
  };
}

export function getFarmExpensesTrend(data: AllFarmsBulkData, farmId: string): FarmDailyMonthlyTrend {
  const farmExpenses = forFarm(data.expenses, farmId);
  return {
    daily: aggregateExpensesByDay(farmExpenses),
    monthly: revenueExpensesByMonth([], farmExpenses).map((p) => ({ label: p.label, value: p.expenses })),
  };
}

/** Already ordered by sale_date desc from listSales(). */
export function getFarmEggSalesHistory(data: AllFarmsBulkData, farmId: string, limit = 10): SaleRecord[] {
  return forFarm(data.sales, farmId)
    .filter((s) => s.itemCategory === "Eggs")
    .slice(0, limit);
}

/** Most recent sales/expenses for this farm, newest first — feeds the Sales & Expenses tab's "Recent Sales"/"Recent Expenses" lists. */
export function getFarmRecentSales(data: AllFarmsBulkData, farmId: string, limit = 10): SaleRecord[] {
  return forFarm(data.sales, farmId).slice(0, limit);
}

export function getFarmRecentExpenses(data: AllFarmsBulkData, farmId: string, limit = 10): ExpenseRecord[] {
  return forFarm(data.expenses, farmId).slice(0, limit);
}

// ── STAFF tab ─────────────────────────────────────────────────────────────────

export interface FarmStaffRoster {
  admins: ManagedUser[];
  staff: ManagedUser[];
}

export function getFarmStaffRoster(data: AllFarmsBulkData, farmId: string): FarmStaffRoster {
  const farmUsers = data.users.filter((u) => u.farmId === farmId);
  return {
    admins: farmUsers.filter((u) => u.role === "Farm Admin" || u.role === "Manager"),
    staff: farmUsers.filter((u) => u.role === "Staff"),
  };
}

export interface FarmStaffCounts {
  total: number;
  active: number;
  inactive: number;
}

/** Counts only role === "Staff", matching the Overview KPI card's "Total Staff" definition (Farm Admin/Manager shown separately above), so the two never disagree. */
export function getFarmStaffCounts(data: AllFarmsBulkData, farmId: string): FarmStaffCounts {
  const staff = data.users.filter((u) => u.farmId === farmId && u.role === "Staff");
  const active = staff.filter((u) => u.status === "active").length;
  return { total: staff.length, active, inactive: staff.length - active };
}

// ── OVERVIEW tab ──────────────────────────────────────────────────────────────

export type ActivityType = "production" | "mortality" | "sale" | "expense";

export interface ActivityItem {
  id: string;
  type: ActivityType;
  date: string;
  title: string;
  detail: string;
}

/** Most recent activity across every module for this one farm, newest first — a single at-a-glance feed for the Overview tab. */
export function getFarmRecentActivity(data: AllFarmsBulkData, farmId: string, limit = 8): ActivityItem[] {
  const items: ActivityItem[] = [
    ...forFarm(data.eggRecords, farmId).map((r) => ({
      id: `production:${r.id}`,
      type: "production" as const,
      date: r.productionDate,
      title: `Egg production — ${r.housePen}`,
      detail: `${r.eggsCollected.toLocaleString()} eggs collected (${r.status})`,
    })),
    ...forFarm(data.mortalityRecords, farmId).map((r) => ({
      id: `mortality:${r.id}`,
      type: "mortality" as const,
      date: r.recordDate,
      title: `Mortality — ${r.housePen}`,
      detail: `${r.deadBirds.toLocaleString()} birds${r.causeOfDeath ? ` (${r.causeOfDeath})` : ""}`,
    })),
    ...forFarm(data.sales, farmId).map((s) => ({
      id: `sale:${s.id}`,
      type: "sale" as const,
      date: s.saleDate,
      title: `Sale — ${s.itemCategory}`,
      detail: `${summarizeSaleItems(s)} · ₱${s.totalAmount.toLocaleString()}`,
    })),
    ...forFarm(data.expenses, farmId).map((e) => ({
      id: `expense:${e.id}`,
      type: "expense" as const,
      date: e.expenseDate,
      title: `Expense — ${e.category}`,
      detail: `₱${e.amount.toLocaleString()} · ${e.description}`,
    })),
  ];

  return items.sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}

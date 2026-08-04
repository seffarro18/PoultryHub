import {
  Bell,
  Bird,
  CalendarDays,
  CalendarRange,
  Egg,
  ListChecks,
  Pill,
  Receipt,
  TrendingDown,
  TrendingUp,
  Wallet,
  Wheat,
} from "lucide-react";
import type { CategorySlice, KpiCardData, RevenueExpensePoint, SeriesPoint } from "../types/dashboard";

/**
 * Phase-1 demo data layer for the Farm Admin's Dashboard Overview.
 *
 * Same reasoning as `dashboardService.ts`: none of the entity tables this data
 * would eventually come from (egg_production, poultry_inventory, feed_inventory,
 * sales, expenses, farms/farm_users) exist in Supabase yet, so this stays a
 * seeded, typed stand-in until each owning module is built for real.
 */

export interface FarmOverview {
  todaysEggProduction: number;
  weeklyEggProduction: number;
  monthlyEggProduction: number;
  totalChickens: number;
  feedRemaining: number;
  medicineStock: number;
  mortalityCount: number;
  revenue: number;
  expenses: number;
  profit: number;
  pendingTasks: number;
  notifications: number;
}

export function getFarmOverview(): FarmOverview {
  const revenue = 186400;
  const expenses = 112800;
  return {
    todaysEggProduction: 2140,
    weeklyEggProduction: 14680,
    monthlyEggProduction: 61200,
    totalChickens: 8420,
    feedRemaining: 58,
    medicineStock: 34,
    mortalityCount: 12,
    revenue,
    expenses,
    profit: revenue - expenses,
    pendingTasks: 5,
    notifications: 4,
  };
}

export function getKpiCards(): KpiCardData[] {
  const o = getFarmOverview();
  return [
    {
      id: "todays-egg-production",
      label: "Today's Egg Production",
      value: o.todaysEggProduction.toLocaleString(),
      icon: Egg,
      deltaPercent: -2.4,
      isPositive: false,
      status: "warning",
      sparkline: [2260, 2230, 2280, 2190, 2210, 2160, 2180, 2150, 2170, 2140],
    },
    {
      id: "weekly-production",
      label: "Weekly Production",
      value: o.weeklyEggProduction.toLocaleString(),
      icon: CalendarRange,
      deltaPercent: 1.9,
      isPositive: true,
      status: "good",
      sparkline: [13800, 14000, 14100, 14250, 14380, 14450, 14520, 14580, 14630, 14680],
    },
    {
      id: "monthly-production",
      label: "Monthly Production",
      value: o.monthlyEggProduction.toLocaleString(),
      icon: CalendarDays,
      deltaPercent: 3.1,
      isPositive: true,
      status: "good",
      sparkline: [56200, 57100, 57900, 58600, 59200, 59800, 60300, 60700, 61000, 61200],
    },
    {
      id: "total-chickens",
      label: "Total Chickens",
      value: o.totalChickens.toLocaleString(),
      icon: Bird,
      deltaPercent: 0.6,
      isPositive: true,
      status: "good",
      sparkline: [8350, 8360, 8375, 8380, 8390, 8400, 8405, 8410, 8415, 8420],
    },
    {
      id: "feed-remaining",
      label: "Feed Remaining",
      value: `${o.feedRemaining}%`,
      icon: Wheat,
      deltaPercent: -6.8,
      isPositive: false,
      status: "warning",
      sparkline: [74, 71, 69, 67, 65, 63, 61, 60, 59, 58],
    },
    {
      id: "medicine-stock",
      label: "Medicine Stock",
      value: `${o.medicineStock}%`,
      icon: Pill,
      deltaPercent: -12.5,
      isPositive: false,
      status: "critical",
      sparkline: [52, 49, 46, 44, 41, 39, 37, 36, 35, 34],
    },
    {
      id: "mortality-count",
      label: "Mortality Count",
      value: o.mortalityCount.toLocaleString(),
      icon: TrendingDown,
      deltaPercent: 20,
      isPositive: false,
      status: "warning",
      sparkline: [6, 8, 5, 9, 7, 10, 8, 11, 9, 12],
    },
    {
      id: "revenue",
      label: "Revenue",
      value: `₱${(o.revenue / 1000).toFixed(1)}K`,
      icon: Wallet,
      deltaPercent: 7.2,
      isPositive: true,
      status: "good",
      sparkline: [162, 166, 170, 174, 177, 180, 182, 184, 185, 186.4].map((v) => v * 1000),
    },
    {
      id: "expenses",
      label: "Expenses",
      value: `₱${(o.expenses / 1000).toFixed(1)}K`,
      icon: Receipt,
      deltaPercent: 4.5,
      isPositive: false,
      status: "warning",
      sparkline: [98, 101, 103, 105, 107, 109, 110, 111, 112, 112.8].map((v) => v * 1000),
    },
    {
      id: "profit",
      label: "Profit",
      value: `₱${(o.profit / 1000).toFixed(1)}K`,
      icon: TrendingUp,
      deltaPercent: 11.6,
      isPositive: true,
      status: "good",
      sparkline: [58, 61, 63, 65, 67, 69, 71, 72, 73, 73.6].map((v) => v * 1000),
    },
    {
      id: "pending-tasks",
      label: "Pending Tasks",
      value: o.pendingTasks.toLocaleString(),
      icon: ListChecks,
      deltaPercent: -16.7,
      isPositive: true,
      status: "good",
      sparkline: [9, 8, 8, 7, 7, 6, 6, 5, 5, 5],
    },
    {
      id: "notifications",
      label: "Notifications",
      value: o.notifications.toLocaleString(),
      icon: Bell,
      deltaPercent: -20,
      isPositive: true,
      status: "good",
      sparkline: [7, 6, 6, 5, 6, 5, 4, 5, 4, 4],
    },
  ];
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function getEggProductionTrend(): SeriesPoint[] {
  const values = [2020, 2080, 2150, 2040, 2190, 2260, 2230, 2280, 2190, 2210, 2160, 2180, 2150, 2140];
  return values.map((value, i) => ({ label: `${i + 1}`, value }));
}

export function getFeedConsumption(): SeriesPoint[] {
  const values = [640, 665, 610, 690, 705, 580, 540];
  return values.map((value, i) => ({ label: DAYS[i] ?? `D${i + 1}`, value }));
}

export const MORTALITY_TARGET_RATE = 0.3;

export function getMortalityRate(): SeriesPoint[] {
  const values = [0.22, 0.19, 0.31, 0.28, 0.2, 0.17, 0.24, 0.33, 0.21, 0.18, 0.26, 0.14];
  return values.map((value, i) => ({ label: MONTHS[i] ?? `M${i + 1}`, value }));
}

export function getChickenPopulation(): CategorySlice[] {
  return [
    { name: "Layers", value: 5120 },
    { name: "Growers", value: 1840 },
    { name: "Chicks", value: 980 },
    { name: "Breeders", value: 480 },
  ];
}

export function getRevenueExpenses(): RevenueExpensePoint[] {
  const revenue = [142, 149, 155, 158, 163, 167, 172, 176, 180, 183, 185, 186.4];
  const expenses = [96, 99, 101, 103, 105, 106, 108, 109, 110, 111, 112, 112.8];
  return revenue.map((r, i) => ({
    label: MONTHS[i] ?? `M${i + 1}`,
    revenue: Math.round(r * 1000),
    expenses: Math.round((expenses[i] ?? 0) * 1000),
  }));
}

export function getMonthlyProfit(): SeriesPoint[] {
  const revExp = getRevenueExpenses();
  return revExp.map((point) => ({ label: point.label, value: point.revenue - point.expenses }));
}

export function getSalesTrend(): SeriesPoint[] {
  const values = [4200, 4650, 3980, 5100, 4820, 5960, 4380];
  return values.map((value, i) => ({ label: DAYS[i] ?? `D${i + 1}`, value }));
}

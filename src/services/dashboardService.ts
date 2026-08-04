import {
  Bell,
  Bird,
  CalendarDays,
  Egg,
  Receipt,
  UserCog,
  Users,
  UsersRound,
  Warehouse,
  Wheat,
  Wallet,
} from "lucide-react";
import type {
  CategorySlice,
  DashboardOverview,
  KpiCardData,
  RevenueExpensePoint,
  SeriesPoint,
} from "../types/dashboard";

/**
 * Phase-1 demo data layer for the Dashboard Overview.
 *
 * Shaped the way a future Supabase aggregation query would return it, so each
 * getter here becomes a mechanical swap for a real query once its owning
 * module (Farms, Production, Inventory, Sales, ...) is built. See the plan
 * notes: `profiles` already exists in Supabase, but reading it platform-wide
 * needs an RLS change that belongs to the User Management module, not here.
 */

export function getDashboardOverview(): DashboardOverview {
  return {
    totalFarms: 48,
    totalUsers: 216,
    activeManagers: 34,
    activeStaff: 152,
    todaysEggProduction: 18420,
    monthlyEggProduction: 512300,
    totalPoultryPopulation: 284650,
    feedStockRemaining: 62,
    revenue: 1284500,
    expenses: 742300,
    activeNotifications: 7,
  };
}

export function getKpiCards(): KpiCardData[] {
  const o = getDashboardOverview();
  return [
    {
      id: "total-farms",
      label: "Total Farms",
      value: o.totalFarms.toLocaleString(),
      icon: Warehouse,
      deltaPercent: 4.2,
      isPositive: true,
      status: "good",
      sparkline: [40, 41, 42, 42, 44, 45, 46, 47, 48, 48],
    },
    {
      id: "total-users",
      label: "Total Users",
      value: o.totalUsers.toLocaleString(),
      icon: Users,
      deltaPercent: 6.1,
      isPositive: true,
      status: "good",
      sparkline: [180, 186, 190, 195, 200, 203, 208, 210, 214, 216],
    },
    {
      id: "active-managers",
      label: "Active Managers",
      value: o.activeManagers.toLocaleString(),
      icon: UserCog,
      deltaPercent: 2.9,
      isPositive: true,
      status: "good",
      sparkline: [28, 29, 29, 30, 31, 31, 32, 33, 33, 34],
    },
    {
      id: "active-staff",
      label: "Active Staff",
      value: o.activeStaff.toLocaleString(),
      icon: UsersRound,
      deltaPercent: 1.4,
      isPositive: true,
      status: "good",
      sparkline: [138, 140, 142, 144, 145, 147, 148, 149, 151, 152],
    },
    {
      id: "todays-egg-production",
      label: "Today's Egg Production",
      value: `${(o.todaysEggProduction / 1000).toFixed(1)}K`,
      icon: Egg,
      deltaPercent: -1.8,
      isPositive: false,
      status: "warning",
      sparkline: [19100, 18950, 19300, 18800, 18600, 18700, 18500, 18650, 18550, 18420],
    },
    {
      id: "monthly-egg-production",
      label: "Monthly Egg Production",
      value: `${(o.monthlyEggProduction / 1000).toFixed(0)}K`,
      icon: CalendarDays,
      deltaPercent: 3.6,
      isPositive: true,
      status: "good",
      sparkline: [470, 478, 483, 489, 495, 498, 502, 506, 509, 512],
    },
    {
      id: "total-poultry-population",
      label: "Total Poultry Population",
      value: o.totalPoultryPopulation.toLocaleString(),
      icon: Bird,
      deltaPercent: 0.9,
      isPositive: true,
      status: "good",
      sparkline: [281200, 281800, 282400, 282900, 283300, 283700, 284000, 284300, 284500, 284650],
    },
    {
      id: "feed-stock-remaining",
      label: "Feed Stock Remaining",
      value: `${o.feedStockRemaining}%`,
      icon: Wheat,
      deltaPercent: -9.4,
      isPositive: false,
      status: "critical",
      sparkline: [82, 79, 76, 74, 71, 69, 67, 65, 63, 62],
    },
    {
      id: "revenue",
      label: "Revenue",
      value: `₱${(o.revenue / 1_000_000).toFixed(2)}M`,
      icon: Wallet,
      deltaPercent: 8.3,
      isPositive: true,
      status: "good",
      sparkline: [1010, 1055, 1080, 1120, 1150, 1190, 1220, 1250, 1270, 1284].map((v) => v * 1000),
    },
    {
      id: "expenses",
      label: "Expenses",
      value: `₱${(o.expenses / 1_000_000).toFixed(2)}M`,
      icon: Receipt,
      deltaPercent: 5.1,
      isPositive: false,
      status: "warning",
      sparkline: [640, 660, 675, 690, 700, 712, 720, 730, 736, 742].map((v) => v * 1000),
    },
    {
      id: "active-notifications",
      label: "Active Notifications",
      value: o.activeNotifications.toLocaleString(),
      icon: Bell,
      deltaPercent: -30,
      isPositive: true,
      status: "good",
      sparkline: [12, 11, 13, 10, 9, 10, 8, 9, 7, 7],
    },
  ];
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function getEggProductionTrend(period: "daily" | "monthly"): SeriesPoint[] {
  if (period === "daily") {
    const values = [17800, 18100, 17950, 18300, 18600, 17200, 16900, 18420];
    return values.map((value, i) => ({ label: DAYS[i % DAYS.length] ?? `D${i + 1}`, value }));
  }
  const values = [438, 445, 452, 460, 467, 474, 481, 489, 496, 502, 507, 512].map((v) => v * 1000);
  return values.map((value, i) => ({ label: MONTHS[i] ?? `M${i + 1}`, value }));
}

export function getRevenueExpenses(): RevenueExpensePoint[] {
  const revenue = [980, 1020, 1065, 1090, 1130, 1160, 1195, 1220, 1245, 1260, 1272, 1284.5];
  const expenses = [610, 625, 648, 660, 678, 690, 705, 715, 726, 733, 738, 742.3];
  return revenue.map((r, i) => ({
    label: MONTHS[i] ?? `M${i + 1}`,
    revenue: Math.round(r * 1000),
    expenses: Math.round((expenses[i] ?? 0) * 1000),
  }));
}

export function getFeedConsumption(): SeriesPoint[] {
  const values = [4200, 4350, 4180, 4460, 4520, 3980, 3760];
  return values.map((value, i) => ({ label: DAYS[i] ?? `D${i + 1}`, value }));
}

export function getPoultryPopulationBreakdown(): CategorySlice[] {
  return [
    { name: "Layers", value: 168500 },
    { name: "Growers", value: 62400 },
    { name: "Chicks", value: 38200 },
    { name: "Breeders", value: 15550 },
  ];
}

export const MORTALITY_TARGET_RATE = 0.5;

export function getMortalityRate(): SeriesPoint[] {
  const values = [0.42, 0.38, 0.55, 0.61, 0.47, 0.4, 0.36, 0.44, 0.58, 0.39, 0.41, 0.35];
  return values.map((value, i) => ({ label: MONTHS[i] ?? `M${i + 1}`, value }));
}

export function getFarmComparison(): SeriesPoint[] {
  return [
    { label: "Greenfield Farm", value: 52400 },
    { label: "Sunrise Poultry", value: 47100 },
    { label: "Valley Egg Co.", value: 41800 },
    { label: "Golden Acres", value: 38200 },
    { label: "Highland Farms", value: 33950 },
  ].sort((a, b) => b.value - a.value);
}

export function getUserGrowth(): SeriesPoint[] {
  const values = [142, 151, 158, 166, 173, 181, 188, 196, 202, 208, 212, 216];
  return values.map((value, i) => ({ label: MONTHS[i] ?? `M${i + 1}`, value }));
}

export function getSystemActivity(): SeriesPoint[] {
  const values = [312, 298, 341, 356, 329, 187, 142];
  return values.map((value, i) => ({ label: DAYS[i] ?? `D${i + 1}`, value }));
}

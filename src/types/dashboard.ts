import type { LucideIcon } from "lucide-react";

export type KpiStatus = "good" | "warning" | "critical";

export interface KpiCardData {
  id: string;
  label: string;
  value: string;
  icon: LucideIcon;
  deltaPercent: number;
  /** Whether this delta's direction should read as good news (up isn't always good — e.g. expenses, mortality). */
  isPositive: boolean;
  status: KpiStatus;
  sparkline: number[];
}

export interface SeriesPoint {
  label: string;
  value: number;
}

export interface RevenueExpensePoint {
  label: string;
  revenue: number;
  expenses: number;
}

export interface CategorySlice {
  name: string;
  value: number;
}

export interface DashboardOverview {
  totalFarms: number;
  totalUsers: number;
  activeManagers: number;
  activeStaff: number;
  todaysEggProduction: number;
  monthlyEggProduction: number;
  totalPoultryPopulation: number;
  feedStockRemaining: number;
  revenue: number;
  expenses: number;
  activeNotifications: number;
}

import type { LucideIcon } from "lucide-react";

export type KpiStatus = "good" | "warning" | "critical";

export interface KpiCardData {
  id: string;
  label: string;
  value: string;
  icon: LucideIcon;
  /**
   * Trend fields are optional — only present for metrics with a real historical
   * log to compute them from (e.g. day-by-day counts). Metrics that are a live
   * mutable stock level with no historical snapshot (current feed stock, current
   * poultry population) omit them rather than fabricate a trend; KpiCard renders
   * a plain value in that case.
   */
  deltaPercent?: number;
  /** Whether this delta's direction should read as good news (up isn't always good — e.g. mortality). */
  isPositive?: boolean;
  status?: KpiStatus;
  sparkline?: number[];
}

export interface SeriesPoint {
  label: string;
  value: number;
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
  activeNotifications: number;
}

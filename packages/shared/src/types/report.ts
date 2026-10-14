import type { DateRange, RangePreset } from "../lib/reportPeriods";

export type ReportCategory =
  | "overview"
  | "layers"
  | "eggs"
  | "feed"
  | "vitamins"
  | "mortality"
  | "finance"
  | "activity";

export const REPORT_CATEGORY_LABEL: Record<ReportCategory, string> = {
  overview: "Overview",
  layers: "Poultry & Layer Inventory",
  eggs: "Egg Production & Egg Inventory",
  feed: "Feed Inventory & Consumption",
  vitamins: "Vitamin Inventory & Usage",
  mortality: "Mortality",
  finance: "Sales & Expenses",
  activity: "Tasks, Activity & Audit",
};

export const REPORT_CATEGORY_DESCRIPTION: Record<ReportCategory, string> = {
  overview: "Farm-wide summary of every inventory and recent activity.",
  layers: "Active layers, arrivals, transfers, sales, culling and count corrections.",
  eggs: "Egg collections, approval status, quality, and sellable egg stock.",
  feed: "Feed received, approved distribution, and remaining stock.",
  vitamins: "Vitamin purchases, approved administration, and remaining stock.",
  mortality: "Recorded mortality and its effect on active layers.",
  finance: "Sales, purchase and manual expenses, and profit/loss.",
  activity: "Tasks, approvals, and the farm's activity history.",
};

/** Which datasets a report needs — loaded once per report open, RLS-scoped. */
export type DatasetKey =
  | "events"
  | "mortality"
  | "eggs"
  | "sales"
  | "expenses"
  | "purchases"
  | "feeds"
  | "vitamins"
  | "feedDistribution"
  | "vitaminAdministration"
  | "tasks"
  | "audit";

export type FilterKey =
  | "house"
  | "status"
  | "staff"
  | "eventType"
  | "breed"
  | "feedItem"
  | "feedBrand"
  | "feedCategory"
  | "vitamin"
  | "vitaminCategory"
  | "eggSize"
  | "paymentMethod"
  | "expenseCategory"
  | "expenseSource"
  | "transactionType"
  | "module";

export const FILTER_LABEL: Record<FilterKey, string> = {
  house: "House / Pen",
  status: "Status",
  staff: "Staff / User",
  eventType: "Event Type",
  breed: "Breed / Strain",
  feedItem: "Feed Item",
  feedBrand: "Feed Brand",
  feedCategory: "Feed Category",
  vitamin: "Vitamin",
  vitaminCategory: "Vitamin Category",
  eggSize: "Egg Size",
  paymentMethod: "Payment Method",
  expenseCategory: "Expense Category",
  expenseSource: "Expense Source",
  transactionType: "Transaction Type",
  module: "Module",
};

/** Selected value per filter; "" (or absent) = all. */
export type FilterValues = Partial<Record<FilterKey, string>>;

export interface ReportContext {
  range: DateRange;
  preset: RangePreset;
  /** The comparison period, when the preset has a meaningful one. */
  previous: DateRange | null;
  filters: FilterValues;
  /** YYYY-MM-DD, device-local. */
  today: string;
  /** Super Admin aggregate across several farms — adds a Farm column. */
  multiFarm: boolean;
  role: ReportRole;
  userId: string | null;
}

export type ReportRole = "Super Admin" | "Farm Admin" | "Manager" | "Staff";

/** Revenue, expenses, profit and purchase prices — never shown to Staff (RLS also denies them the rows). */
export function canSeeFinance(role: ReportRole): boolean {
  return role !== "Staff";
}

export type CellValue = string | number | null;

export type ColumnFormat = "text" | "number" | "currency" | "date" | "datetime" | "status" | "signed";

export interface ReportColumn {
  key: string;
  label: string;
  format?: ColumnFormat;
  /** Shown after numbers, e.g. "eggs", "birds", "Sacks". Ignored in CSV (CSV keeps a separate unit column where it matters). */
  suffix?: string;
}

export type ReportRow = Record<string, CellValue>;

export interface ReportTable {
  id: string;
  title: string;
  description?: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  /** Footer row — totals that the summary cards are reconciled against. */
  totals?: ReportRow;
  /** Initial sort column key + direction. */
  sort?: { key: string; dir: "asc" | "desc" };
  /** Small breakdown tables skip search/pagination. */
  compact?: boolean;
  /** "View transactions" links into another report for the same period. */
  drillDown?: { reportId: string; label: string }[];
}

export interface SummaryCard {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "positive" | "negative" | "warning";
}

export interface ReportOutput {
  summary: SummaryCard[];
  tables: ReportTable[];
  /** Calculation rules, reconciliation results, and honest data-availability notes shown above the tables. */
  notes: string[];
}

/** Filter options are derived from the loaded data (real values only). */
export type FilterOptions = Partial<Record<FilterKey, string[]>>;

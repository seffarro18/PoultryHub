import { supabase } from "./supabaseClient";
import { EGG_TRAY_SIZES, type EggSaleInput, type ExpenseInput, type ExpenseRecord, type SaleItem, type SaleRecord } from "../types/salesExpenses";
import type { EggSize } from "../types/eggPricing";

// ── Sales ────────────────────────────────────────────────────────────────

interface SaleItemRow {
  id: string;
  egg_size: EggSize;
  unit_type: "full_tray" | "half_tray";
  quantity: number;
  eggs_count: number;
  unit_price: number;
  line_total: number;
}

interface SaleRow {
  id: string;
  farm_id: string;
  sale_date: string;
  item_category: SaleRecord["itemCategory"];
  description: string | null;
  quantity: number | null;
  unit: string | null;
  egg_size: string | null;
  unit_price: number | null;
  total_amount: number;
  buyer_name: string | null;
  payment_status: SaleRecord["paymentStatus"];
  payment_method: string | null;
  remarks: string | null;
  created_at: string;
  farms: { name: string } | null;
  recorded_by_profile: { name: string } | null;
  sale_items: SaleItemRow[] | null;
}

const SALE_SELECT = `
  id, farm_id, sale_date, item_category, description, quantity, unit, egg_size, unit_price, total_amount,
  buyer_name, payment_status, payment_method, remarks, created_at,
  farms ( name ),
  recorded_by_profile:profiles!recorded_by ( name ),
  sale_items ( id, egg_size, unit_type, quantity, eggs_count, unit_price, line_total )
`;

function mapSaleItemRow(row: SaleItemRow): SaleItem {
  return {
    id: row.id,
    eggSize: row.egg_size,
    unitType: row.unit_type,
    quantity: row.quantity,
    eggsCount: row.eggs_count,
    unitPrice: row.unit_price,
    lineTotal: row.line_total,
  };
}

function mapSaleRow(row: SaleRow): SaleRecord {
  return {
    id: row.id,
    farmId: row.farm_id,
    farmName: row.farms?.name ?? "Unknown farm",
    saleDate: row.sale_date,
    itemCategory: row.item_category,
    description: row.description,
    quantity: row.quantity,
    unit: row.unit,
    eggSize: row.egg_size,
    unitPrice: row.unit_price,
    totalAmount: row.total_amount,
    buyerName: row.buyer_name,
    paymentStatus: row.payment_status,
    paymentMethod: row.payment_method,
    recordedByName: row.recorded_by_profile?.name ?? null,
    remarks: row.remarks,
    createdAt: row.created_at,
    items: (row.sale_items ?? []).map(mapSaleItemRow),
  };
}

export async function listSales(): Promise<SaleRecord[]> {
  const { data, error } = await supabase.from("sales").select(SALE_SELECT).order("sale_date", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as SaleRow[]).map(mapSaleRow);
}

const UNIT_TYPE_LABEL: Record<"full_tray" | "half_tray", string> = { full_tray: "Full Tray", half_tray: "Half Tray" };

/** "1 Half Tray Medium, 1 Full Tray Jumbo" — used by Sales History rows, the details modal, and CSV exports so this formatting lives in exactly one place. Falls back to the legacy flat shape for a pre-multi-item sale. */
export function summarizeSaleItems(sale: SaleRecord): string {
  if (sale.items.length === 0) {
    return sale.quantity !== null && sale.unit !== null ? `${sale.quantity.toLocaleString()} ${sale.unit}` : "—";
  }
  return sale.items.map((item) => `${item.quantity} ${UNIT_TYPE_LABEL[item.unitType]} ${item.eggSize}`).join(", ");
}

/** Total raw eggs across every line of a sale — used by the details modal and CSV exports. Falls back to the legacy flat quantity (tray-converted) for a pre-multi-item sale. */
export function totalEggsForSale(sale: SaleRecord): number {
  if (sale.items.length > 0) return sale.items.reduce((sum, item) => sum + item.eggsCount, 0);
  if (sale.itemCategory !== "Eggs" || sale.quantity === null) return 0;
  return sale.quantity * (EGG_TRAY_SIZES[(sale.unit ?? "") as keyof typeof EGG_TRAY_SIZES] ?? 1);
}

/**
 * Create (saleId omitted) or edit (saleId given) a multi-item Eggs sale —
 * one round trip to save_egg_sale() (0024_sales_multi_item.sql), which
 * validates every line's stock and prices each from the farm's current Egg
 * Prices before writing anything. Returns the sale's id. A Postgres
 * exception (e.g. insufficient stock) surfaces as `error.message`, already
 * worded to show directly in the form.
 */
export async function saveEggSale(input: EggSaleInput, saleId?: string): Promise<string> {
  const { data, error } = await supabase.rpc("save_egg_sale", {
    p_sale_id: saleId ?? null,
    p_farm_id: input.farmId,
    p_sale_date: input.saleDate,
    p_buyer_name: input.buyerName,
    p_payment_status: input.paymentStatus,
    p_remarks: input.remarks,
    p_items: input.items.map((item) => ({
      egg_size: item.eggSize,
      unit_type: item.unitType === "Half Tray" ? "half_tray" : "full_tray",
      quantity: item.quantity,
    })),
  });
  if (error) throw error;
  return data as string;
}

export async function deleteSale(id: string): Promise<void> {
  const { error } = await supabase.from("sales").delete().eq("id", id);
  if (error) throw error;
}

// ── Expenses ─────────────────────────────────────────────────────────────

interface ExpenseRow {
  id: string;
  farm_id: string;
  expense_date: string;
  category: ExpenseRecord["category"];
  description: string;
  amount: number;
  payment_method: string | null;
  vendor: string | null;
  remarks: string | null;
  created_at: string;
  source: ExpenseRecord["source"];
  purchase_id: string | null;
  farms: { name: string } | null;
  recorded_by_profile: { name: string } | null;
}

const EXPENSE_SELECT = `
  id, farm_id, expense_date, category, description, amount, payment_method, vendor, remarks, created_at,
  source, purchase_id,
  farms ( name ),
  recorded_by_profile:profiles!recorded_by ( name )
`;

function mapExpenseRow(row: ExpenseRow): ExpenseRecord {
  return {
    id: row.id,
    farmId: row.farm_id,
    farmName: row.farms?.name ?? "Unknown farm",
    expenseDate: row.expense_date,
    category: row.category,
    description: row.description,
    amount: row.amount,
    paymentMethod: row.payment_method,
    vendor: row.vendor,
    recordedByName: row.recorded_by_profile?.name ?? null,
    remarks: row.remarks,
    createdAt: row.created_at,
    source: row.source,
    purchaseId: row.purchase_id,
  };
}

export async function listExpenses(): Promise<ExpenseRecord[]> {
  const { data, error } = await supabase.from("expenses").select(EXPENSE_SELECT).order("expense_date", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as ExpenseRow[]).map(mapExpenseRow);
}

function expenseRow(input: ExpenseInput) {
  return {
    farm_id: input.farmId,
    expense_date: input.expenseDate,
    category: input.category,
    description: input.description,
    amount: input.amount,
    payment_method: input.paymentMethod,
    vendor: input.vendor,
    remarks: input.remarks,
  };
}

export async function createExpense(input: ExpenseInput): Promise<void> {
  const { error } = await supabase.from("expenses").insert(expenseRow(input));
  if (error) throw error;
}

export async function updateExpense(id: string, input: ExpenseInput): Promise<void> {
  const { error } = await supabase.from("expenses").update(expenseRow(input)).eq("id", id);
  if (error) throw error;
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw error;
}

// ── Aggregation helpers ──────────────────────────────────────────────────

export interface LabeledTotal {
  label: string;
  value: number;
}

export function totalSales(sales: SaleRecord[]): number {
  return sales.reduce((sum, s) => sum + s.totalAmount, 0);
}

export function totalExpenses(expenses: ExpenseRecord[]): number {
  return expenses.reduce((sum, e) => sum + e.amount, 0);
}

export function salesByCategory(sales: SaleRecord[]): LabeledTotal[] {
  const totals = new Map<string, number>();
  for (const s of sales) totals.set(s.itemCategory, (totals.get(s.itemCategory) ?? 0) + s.totalAmount);
  return [...totals.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

export function expensesByCategory(expenses: ExpenseRecord[]): LabeledTotal[] {
  const totals = new Map<string, number>();
  for (const e of expenses) totals.set(e.category, (totals.get(e.category) ?? 0) + e.amount);
  return [...totals.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

export function salesByFarm(sales: SaleRecord[]): LabeledTotal[] {
  const totals = new Map<string, LabeledTotal>();
  for (const s of sales) {
    const existing = totals.get(s.farmId);
    if (existing) existing.value += s.totalAmount;
    else totals.set(s.farmId, { label: s.farmName, value: s.totalAmount });
  }
  return [...totals.values()].sort((a, b) => b.value - a.value);
}

export function expensesByFarm(expenses: ExpenseRecord[]): LabeledTotal[] {
  const totals = new Map<string, LabeledTotal>();
  for (const e of expenses) {
    const existing = totals.get(e.farmId);
    if (existing) existing.value += e.amount;
    else totals.set(e.farmId, { label: e.farmName, value: e.amount });
  }
  return [...totals.values()].sort((a, b) => b.value - a.value);
}

export interface RevenueExpensePoint {
  label: string;
  revenue: number;
  expenses: number;
}

function monthBucketKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

function monthBucketLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

/** Revenue vs. expenses, bucketed by month, last 12 months with data on either side. */
export function revenueExpensesByMonth(sales: SaleRecord[], expenses: ExpenseRecord[]): RevenueExpensePoint[] {
  const buckets = new Map<string, RevenueExpensePoint>();
  for (const s of sales) {
    const key = monthBucketKey(s.saleDate);
    const bucket = buckets.get(key) ?? { label: monthBucketLabel(key), revenue: 0, expenses: 0 };
    bucket.revenue += s.totalAmount;
    buckets.set(key, bucket);
  }
  for (const e of expenses) {
    const key = monthBucketKey(e.expenseDate);
    const bucket = buckets.get(key) ?? { label: monthBucketLabel(key), revenue: 0, expenses: 0 };
    bucket.expenses += e.amount;
    buckets.set(key, bucket);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([, bucket]) => bucket);
}

export interface DailyAmountPoint {
  label: string;
  value: number;
}

function dayBucketLabel(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Sales total per day, most recent 14 days with a sale. */
export function aggregateSalesByDay(sales: SaleRecord[]): DailyAmountPoint[] {
  const buckets = new Map<string, number>();
  for (const s of sales) buckets.set(s.saleDate, (buckets.get(s.saleDate) ?? 0) + s.totalAmount);
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([key, value]) => ({ label: dayBucketLabel(key), value }));
}

/** Expenses total per day, most recent 14 days with an expense. */
export function aggregateExpensesByDay(expenses: ExpenseRecord[]): DailyAmountPoint[] {
  const buckets = new Map<string, number>();
  for (const e of expenses) buckets.set(e.expenseDate, (buckets.get(e.expenseDate) ?? 0) + e.amount);
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([key, value]) => ({ label: dayBucketLabel(key), value }));
}

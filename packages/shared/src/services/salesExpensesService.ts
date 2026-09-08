import { supabase } from "./supabaseClient";
import type { ExpenseInput, ExpenseRecord, SaleInput, SaleRecord } from "../types/salesExpenses";

// ── Sales ────────────────────────────────────────────────────────────────

interface SaleRow {
  id: string;
  farm_id: string;
  sale_date: string;
  item_category: SaleRecord["itemCategory"];
  description: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  total_amount: number;
  buyer_name: string | null;
  payment_status: SaleRecord["paymentStatus"];
  payment_method: string | null;
  remarks: string | null;
  created_at: string;
  farms: { name: string } | null;
  recorded_by_profile: { name: string } | null;
}

const SALE_SELECT = `
  id, farm_id, sale_date, item_category, description, quantity, unit, unit_price, total_amount,
  buyer_name, payment_status, payment_method, remarks, created_at,
  farms ( name ),
  recorded_by_profile:profiles!recorded_by ( name )
`;

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
    unitPrice: row.unit_price,
    totalAmount: row.total_amount,
    buyerName: row.buyer_name,
    paymentStatus: row.payment_status,
    paymentMethod: row.payment_method,
    recordedByName: row.recorded_by_profile?.name ?? null,
    remarks: row.remarks,
    createdAt: row.created_at,
  };
}

export async function listSales(): Promise<SaleRecord[]> {
  const { data, error } = await supabase.from("sales").select(SALE_SELECT).order("sale_date", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as SaleRow[]).map(mapSaleRow);
}

function saleRow(input: SaleInput) {
  return {
    farm_id: input.farmId,
    sale_date: input.saleDate,
    item_category: input.itemCategory,
    description: input.description,
    quantity: input.quantity,
    unit: input.unit,
    unit_price: input.unitPrice,
    total_amount: input.totalAmount,
    buyer_name: input.buyerName,
    payment_status: input.paymentStatus,
    payment_method: input.paymentMethod,
    remarks: input.remarks,
  };
}

export async function createSale(input: SaleInput): Promise<void> {
  const { error } = await supabase.from("sales").insert(saleRow(input));
  if (error) throw error;
}

export async function updateSale(id: string, input: SaleInput): Promise<void> {
  const { error } = await supabase.from("sales").update(saleRow(input)).eq("id", id);
  if (error) throw error;
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
  farms: { name: string } | null;
  recorded_by_profile: { name: string } | null;
}

const EXPENSE_SELECT = `
  id, farm_id, expense_date, category, description, amount, payment_method, vendor, remarks, created_at,
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

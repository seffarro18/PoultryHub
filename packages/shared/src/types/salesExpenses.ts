import type { EggSize } from "./eggPricing";

export const SALE_CATEGORIES = ["Eggs", "Live Birds", "Manure", "Other"] as const;
export type SaleCategory = (typeof SALE_CATEGORIES)[number];

/** Confirmed conversion factors for an Eggs sale's Unit dropdown — 1 full tray = 30 eggs, half tray = 15. Defined once here and reused everywhere a tray-based sale quantity needs converting to raw eggs (stock math, remaining-stock validation). */
export const EGG_TRAY_SIZES = { "Full Tray": 30, "Half Tray": 15 } as const;
export type EggTrayUnit = keyof typeof EGG_TRAY_SIZES;

export const PAYMENT_STATUSES = ["paid", "pending", "partial"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const EXPENSE_CATEGORIES = [
  "Feed",
  "Medicine & Vitamins",
  "Utilities",
  "Labor",
  "Maintenance",
  "Transport",
  "Equipment",
  "Other",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/** One egg size + tray unit line within a sale — see sale_items (0024_sales_multi_item.sql). */
export interface SaleItem {
  id: string;
  eggSize: EggSize;
  unitType: "full_tray" | "half_tray";
  quantity: number;
  eggsCount: number;
  unitPrice: number;
  lineTotal: number;
}

export interface SaleRecord {
  id: string;
  farmId: string;
  farmName: string;
  saleDate: string;
  itemCategory: SaleCategory;
  description: string | null;
  /** Legacy-only — pre-multi-item sales stored one flat quantity/unit/price here. New Eggs sales are null and use `items` instead. */
  quantity: number | null;
  unit: string | null;
  /** Legacy-only — see `quantity`. */
  eggSize: string | null;
  unitPrice: number | null;
  totalAmount: number;
  buyerName: string | null;
  paymentStatus: PaymentStatus;
  paymentMethod: string | null;
  recordedByName: string | null;
  remarks: string | null;
  createdAt: string;
  /** One row per egg size + tray unit sold in this transaction — empty for legacy (pre-multi-item) or non-Eggs sales. */
  items: SaleItem[];
}

/** One requested line in a new/edited multi-item Eggs sale — see saveEggSale(). */
export interface EggSaleItemInput {
  eggSize: EggSize;
  unitType: EggTrayUnit;
  quantity: number;
}

export interface EggSaleInput {
  farmId: string;
  saleDate: string;
  buyerName: string | null;
  paymentStatus: PaymentStatus;
  remarks: string | null;
  items: EggSaleItemInput[];
}

/** 'inventory_purchase' = auto-created by record_feed_purchase()/record_vitamin_purchase() (0029_inventory_purchases.sql) when a Feed/Vitamin Stock purchase is recorded — never hand-entered. 'manual' = the Record Expense form, same as always. */
export type ExpenseSource = "manual" | "inventory_purchase";

export interface ExpenseRecord {
  id: string;
  farmId: string;
  farmName: string;
  expenseDate: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  paymentMethod: string | null;
  vendor: string | null;
  recordedByName: string | null;
  remarks: string | null;
  createdAt: string;
  source: ExpenseSource;
  /** Set only when source === "inventory_purchase" — the purchase_transactions row this expense came from, for "View Receipt". */
  purchaseId: string | null;
}

export interface ExpenseInput {
  farmId: string;
  expenseDate: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  paymentMethod: string | null;
  vendor: string | null;
  remarks: string | null;
}

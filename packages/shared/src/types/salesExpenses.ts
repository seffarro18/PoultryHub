export const SALE_CATEGORIES = ["Eggs", "Live Birds", "Manure", "Other"] as const;
export type SaleCategory = (typeof SALE_CATEGORIES)[number];

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

export interface SaleRecord {
  id: string;
  farmId: string;
  farmName: string;
  saleDate: string;
  itemCategory: SaleCategory;
  description: string | null;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalAmount: number;
  buyerName: string | null;
  paymentStatus: PaymentStatus;
  paymentMethod: string | null;
  recordedByName: string | null;
  remarks: string | null;
  createdAt: string;
}

export interface SaleInput {
  farmId: string;
  saleDate: string;
  itemCategory: SaleCategory;
  description: string | null;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalAmount: number;
  buyerName: string | null;
  paymentStatus: PaymentStatus;
  paymentMethod: string | null;
  remarks: string | null;
}

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

export type PurchaseType = "feed" | "vitamin";

export interface PurchaseItem {
  id: string;
  inventoryType: PurchaseType;
  inventoryItemId: string | null;
  itemName: string;
  category: string | null;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  packageSize: string | null;
}

/** A printable purchase receipt — one purchase_transactions row plus its purchase_items (always exactly one item today, since each "Add Feed/Vitamin Stock" purchase is its own transaction). */
export interface Purchase {
  id: string;
  farmId: string;
  farmName: string;
  purchaseType: PurchaseType;
  referenceNumber: string;
  purchaseDate: string;
  totalAmount: number;
  paymentMethod: string;
  recordedByName: string | null;
  createdAt: string;
  items: PurchaseItem[];
}

export interface FeedPurchaseInput {
  farmId: string;
  feedName: string;
  category: string | null;
  brand: string | null;
  batchNumber: string | null;
  supplier: string | null;
  quantity: number;
  unit: string;
  packageSize: string | null;
  unitPrice: number;
  purchaseDate: string;
  expirationDate: string | null;
  remarks: string | null;
}

export interface VitaminPurchaseInput {
  farmId: string;
  vitaminName: string;
  vitaminType: string;
  category: string | null;
  brand: string | null;
  batchNumber: string | null;
  supplier: string | null;
  quantity: number;
  unit: string;
  packageSize: string | null;
  unitPrice: number;
  purchaseDate: string;
  expirationDate: string | null;
  remarks: string | null;
}

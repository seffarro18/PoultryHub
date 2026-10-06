import { supabase } from "./supabaseClient";
import type { FeedPurchaseInput, Purchase, PurchaseItem, VitaminPurchaseInput } from "../types/purchase";

interface PurchaseItemRow {
  id: string;
  inventory_type: PurchaseItem["inventoryType"];
  inventory_item_id: string | null;
  item_name: string;
  category: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  package_size: string | null;
}

interface PurchaseRow {
  id: string;
  farm_id: string;
  purchase_type: Purchase["purchaseType"];
  reference_number: string;
  purchase_date: string;
  total_amount: number;
  payment_method: string;
  created_at: string;
  farms: { name: string } | null;
  created_by_profile: { name: string } | null;
  purchase_items: PurchaseItemRow[] | null;
}

const PURCHASE_SELECT = `
  id, farm_id, purchase_type, reference_number, purchase_date, total_amount, payment_method, created_at,
  farms ( name ),
  created_by_profile:profiles!created_by ( name ),
  purchase_items ( id, inventory_type, inventory_item_id, item_name, category, quantity, unit, unit_price, total_price, package_size )
`;

function mapPurchaseItemRow(row: PurchaseItemRow): PurchaseItem {
  return {
    id: row.id,
    inventoryType: row.inventory_type,
    inventoryItemId: row.inventory_item_id,
    itemName: row.item_name,
    category: row.category,
    quantity: row.quantity,
    unit: row.unit,
    unitPrice: row.unit_price,
    totalPrice: row.total_price,
    packageSize: row.package_size,
  };
}

function mapPurchaseRow(row: PurchaseRow): Purchase {
  return {
    id: row.id,
    farmId: row.farm_id,
    farmName: row.farms?.name ?? "Unknown farm",
    purchaseType: row.purchase_type,
    referenceNumber: row.reference_number,
    purchaseDate: row.purchase_date,
    totalAmount: row.total_amount,
    paymentMethod: row.payment_method,
    recordedByName: row.created_by_profile?.name ?? null,
    createdAt: row.created_at,
    items: (row.purchase_items ?? []).map(mapPurchaseItemRow),
  };
}

/** For the receipt view/print — RLS-scoped to the caller's own farm (or Super Admin, any farm). */
export async function getPurchase(id: string): Promise<Purchase> {
  const { data, error } = await supabase.from("purchase_transactions").select(PURCHASE_SELECT).eq("id", id).single();
  if (error) throw error;
  return mapPurchaseRow(data as unknown as PurchaseRow);
}

/**
 * One atomic transaction (record_feed_purchase, 0029_inventory_purchases.sql):
 * inserts the feeds batch, the purchase_transactions/purchase_items receipt,
 * and the matching "Feed" expense (source='inventory_purchase') together —
 * either all three succeed or none do. Returns the new purchase id, to open
 * the receipt with.
 */
export async function recordFeedPurchase(input: FeedPurchaseInput): Promise<string> {
  const { data, error } = await supabase.rpc("record_feed_purchase", {
    p_farm_id: input.farmId,
    p_feed_name: input.feedName,
    p_category: input.category,
    p_brand: input.brand,
    p_batch_number: input.batchNumber,
    p_supplier: input.supplier,
    p_quantity: input.quantity,
    p_unit: input.unit,
    p_package_size: input.packageSize,
    p_unit_price: input.unitPrice,
    p_purchase_date: input.purchaseDate,
    p_expiration_date: input.expirationDate,
    p_remarks: input.remarks,
  });
  if (error) throw error;
  return data as string;
}

/** Same shape as recordFeedPurchase, for vitamins — creates a "Medicine & Vitamins" expense instead. */
export async function recordVitaminPurchase(input: VitaminPurchaseInput): Promise<string> {
  const { data, error } = await supabase.rpc("record_vitamin_purchase", {
    p_farm_id: input.farmId,
    p_vitamin_name: input.vitaminName,
    p_vitamin_type: input.vitaminType,
    p_category: input.category,
    p_brand: input.brand,
    p_batch_number: input.batchNumber,
    p_supplier: input.supplier,
    p_quantity: input.quantity,
    p_unit: input.unit,
    p_package_size: input.packageSize,
    p_unit_price: input.unitPrice,
    p_purchase_date: input.purchaseDate,
    p_expiration_date: input.expirationDate,
    p_remarks: input.remarks,
  });
  if (error) throw error;
  return data as string;
}

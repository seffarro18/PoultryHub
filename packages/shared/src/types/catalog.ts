import { FEED_CATEGORIES, FEED_PACKAGE_SIZES, VITAMIN_CATEGORIES, VITAMIN_TYPES, formatFeedPackaging, type VitaminType, type VitaminUnit } from "./feedVitamin";

/** One selectable feed product (feed_types, migration 0049). farmId null = system default shared by every farm. */
export interface FeedType {
  id: string;
  farmId: string | null;
  brand: string;
  category: (typeof FEED_CATEGORIES)[number];
  packageSize: (typeof FEED_PACKAGE_SIZES)[number];
  isActive: boolean;
}

export interface FeedTypeInput {
  brand: string;
  category: FeedType["category"];
  packageSize: FeedType["packageSize"];
}

/** One selectable vitamin/supplement (vitamin_types, migration 0049). */
export interface VitaminTypeItem {
  id: string;
  farmId: string | null;
  name: string;
  category: VitaminCatalogCategory;
  productForm: VitaminType;
  defaultUnit: VitaminUnit;
  packageSize: string | null;
  isActive: boolean;
}

export interface VitaminTypeInput {
  name: string;
  category: VitaminCatalogCategory;
  productForm: VitaminType;
  defaultUnit: VitaminUnit;
  packageSize: string | null;
}

export const VITAMIN_CATALOG_CATEGORIES = [...VITAMIN_CATEGORIES, "Other"] as const;
export type VitaminCatalogCategory = (typeof VITAMIN_CATALOG_CATEGORIES)[number];
export const VITAMIN_PRODUCT_FORMS = VITAMIN_TYPES;

/** "New Hope Feeds — Layer — 25 kg Sack" */
export function feedTypeLabel(t: Pick<FeedType, "brand" | "category" | "packageSize">): string {
  return `${t.brand} — ${t.category} — ${formatFeedPackaging(t.packageSize)}`;
}

/** Same comparison the database duplicate guard uses (catalog_key). */
export function catalogKey(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

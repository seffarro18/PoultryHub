/** Own alias, not cross-imported from types/eggProduction.ts — same shape, independent domain. */
export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface FeedBatch {
  id: string;
  farmId: string;
  farmName: string;
  feedName: string;
  category: string | null;
  brand: string | null;
  batchNumber: string | null;
  supplier: string | null;
  /** Original purchased amount — immutable audit reference, never touched by distribution. */
  quantity: number;
  unit: string;
  remainingStock: number;
  minimumStockLevel: number;
  purchaseDate: string;
  expirationDate: string | null;
  storageLocation: string | null;
  remarks: string | null;
  recordedByName: string | null;
  createdAt: string;
}

export interface FeedBatchInput {
  farmId: string;
  feedName: string;
  category: string | null;
  brand: string | null;
  batchNumber: string | null;
  supplier: string | null;
  quantity: number;
  unit: string;
  remainingStock: number;
  minimumStockLevel: number;
  purchaseDate: string;
  expirationDate: string | null;
  storageLocation: string | null;
  remarks: string | null;
}

export interface VitaminBatch {
  id: string;
  farmId: string;
  farmName: string;
  vitaminName: string;
  category: string | null;
  brand: string | null;
  batchNumber: string | null;
  supplier: string | null;
  quantity: number;
  unit: string;
  remainingStock: number;
  minimumStockLevel: number;
  purchaseDate: string;
  expirationDate: string;
  storageLocation: string | null;
  remarks: string | null;
  recordedByName: string | null;
  createdAt: string;
}

export interface VitaminBatchInput {
  farmId: string;
  vitaminName: string;
  category: string | null;
  brand: string | null;
  batchNumber: string | null;
  supplier: string | null;
  quantity: number;
  unit: string;
  remainingStock: number;
  minimumStockLevel: number;
  purchaseDate: string;
  expirationDate: string;
  storageLocation: string | null;
  remarks: string | null;
}

export interface FeedDistributionRecord {
  id: string;
  farmId: string;
  farmName: string;
  feedId: string;
  feedName: string;
  housePen: string;
  quantityUsed: number;
  unit: string;
  numberOfChickens: number;
  distributionDate: string;
  recordedById: string | null;
  recordedByName: string | null;
  status: ApprovalStatus;
  reviewNotes: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  remarks: string | null;
  createdAt: string;
}

export interface FeedDistributionInput {
  farmId: string;
  feedId: string;
  housePen: string;
  quantityUsed: number;
  unit: string;
  numberOfChickens: number;
  distributionDate: string;
  remarks: string | null;
}

export interface VitaminAdministrationRecord {
  id: string;
  farmId: string;
  farmName: string;
  vitaminId: string;
  vitaminName: string;
  housePen: string;
  dosage: string | null;
  quantityUsed: number;
  unit: string;
  administrationDate: string;
  purpose: string | null;
  recordedById: string | null;
  recordedByName: string | null;
  status: ApprovalStatus;
  reviewNotes: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  remarks: string | null;
  createdAt: string;
}

export interface VitaminAdministrationInput {
  farmId: string;
  vitaminId: string;
  housePen: string;
  dosage: string | null;
  quantityUsed: number;
  unit: string;
  administrationDate: string;
  purpose: string | null;
  remarks: string | null;
}

export const FEED_UNIT_SUGGESTIONS = ["kg", "sacks", "liters", "pcs"];
export const VITAMIN_UNIT_SUGGESTIONS = ["ml", "liters", "bottles", "sachets", "pcs"];
export const FEED_CATEGORY_SUGGESTIONS = ["Starter", "Grower", "Layer", "Finisher", "Broiler"];
export const VITAMIN_CATEGORY_SUGGESTIONS = ["Vitamin Supplement", "Antibiotic", "Dewormer", "Electrolyte", "Mineral"];

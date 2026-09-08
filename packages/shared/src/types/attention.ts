export type AttentionModule =
  | "egg_production"
  | "feed_inventory"
  | "vitamin_inventory"
  | "health_records"
  | "mortality_records"
  | "staff_management";

export type AttentionPriority = "high" | "medium" | "low";

export interface AttentionItem {
  /** `${module}:${referenceId}` — stable across refreshes, used as the attention_state key. */
  id: string;
  module: AttentionModule;
  /** The underlying record's id for a per-record item, or a synthetic key (e.g. "pending", "alert") for an aggregate item. */
  referenceId: string;
  title: string;
  description: string;
  priority: AttentionPriority;
  actionLabel: string;
  createdAt: string;
  isRead: boolean;
  dismissed: boolean;
}

export const PRIORITY_ORDER: Record<AttentionPriority, number> = { high: 0, medium: 1, low: 2 };

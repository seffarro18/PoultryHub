import { supabase } from "./supabaseClient";
import { listEggProductionRecords } from "./eggProductionService";
import { listHealthRecords, untreatedOpenCases } from "./healthRecordService";
import { listMortalityRecords } from "./mortalityRecordService";
import { listInventoryEvents, mortalityAlerts } from "./poultryInventoryService";
import { listFeedBatches, listVitaminBatches } from "./feedVitaminService";
import { listFarmStaff } from "./staffService";
import type { AttentionItem, AttentionModule, AttentionPriority } from "../types/attention";

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function makeItem(
  module: AttentionModule,
  referenceId: string,
  title: string,
  description: string,
  priority: AttentionPriority,
  actionLabel: string,
  createdAt: string
): AttentionItem {
  return {
    id: `${module}:${referenceId}`,
    module,
    referenceId,
    title,
    description,
    priority,
    actionLabel,
    createdAt,
    isRead: false,
    dismissed: false,
  };
}

/**
 * Farm Admin/Manager: their farm's open issue queue across every module.
 * Everything here is computed from the same RLS-scoped list functions the
 * module pages themselves already call — nothing is duplicated or stored,
 * so this can never drift from the real records (an approved record just
 * stops matching the "pending" filter next refresh, no bookkeeping needed).
 * `includeStaff` is false for Manager, which has no staff-management access
 * (mirrors farmNavigation.ts's own managerNavigation filter).
 */
export async function listFarmAdminAttentionItems(includeStaff: boolean): Promise<AttentionItem[]> {
  const [eggRecords, healthRecords, mortalityRecords, inventoryEvents, feedBatches, vitaminBatches, staff] = await Promise.all([
    listEggProductionRecords(),
    listHealthRecords(),
    listMortalityRecords(),
    listInventoryEvents(),
    listFeedBatches(),
    listVitaminBatches(),
    includeStaff ? listFarmStaff() : Promise.resolve([]),
  ]);

  const items: AttentionItem[] = [];
  const now = new Date().toISOString();

  const pendingEggs = eggRecords.filter((r) => r.status === "pending");
  if (pendingEggs.length > 0) {
    items.push(
      makeItem(
        "egg_production",
        "pending",
        `${plural(pendingEggs.length, "Egg Production Record")} Awaiting Approval`,
        "Staff submissions need review.",
        "medium",
        "Review Records",
        pendingEggs[0].createdAt ?? now
      )
    );
  }

  for (const feed of feedBatches) {
    if (feed.remainingStock > feed.minimumStockLevel) continue;
    const critical = feed.remainingStock <= 0;
    items.push(
      makeItem(
        "feed_inventory",
        feed.id,
        `${feed.feedName} is ${critical ? "out of stock" : "low on stock"}`,
        `${feed.remainingStock} ${feed.unit} remaining (minimum ${feed.minimumStockLevel} ${feed.unit}).`,
        critical ? "high" : "medium",
        "View Inventory",
        now
      )
    );
  }

  for (const vitamin of vitaminBatches) {
    if (vitamin.remainingStock > vitamin.minimumStockLevel) continue;
    const critical = vitamin.remainingStock <= 0;
    items.push(
      makeItem(
        "vitamin_inventory",
        vitamin.id,
        `${vitamin.vitaminName} is ${critical ? "out of stock" : "low on stock"}`,
        `${vitamin.remainingStock} ${vitamin.unit} remaining (minimum ${vitamin.minimumStockLevel} ${vitamin.unit}).`,
        critical ? "high" : "medium",
        "View Inventory",
        now
      )
    );
  }

  const pendingHealth = healthRecords.filter((r) => r.status === "pending");
  if (pendingHealth.length > 0) {
    items.push(
      makeItem(
        "health_records",
        "pending",
        `${plural(pendingHealth.length, "Health Record")} Require Review`,
        "New health observations from staff need review.",
        "medium",
        "Review Health Records",
        pendingHealth[0].createdAt ?? now
      )
    );
  }

  const followUp = untreatedOpenCases(healthRecords);
  if (followUp.length > 0) {
    items.push(
      makeItem(
        "health_records",
        "follow-up",
        `${plural(followUp.length, "Health Case")} Need Follow-Up`,
        "Approved cases with no treatment recorded yet.",
        "medium",
        "Review Health Records",
        now
      )
    );
  }

  const pendingMortality = mortalityRecords.filter((r) => r.status === "pending");
  if (pendingMortality.length > 0) {
    items.push(
      makeItem(
        "mortality_records",
        "pending",
        `${plural(pendingMortality.length, "Mortality Record")} Require Review`,
        "New mortality reports from staff need review.",
        "medium",
        "Review Mortality",
        pendingMortality[0].createdAt ?? now
      )
    );
  }

  const [alert] = mortalityAlerts(inventoryEvents, mortalityRecords);
  if (alert) {
    items.push(
      makeItem(
        "mortality_records",
        "alert",
        "Mortality Rate Is Above Normal",
        `${alert.ratePercent.toFixed(1)}% of stock lost in the last 7 days.`,
        "high",
        "Review Mortality",
        now
      )
    );
  }

  if (includeStaff) {
    const pendingStaff = staff.filter((s) => s.status === "pending");
    if (pendingStaff.length > 0) {
      items.push(
        makeItem(
          "staff_management",
          "pending",
          `${plural(pendingStaff.length, "Staff Account")} Pending Activation`,
          "New staff accounts are waiting to be activated.",
          "low",
          "View Staff",
          now
        )
      );
    }
  }

  return items;
}

/**
 * Staff: their own personal task list — records they submitted that were
 * rejected and need correction/resubmission. RLS lets Staff see their whole
 * farm's records (not just their own), so this filters to `recordedById`
 * client-side the same way the existing Staff pages already do.
 */
export async function listStaffAttentionItems(userId: string): Promise<AttentionItem[]> {
  const [eggRecords, healthRecords, mortalityRecords] = await Promise.all([
    listEggProductionRecords(),
    listHealthRecords(),
    listMortalityRecords(),
  ]);

  const items: AttentionItem[] = [];

  for (const record of eggRecords) {
    if (record.recordedById !== userId || record.status !== "rejected") continue;
    items.push(
      makeItem(
        "egg_production",
        record.id,
        "Egg Production Record Rejected",
        record.reviewNotes?.trim() || "Review the record and correct it.",
        "medium",
        "Review & Correct",
        record.reviewedAt ?? record.createdAt
      )
    );
  }

  for (const record of healthRecords) {
    if (record.recordedById !== userId || record.status !== "rejected") continue;
    items.push(
      makeItem(
        "health_records",
        record.id,
        "Health Record Rejected",
        record.reviewNotes?.trim() || "Review the record and correct it.",
        "medium",
        "Review & Correct",
        record.reviewedAt ?? record.createdAt
      )
    );
  }

  for (const record of mortalityRecords) {
    if (record.recordedById !== userId || record.status !== "rejected") continue;
    items.push(
      makeItem(
        "mortality_records",
        record.id,
        "Mortality Record Rejected",
        record.reviewNotes?.trim() || "Review the record and correct it.",
        "medium",
        "Review & Correct",
        record.reviewedAt ?? record.createdAt
      )
    );
  }

  return items;
}

// ── Per-user read/dismiss overlay ─────────────────────────────────────────

export interface AttentionStateRow {
  module: string;
  referenceId: string;
  isRead: boolean;
  dismissed: boolean;
}

/** All of the current user's read/dismiss state in one call — merged client-side onto whatever listXAttentionItems() returned. */
export async function listAttentionState(): Promise<AttentionStateRow[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const { data, error } = await supabase
    .from("attention_state")
    .select("module, reference_id, is_read, dismissed")
    .eq("user_id", auth.user.id);
  if (error) throw error;
  return (data ?? []).map((row) => ({ module: row.module, referenceId: row.reference_id, isRead: row.is_read, dismissed: row.dismissed }));
}

export async function markAttentionItemRead(module: AttentionModule, referenceId: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not signed in.");
  const { error } = await supabase
    .from("attention_state")
    .upsert({ user_id: auth.user.id, module, reference_id: referenceId, is_read: true }, { onConflict: "user_id,module,reference_id" });
  if (error) throw error;
}

export async function dismissAttentionItem(module: AttentionModule, referenceId: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not signed in.");
  const { error } = await supabase.from("attention_state").upsert(
    { user_id: auth.user.id, module, reference_id: referenceId, is_read: true, dismissed: true, dismissed_at: new Date().toISOString() },
    { onConflict: "user_id,module,reference_id" }
  );
  if (error) throw error;
}

import { supabase } from "./supabaseClient";
import { listEggProductionRecords } from "./eggProductionService";
import { listMortalityRecords } from "./mortalityRecordService";
import { listInventoryEvents, mortalityAlerts } from "./poultryInventoryService";
import { listFeedBatches, listVitaminBatches } from "./feedVitaminService";
import { listFarmStaff } from "./staffService";
import { listTaskComments, listTasks } from "./taskService";
import { isTaskOverdue } from "../types/task";
import { feedStockStatus, vitaminStockStatus } from "../types/feedVitamin";
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
  createdAt: string,
  farm?: { id: string; name: string }
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
    ...(farm ? { farmId: farm.id, farmName: farm.name } : {}),
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
  const [eggRecords, mortalityRecords, inventoryEvents, feedBatches, vitaminBatches, staff, tasks] = await Promise.all([
    listEggProductionRecords(),
    listMortalityRecords(),
    listInventoryEvents(),
    listFeedBatches(),
    listVitaminBatches(),
    includeStaff ? listFarmStaff() : Promise.resolve([]),
    listTasks(),
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
    const status = feedStockStatus(feed.remainingStock);
    if (status === "normal") continue;
    const critical = status === "out";
    items.push(
      makeItem(
        "feed_inventory",
        feed.id,
        `${feed.feedName} is ${critical ? "out of stock" : "low on stock"}`,
        `${feed.remainingStock} ${feed.unit} remaining.`,
        critical ? "high" : "medium",
        "View Inventory",
        now
      )
    );
  }

  for (const vitamin of vitaminBatches) {
    const status = vitaminStockStatus(vitamin.remainingStock);
    if (status === "normal") continue;
    const critical = status === "out";
    items.push(
      makeItem(
        "vitamin_inventory",
        vitamin.id,
        `${vitamin.vitaminName} is ${critical ? "out of stock" : "low on stock"}`,
        `${vitamin.remainingStock} ${vitamin.unit} remaining.`,
        critical ? "high" : "medium",
        "View Inventory",
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

  // Blocked tasks get their own item each (a distinct reason per task, not a
  // queue of interchangeable ones). Overdue is checked only among tasks NOT
  // already blocked, so one stuck task doesn't get flagged twice for
  // overlapping reasons.
  for (const task of tasks) {
    if (task.status !== "blocked") continue;
    items.push(
      makeItem(
        "tasks",
        task.id,
        task.title,
        `Blocked — assigned to ${task.assignedToName ?? "a staff member"}.`,
        "high",
        "Review Task",
        task.updatedAt
      )
    );
  }
  for (const task of tasks) {
    if (task.status === "blocked" || !isTaskOverdue(task)) continue;
    items.push(
      makeItem(
        "tasks",
        task.id,
        task.title,
        `Overdue — assigned to ${task.assignedToName ?? "a staff member"}.`,
        "medium",
        "Review Task",
        task.scheduledEnd ?? task.createdAt
      )
    );
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
  const [eggRecords, mortalityRecords, tasks] = await Promise.all([
    listEggProductionRecords(),
    listMortalityRecords(),
    listTasks(),
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

  const myTasks = tasks.filter((t) => t.assignedToId === userId);

  for (const task of myTasks) {
    if (task.status !== "pending") continue;
    items.push(makeItem("tasks", task.id, `New Task: ${task.title}`, "Tap to view details and get started.", "medium", "View Task", task.createdAt));
  }

  // Farm Admin/Manager replies on the Staff member's own tasks — each reply
  // becomes its own item so the existing attention_state read/dismiss
  // overlay tracks them individually, same as every other per-record item.
  // Skipped for completed tasks: a reply there is rare and low-stakes enough
  // not to justify N more per-task comment fetches on every refresh.
  const activeTasks = myTasks.filter((t) => t.status !== "completed");
  const commentLists = await Promise.all(activeTasks.map((t) => listTaskComments(t.id)));
  activeTasks.forEach((task, i) => {
    for (const comment of commentLists[i]) {
      if (comment.userId === userId) continue;
      items.push(
        makeItem(
          "tasks",
          comment.id,
          `Reply on ${task.title}`,
          comment.comment,
          "medium",
          "View Task",
          comment.createdAt
        )
      );
    }
  });

  return items;
}

/**
 * Super Admin: platform-wide issues significant enough to cross farm
 * boundaries — deliberately a narrower bar than Farm Admin's own view of the
 * same data, since routine per-farm work (pending approvals, ordinary low
 * stock) is that farm's own Farm Admin's job, not something every farm's
 * routine business should surface to Super Admin. Only genuinely critical,
 * cross-farm-comparable signals make it here: out-of-stock (not just "low")
 * inventory, and an actual mortality-rate threshold breach. (A "Multiple
 * Health Concerns" signal used to live here too — removed along with the
 * Health Records module.)
 *
 * Egg production approval queues and "new farm registration" are
 * deliberately not included: approvals are Farm Admin's own workflow (Super
 * Admin isn't meant to have farm-level editing/approval permissions here),
 * and this schema has no "pending registration" farm status to key off —
 * farms are created directly by Super Admin, not self-registered.
 */
export async function listSuperAdminAttentionItems(): Promise<AttentionItem[]> {
  const [mortalityRecords, inventoryEvents, feedBatches, vitaminBatches] = await Promise.all([
    listMortalityRecords(),
    listInventoryEvents(),
    listFeedBatches(),
    listVitaminBatches(),
  ]);

  const items: AttentionItem[] = [];
  const now = new Date().toISOString();

  for (const alert of mortalityAlerts(inventoryEvents, mortalityRecords)) {
    items.push(
      makeItem(
        "mortality_records",
        `alert:${alert.farmId}`,
        "Mortality Rate Is Above Normal",
        `${alert.ratePercent.toFixed(1)}% of stock lost in the last 7 days.`,
        "high",
        "Review Mortality",
        now,
        { id: alert.farmId, name: alert.farmName }
      )
    );
  }

  for (const feed of feedBatches) {
    if (feed.remainingStock > 0) continue;
    items.push(
      makeItem(
        "feed_inventory",
        feed.id,
        `${feed.feedName} Is Out of Stock`,
        `No ${feed.unit} remaining at ${feed.farmName}.`,
        "high",
        "View Inventory",
        now,
        { id: feed.farmId, name: feed.farmName }
      )
    );
  }

  for (const vitamin of vitaminBatches) {
    if (vitamin.remainingStock > 0) continue;
    items.push(
      makeItem(
        "vitamin_inventory",
        vitamin.id,
        `${vitamin.vitaminName} Is Out of Stock`,
        `No ${vitamin.unit} remaining at ${vitamin.farmName}.`,
        "high",
        "View Inventory",
        now,
        { id: vitamin.farmId, name: vitamin.farmName }
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

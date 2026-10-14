import { listInventoryEvents } from "./poultryInventoryService";
import { listMortalityRecords } from "./mortalityRecordService";
import { listEggProductionRecords } from "./eggProductionService";
import { listExpenses, listSales } from "./salesExpensesService";
import { listPurchases } from "./purchaseService";
import { listFeedBatches, listFeedDistributionRecords, listVitaminAdministrationRecords, listVitaminBatches } from "./feedVitaminService";
import { listTasks } from "./taskService";
import { listAuditLogsInRange } from "./auditLogService";
import { listFeedConsumptionUnits } from "./eggPricingService";
import type { PoultryEvent } from "../types/poultryInventory";
import type { MortalityRecord } from "../types/mortality";
import type { EggProductionRecord } from "../types/eggProduction";
import type { ExpenseRecord, SaleRecord } from "../types/salesExpenses";
import type { Purchase } from "../types/purchase";
import type { FeedBatch, FeedConsumptionUnit, FeedDistributionRecord, VitaminAdministrationRecord, VitaminBatch } from "../types/feedVitamin";
import type { Task } from "../types/task";
import type { AuditLogEntry } from "../types/auditLog";
import type { DatasetKey } from "../types/report";
import type { DateRange } from "../lib/reportPeriods";

/**
 * Everything a report can read — each field is only populated when the
 * report asked for that dataset. All of it comes from the same list*()
 * services the operational modules use, so RLS scopes it exactly the same
 * way (Farm Admin/Manager: own farm; Staff: what Staff may see; Super Admin:
 * all farms, narrowed by the farm selector afterwards).
 */
export interface ReportData {
  events: PoultryEvent[];
  mortality: MortalityRecord[];
  eggs: EggProductionRecord[];
  sales: SaleRecord[];
  expenses: ExpenseRecord[];
  purchases: Purchase[];
  feeds: FeedBatch[];
  vitamins: VitaminBatch[];
  feedDistribution: FeedDistributionRecord[];
  vitaminAdministration: VitaminAdministrationRecord[];
  tasks: Task[];
  audit: AuditLogEntry[];
  /** True when the audit query hit its row cap — the report says so instead of pretending the list is complete. */
  auditTruncated: boolean;
  /** Each farm's Feed Consumption Unit (farm id → unit) — loaded with any feed dataset; feed reports display in it. */
  feedUnits: Record<string, FeedConsumptionUnit>;
}

export function emptyReportData(): ReportData {
  return {
    events: [],
    mortality: [],
    eggs: [],
    sales: [],
    expenses: [],
    purchases: [],
    feeds: [],
    vitamins: [],
    feedDistribution: [],
    vitaminAdministration: [],
    tasks: [],
    audit: [],
    auditTruncated: false,
    feedUnits: {},
  };
}

/**
 * Loads only the requested datasets, in parallel. Any failure rejects the
 * whole load — a report never renders from a partial (and therefore wrong)
 * set of numbers, and an error is never turned into zero.
 */
export async function loadReportData(keys: DatasetKey[], range: DateRange): Promise<ReportData> {
  const data = emptyReportData();
  const want = new Set(keys);
  const jobs: Promise<void>[] = [];

  if (want.has("events")) jobs.push(listInventoryEvents().then((v) => void (data.events = v)));
  if (want.has("mortality")) jobs.push(listMortalityRecords().then((v) => void (data.mortality = v)));
  if (want.has("eggs")) jobs.push(listEggProductionRecords().then((v) => void (data.eggs = v)));
  if (want.has("sales")) jobs.push(listSales().then((v) => void (data.sales = v)));
  if (want.has("expenses")) jobs.push(listExpenses().then((v) => void (data.expenses = v)));
  if (want.has("purchases")) jobs.push(listPurchases().then((v) => void (data.purchases = v)));
  // Archived batches are excluded by RLS for farm roles; Super Admin's
  // policy has no such filter, so drop them here too — every role then sees
  // the same active stock the inventory screens show.
  if (want.has("feeds")) jobs.push(listFeedBatches().then((v) => void (data.feeds = v.filter((b) => !b.archivedAt))));
  if (want.has("vitamins")) jobs.push(listVitaminBatches().then((v) => void (data.vitamins = v.filter((b) => !b.archivedAt))));
  if (want.has("feedDistribution")) jobs.push(listFeedDistributionRecords().then((v) => void (data.feedDistribution = v)));
  if (want.has("vitaminAdministration")) jobs.push(listVitaminAdministrationRecords().then((v) => void (data.vitaminAdministration = v)));
  if (want.has("tasks")) jobs.push(listTasks().then((v) => void (data.tasks = v)));
  if (want.has("feeds") || want.has("feedDistribution")) jobs.push(listFeedConsumptionUnits().then((v) => void (data.feedUnits = v)));
  if (want.has("audit")) {
    jobs.push(
      listAuditLogsInRange(range.from, range.to).then((v) => {
        data.audit = v.entries;
        data.auditTruncated = v.truncated;
      })
    );
  }

  await Promise.all(jobs);
  return data;
}

/** Super Admin's farm selector — narrows every dataset to one farm. */
export function scopeToFarm(data: ReportData, farmId: string | null): ReportData {
  if (!farmId) return data;
  const byFarm = <T extends { farmId: string | null }>(rows: T[]) => rows.filter((r) => r.farmId === farmId);
  return {
    events: byFarm(data.events),
    mortality: byFarm(data.mortality),
    eggs: byFarm(data.eggs),
    sales: byFarm(data.sales),
    expenses: byFarm(data.expenses),
    purchases: byFarm(data.purchases),
    feeds: byFarm(data.feeds),
    vitamins: byFarm(data.vitamins),
    feedDistribution: byFarm(data.feedDistribution),
    vitaminAdministration: byFarm(data.vitaminAdministration),
    tasks: byFarm(data.tasks),
    audit: byFarm(data.audit),
    auditTruncated: data.auditTruncated,
    feedUnits: data.feedUnits,
  };
}

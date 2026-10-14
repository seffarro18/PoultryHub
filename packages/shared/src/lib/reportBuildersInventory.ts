import { currentStockByFarm } from "../services/poultryInventoryService";
import { computeRemainingEggStock } from "../services/eggProductionService";
import { totalEggsForSale } from "../services/salesExpensesService";
import type { ReportData } from "../services/reportDataService";
import { EGG_SIZES, type EggSize } from "../types/eggPricing";
import { GOOD_EGGS_FIELD_BY_SIZE, type EggProductionRecord } from "../types/eggProduction";
import { feedSackKg, formatFeedPackaging, formatFeedStockTotal, formatFeedUsage, formatUnitLabel, type FeedConsumptionUnit } from "../types/feedVitamin";
import type { PoultryEventType } from "../types/poultryInventory";
import { canSeeFinance, type FilterOptions, type ReportContext, type ReportOutput, type ReportRow, type ReportTable, type SummaryCard } from "../types/report";
import { eachDay, formatRange, inRange, isIncomplete, weekStart, type DateRange } from "./reportPeriods";
import {
  addInto,
  breakdownTable,
  distinct,
  fmtNumber,
  fmtQty,
  fmtSigned,
  matches,
  pctChange,
  ref,
  statusLabel,
  sumBy,
  withFarmColumn,
} from "./reportUtils";

type Status = "pending" | "approved" | "rejected";

// ═════════════════════════════════════════════════════════════════════════
// Layers
// ═════════════════════════════════════════════════════════════════════════

export const LAYER_EVENT_LABEL: Record<Exclude<PoultryEventType, "mortality"> | "mortality_record", string> = {
  arrival: "New Arrival",
  transfer: "Transfer",
  sale: "Sale",
  culling: "Culling",
  count_update: "Count Correction",
  mortality_record: "Mortality",
};

export interface LayerMovement {
  id: string;
  farmId: string;
  farm: string;
  date: string;
  createdAt: string;
  reference: string;
  kind: keyof typeof LAYER_EVENT_LABEL;
  fromHouse: string | null;
  toHouse: string | null;
  breed: string | null;
  ageWeeks: number | null;
  /** Birds on the record (count corrections keep their sign). */
  quantity: number;
  /** Effect on the farm-wide total — 0 for a transfer. */
  farmDelta: number;
  status: Status;
  submittedBy: string | null;
  approvedBy: string | null;
  reviewedAt: string | null;
  notes: string | null;
}

/**
 * Every layer stock movement, all statuses — the same rules as
 * currentStockByFarm(): arrivals and count corrections add, sales and culling
 * subtract, transfers move birds between pens without changing the farm
 * total, and mortality comes from the Mortality module's records (the event
 * log's deprecated 'mortality' type is ignored, exactly as the stock
 * calculation ignores it). Only `status === "approved"` rows are official.
 */
export function layerMovements(data: ReportData): LayerMovement[] {
  const out: LayerMovement[] = [];
  for (const e of data.events) {
    if (e.eventType === "mortality") continue;
    const signed = e.eventType === "sale" || e.eventType === "culling" ? -e.quantity : e.eventType === "transfer" ? 0 : e.quantity;
    out.push({
      id: e.id,
      farmId: e.farmId,
      farm: e.farmName,
      date: e.eventDate,
      createdAt: e.createdAt,
      reference: ref("PI", e.id),
      kind: e.eventType,
      fromHouse: e.fromHousePen,
      toHouse: e.toHousePen,
      breed: e.breed,
      ageWeeks: e.ageWeeks,
      quantity: e.quantity,
      farmDelta: signed,
      status: e.reviewStatus,
      submittedBy: e.recordedByName,
      approvedBy: e.reviewedByName,
      reviewedAt: e.reviewedAt,
      notes: e.notes,
    });
  }
  for (const m of data.mortality) {
    out.push({
      id: m.id,
      farmId: m.farmId,
      farm: m.farmName,
      date: m.recordDate,
      createdAt: m.createdAt,
      reference: ref("MR", m.id),
      kind: "mortality_record",
      fromHouse: m.housePen,
      toHouse: null,
      breed: null,
      ageWeeks: null,
      quantity: m.deadBirds,
      farmDelta: -m.deadBirds,
      status: m.status,
      submittedBy: m.recordedByName,
      approvedBy: m.reviewedByName,
      reviewedAt: m.reviewedAt,
      notes: m.remarks,
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
}

/** Effect of one movement on a single house/pen. */
export function houseDelta(m: LayerMovement, house: string): number {
  switch (m.kind) {
    case "transfer":
      return (m.toHouse === house ? m.quantity : 0) - (m.fromHouse === house ? m.quantity : 0);
    case "arrival":
    case "count_update":
      return m.toHouse === house ? m.quantity : 0;
    default:
      // sale, culling, mortality
      return m.fromHouse === house ? -m.quantity : 0;
  }
}

function layerScopeDelta(m: LayerMovement, house: string | undefined): number {
  return house ? houseDelta(m, house) : m.farmDelta;
}

function touchesHouse(m: LayerMovement, house: string | undefined): boolean {
  return !house || m.fromHouse === house || m.toHouse === house;
}

function moveHouseLabel(m: LayerMovement): string {
  if (m.kind === "transfer") return `${m.fromHouse ?? "—"} → ${m.toHouse ?? "—"}`;
  return m.toHouse ?? m.fromHouse ?? "—";
}

interface LedgerResult {
  opening: number;
  closing: number;
  rows: ReportRow[];
  inRangeOfficial: LayerMovement[];
  /** Movement id → population immediately before/after it (official only). */
  balances: Map<string, { before: number; after: number }>;
}

/** Running balance over the full history, so the period's opening figure is real, not assumed. */
function runLayerLedger(movements: LayerMovement[], ctx: ReportContext): LedgerResult {
  const house = ctx.filters.house || undefined;
  let balance = 0;
  let opening = 0;
  let openingSet = false;
  const balances = new Map<string, { before: number; after: number }>();
  const inRangeOfficial: LayerMovement[] = [];

  for (const m of movements) {
    if (m.status !== "approved") continue;
    if (m.date > ctx.range.to) break;
    if (!openingSet && m.date >= ctx.range.from) {
      opening = balance;
      openingSet = true;
    }
    const delta = layerScopeDelta(m, house);
    balances.set(m.id, { before: balance, after: balance + delta });
    balance += delta;
    if (m.date >= ctx.range.from) inRangeOfficial.push(m);
  }
  if (!openingSet) opening = balance;

  const rows: ReportRow[] = [];
  for (const m of movements) {
    if (!inRange(m.date, ctx.range)) continue;
    if (!touchesHouse(m, house)) continue;
    if (!matches(ctx.filters, "status", m.status)) continue;
    if (!matches(ctx.filters, "eventType", LAYER_EVENT_LABEL[m.kind])) continue;
    if (ctx.filters.breed && m.breed !== ctx.filters.breed) continue;
    const bal = balances.get(m.id);
    rows.push({
      farm: m.farm,
      date: m.date,
      reference: m.reference,
      type: LAYER_EVENT_LABEL[m.kind],
      house: moveHouseLabel(m),
      breed: m.breed ?? "—",
      age: m.ageWeeks,
      change: m.status === "approved" ? layerScopeDelta(m, house) : null,
      quantity: m.quantity,
      previous: bal ? bal.before : null,
      resulting: bal ? bal.after : null,
      status: statusLabel(m.status),
      submittedBy: m.submittedBy ?? "—",
      approvedBy: m.status === "pending" ? "—" : (m.approvedBy ?? "—"),
      notes: m.notes ?? "",
    });
  }
  return { opening, closing: balance, rows, inRangeOfficial, balances };
}

export function layerFilterOptions(data: ReportData): FilterOptions {
  const movements = layerMovements(data);
  return {
    house: distinct(movements.flatMap((m) => [m.fromHouse, m.toHouse])),
    breed: distinct(data.events.map((e) => e.breed)),
    eventType: Object.values(LAYER_EVENT_LABEL),
    status: ["approved", "pending", "rejected"],
  };
}

export function buildPoultryStockReport(data: ReportData, ctx: ReportContext): ReportOutput {
  const movements = layerMovements(data);
  const house = ctx.filters.house || undefined;
  const ledger = runLayerLedger(movements, ctx);
  const official = ledger.inRangeOfficial.filter((m) => touchesHouse(m, house));
  const sumKind = (kind: LayerMovement["kind"]) => sumBy(official.filter((m) => m.kind === kind), (m) => Math.abs(layerScopeDelta(m, house)));
  const corrections = official.filter((m) => m.kind === "count_update");
  const correctionsUp = sumBy(corrections, (m) => Math.max(layerScopeDelta(m, house), 0));
  const correctionsDown = sumBy(corrections, (m) => Math.min(layerScopeDelta(m, house), 0));
  const transfersIn = house ? sumBy(official.filter((m) => m.kind === "transfer" && m.toHouse === house), (m) => m.quantity) : 0;
  const transfersOut = house ? sumBy(official.filter((m) => m.kind === "transfer" && m.fromHouse === house), (m) => m.quantity) : 0;
  const transferCount = official.filter((m) => m.kind === "transfer").length;
  const outgoing = sumKind("sale") + sumKind("culling") + sumKind("mortality_record");

  const summary: SummaryCard[] = [
    { label: "Opening Active Layers", value: `${fmtNumber(ledger.opening)} birds`, hint: house ? `${house}, start of period` : "Start of period" },
    { label: "New Arrivals", value: `+${fmtNumber(sumKind("arrival"))}`, tone: "positive" },
    ...(house
      ? [
          { label: "Transfers In", value: `+${fmtNumber(transfersIn)}` },
          { label: "Transfers Out", value: `−${fmtNumber(transfersOut)}` },
        ]
      : [{ label: "Transfers", value: `${transferCount}`, hint: "Moves between pens — farm total unchanged" }]),
    { label: "Layer Sales", value: `−${fmtNumber(sumKind("sale"))}` },
    { label: "Culling", value: `−${fmtNumber(sumKind("culling"))}` },
    { label: "Mortality", value: `−${fmtNumber(sumKind("mortality_record"))}`, tone: sumKind("mortality_record") > 0 ? "negative" : "default" },
    { label: "Count Corrections", value: `+${fmtNumber(correctionsUp)} / ${fmtNumber(correctionsDown)}` },
    { label: "Total Outgoing Birds", value: `−${fmtNumber(outgoing)}` },
    { label: "Closing Active Layers", value: `${fmtNumber(ledger.closing)} birds`, hint: `As of ${formatRange({ from: ctx.range.to, to: ctx.range.to })}` },
  ];

  const notes = [
    "Closing = Opening + Arrivals + Transfers In − Transfers Out − Sales − Culling − Mortality ± Count Corrections. Only approved records count; pending and rejected submissions are listed but never change stock.",
  ];
  if (!house && !isIncomplete(ctx.range, ctx.today) && ctx.range.to === ctx.today) {
    // Reconciles against the exact function the Dashboard's Total Layers card uses.
    const current = currentStockByFarm(data.events, data.mortality).reduce((s, f) => s + f.totalStock, 0);
    notes.push(
      current === ledger.closing
        ? `Reconciled: closing balance matches current Poultry Inventory stock (${fmtNumber(current)} birds).`
        : `Reconciliation difference: Poultry Inventory currently shows ${fmtNumber(current)} birds vs ${fmtNumber(ledger.closing)} here.`
    );
  } else if (!house) {
    notes.push("Closing is the balance at the end of the selected period (current stock reconciliation applies when the period ends today).");
  }
  if (house) notes.push(`House view: transfers in/out of ${house} change its balance; mortality is attributed by the house recorded on each mortality record.`);
  if (ctx.filters.eventType || ctx.filters.breed || ctx.filters.status) {
    notes.push("Event type, breed and status filters narrow the transaction list; opening/closing balances always include every approved movement in scope.");
  }

  const ledgerTable: ReportTable = {
    id: "ledger",
    title: "Layer Transactions",
    description: "Every inventory event and mortality record in the period, with the population before and after each approved movement.",
    columns: withFarmColumn(ctx, [
      { key: "date", label: "Date", format: "date" },
      { key: "reference", label: "Reference" },
      { key: "type", label: "Event Type" },
      { key: "house", label: "House / Pen" },
      { key: "breed", label: "Breed / Strain" },
      { key: "age", label: "Age (wks)", format: "number" },
      { key: "quantity", label: "Birds on Record", format: "number" },
      { key: "change", label: "Stock Change", format: "signed" },
      { key: "previous", label: "Previous Qty", format: "number" },
      { key: "resulting", label: "Resulting Qty", format: "number" },
      { key: "status", label: "Status", format: "status" },
      { key: "submittedBy", label: "Submitted By" },
      { key: "approvedBy", label: "Reviewed By" },
      { key: "notes", label: "Notes" },
    ]),
    rows: ledger.rows,
    sort: { key: "date", dir: "asc" },
  };

  // Balances per house at period end (approved, all history up to `to`).
  const houseBalances = new Map<string, ReportRow>();
  for (const m of movements) {
    if (m.status !== "approved" || m.date > ctx.range.to) continue;
    for (const h of [m.fromHouse, m.toHouse]) {
      if (!h) continue;
      const row = houseBalances.get(h) ?? { closing: 0, inPeriod: 0 };
      houseBalances.set(h, row);
    }
  }
  for (const [h, row] of houseBalances) {
    const relevant = movements.filter((m) => m.status === "approved" && m.date <= ctx.range.to);
    row.closing = sumBy(relevant, (m) => houseDelta(m, h));
    row.inPeriod = sumBy(relevant.filter((m) => m.date >= ctx.range.from), (m) => houseDelta(m, h));
  }

  const byType = new Map<string, ReportRow>();
  for (const m of official) {
    const row = byType.get(LAYER_EVENT_LABEL[m.kind]) ?? { records: 0, birds: 0 };
    addInto(row, { records: 1, birds: layerScopeDelta(m, house) });
    byType.set(LAYER_EVENT_LABEL[m.kind], row);
  }
  const byBreed = new Map<string, ReportRow>();
  for (const m of official.filter((x) => x.kind === "arrival")) {
    const key = m.breed ?? "Not recorded";
    const row = byBreed.get(key) ?? { arrivals: 0, birds: 0 };
    addInto(row, { arrivals: 1, birds: m.quantity });
    byBreed.set(key, row);
  }
  const byDate = new Map<string, ReportRow>();
  for (const m of official) {
    const row = byDate.get(m.date) ?? { net: 0 };
    addInto(row, { net: layerScopeDelta(m, house) });
    byDate.set(m.date, row);
  }
  const byStatus = new Map<string, ReportRow>();
  for (const m of movements.filter((x) => inRange(x.date, ctx.range) && touchesHouse(x, house))) {
    const row = byStatus.get(statusLabel(m.status)) ?? { records: 0, birds: 0 };
    addInto(row, { records: 1, birds: m.quantity });
    byStatus.set(statusLabel(m.status), row);
  }

  return {
    summary,
    notes,
    tables: [
      ledgerTable,
      breakdownTable("byHouse", "Stock by House / Pen", "House / Pen", houseBalances, [
        { key: "inPeriod", label: "Net Change in Period", format: "signed" },
        { key: "closing", label: "Birds at Period End", format: "number" },
      ], { description: "Mortality is placed in the house recorded on each mortality record." }),
      breakdownTable("byType", "Approved Movements by Event Type", "Event Type", byType, [
        { key: "records", label: "Records", format: "number" },
        { key: "birds", label: "Stock Effect", format: "signed" },
      ]),
      breakdownTable("byBreed", "Arrivals by Breed / Strain", "Breed / Strain", byBreed, [
        { key: "arrivals", label: "Arrivals", format: "number" },
        { key: "birds", label: "Birds", format: "number" },
      ]),
      breakdownTable("byDate", "Net Change by Date", "Date", byDate, [{ key: "net", label: "Net Change", format: "signed" }]),
      breakdownTable("byStatus", "Records by Status", "Status", byStatus, [
        { key: "records", label: "Records", format: "number" },
        { key: "birds", label: "Birds on Records", format: "number" },
      ], { description: "Pending and rejected records are shown for completeness — they never affect stock." }),
    ],
  };
}

// ═════════════════════════════════════════════════════════════════════════
// Mortality
// ═════════════════════════════════════════════════════════════════════════

export function mortalityFilterOptions(data: ReportData): FilterOptions {
  return {
    house: distinct(data.mortality.map((m) => m.housePen)),
    status: ["approved", "pending", "rejected"],
    staff: distinct(data.mortality.map((m) => m.recordedByName)),
  };
}

export function buildMortalityReport(data: ReportData, ctx: ReportContext): ReportOutput {
  const movements = layerMovements(data);
  // Farm-wide balances (not house-filtered) for population before/after.
  const farmLedger = runLayerLedger(movements, { ...ctx, filters: {} });
  const records = data.mortality.filter(
    (m) =>
      inRange(m.recordDate, ctx.range) &&
      matches(ctx.filters, "house", m.housePen) &&
      matches(ctx.filters, "status", m.status) &&
      matches(ctx.filters, "staff", m.recordedByName)
  );
  const approved = records.filter((m) => m.status === "approved");
  const totalDead = sumBy(approved, (m) => m.deadBirds);
  const arrivalsInPeriod = sumBy(farmLedger.inRangeOfficial.filter((m) => m.kind === "arrival"), (m) => m.quantity);
  const base = farmLedger.opening + arrivalsInPeriod;

  const summary: SummaryCard[] = [
    { label: "Recorded Mortality", value: `${fmtNumber(totalDead)} birds`, hint: "Approved records", tone: totalDead > 0 ? "negative" : "default" },
    { label: "Records", value: `${approved.length} approved`, hint: `${records.filter((m) => m.status === "pending").length} pending · ${records.filter((m) => m.status === "rejected").length} rejected` },
    { label: "Layers at Period Start", value: `${fmtNumber(farmLedger.opening)} birds` },
    { label: "Layers at Period End", value: `${fmtNumber(farmLedger.closing)} birds` },
  ];
  if (base > 0 && !ctx.filters.house) {
    summary.push({
      label: "Mortality Rate",
      value: `${((totalDead / base) * 100).toFixed(2)}%`,
      hint: `${fmtNumber(totalDead)} ÷ (${fmtNumber(farmLedger.opening)} opening + ${fmtNumber(arrivalsInPeriod)} arrivals)`,
    });
  }

  const rows: ReportRow[] = records.map((m) => {
    const bal = farmLedger.balances.get(m.id);
    return {
      farm: m.farmName,
      date: m.recordDate,
      reference: ref("MR", m.id),
      house: m.housePen,
      dead: m.deadBirds,
      before: bal ? bal.before : null,
      after: bal ? bal.after : null,
      status: statusLabel(m.status),
      recordedBy: m.recordedByName ?? "—",
      reviewedBy: m.status === "pending" ? "—" : (m.reviewedByName ?? "—"),
      reviewedAt: m.reviewedAt,
      photo: m.photoUrl ? "Attached" : "None",
      remarks: m.remarks ?? "",
    };
  });

  const group = (key: (d: string) => string) => {
    const map = new Map<string, ReportRow>();
    for (const m of approved) {
      const row = map.get(key(m.recordDate)) ?? { records: 0, dead: 0 };
      addInto(row, { records: 1, dead: m.deadBirds });
      map.set(key(m.recordDate), row);
    }
    return map;
  };
  const byHouse = new Map<string, ReportRow>();
  for (const m of approved) {
    const row = byHouse.get(m.housePen) ?? { records: 0, dead: 0 };
    addInto(row, { records: 1, dead: m.deadBirds });
    byHouse.set(m.housePen, row);
  }
  const countCols = [
    { key: "records", label: "Records", format: "number" as const },
    { key: "dead", label: "Dead Birds", format: "number" as const },
  ];

  return {
    summary,
    notes: [
      "Only approved mortality records reduce active layers (each record once, on its record date). Population before/after is the farm-wide active layer count around that record.",
      "Cause of death is no longer collected by the mortality form, so it isn't reported here.",
    ],
    tables: [
      {
        id: "records",
        title: "Mortality Records",
        columns: withFarmColumn(ctx, [
          { key: "date", label: "Date", format: "date" },
          { key: "reference", label: "Reference" },
          { key: "house", label: "House / Pen" },
          { key: "dead", label: "Dead Birds", format: "number" },
          { key: "before", label: "Layers Before", format: "number" },
          { key: "after", label: "Layers After", format: "number" },
          { key: "status", label: "Status", format: "status" },
          { key: "recordedBy", label: "Recorded By" },
          { key: "reviewedBy", label: "Reviewed By" },
          { key: "reviewedAt", label: "Reviewed At", format: "datetime" },
          { key: "photo", label: "Photo" },
          { key: "remarks", label: "Remarks" },
        ]),
        rows,
        totals: { dead: totalDead },
        sort: { key: "date", dir: "desc" },
      },
      breakdownTable("daily", "Daily Mortality", "Date", group((d) => d), countCols),
      breakdownTable("weekly", "Weekly Mortality (week starting Monday)", "Week Of", group(weekStart), countCols),
      breakdownTable("monthly", "Monthly Mortality", "Month", group((d) => d.slice(0, 7)), countCols),
      breakdownTable("byHouse", "Mortality by House / Pen", "House / Pen", byHouse, countCols, { sortKey: "dead", sortDir: "desc" }),
    ],
  };
}

// ═════════════════════════════════════════════════════════════════════════
// Egg production
// ═════════════════════════════════════════════════════════════════════════

export function eggFilterOptions(data: ReportData): FilterOptions {
  return {
    house: distinct(data.eggs.map((r) => r.housePen)),
    status: ["approved", "pending", "rejected"],
    staff: distinct(data.eggs.map((r) => r.recordedByName)),
    eggSize: [...EGG_SIZES],
  };
}

function classifiedEggs(r: EggProductionRecord): number {
  return sumBy([...EGG_SIZES], (size) => r[GOOD_EGGS_FIELD_BY_SIZE[size]]);
}

function sizeBreakdownText(r: EggProductionRecord): string {
  const parts = EGG_SIZES.filter((s) => r[GOOD_EGGS_FIELD_BY_SIZE[s]] > 0).map((s) => `${s} ${fmtNumber(r[GOOD_EGGS_FIELD_BY_SIZE[s]])}`);
  const unclassified = r.goodEggs - classifiedEggs(r);
  if (unclassified > 0) parts.push(`Unclassified ${fmtNumber(unclassified)}`);
  return parts.join(" · ") || "—";
}

export function buildEggProductionReport(data: ReportData, ctx: ReportContext): ReportOutput {
  const scoped = data.eggs.filter((r) => matches(ctx.filters, "house", r.housePen) && matches(ctx.filters, "staff", r.recordedByName));
  const inPeriod = scoped.filter((r) => inRange(r.productionDate, ctx.range));
  const listed = inPeriod.filter((r) => matches(ctx.filters, "status", r.status));
  const approved = inPeriod.filter((r) => r.status === "approved");
  const pending = inPeriod.filter((r) => r.status === "pending");
  const rejected = inPeriod.filter((r) => r.status === "rejected");
  const size = ctx.filters.eggSize as EggSize | undefined;
  const sizeCount = (r: EggProductionRecord) => (size ? r[GOOD_EGGS_FIELD_BY_SIZE[size]] : r.goodEggs);

  const collected = sumBy(approved, (r) => r.eggsCollected);
  const good = sumBy(approved, (r) => r.goodEggs);
  const damaged = sumBy(approved, (r) => r.damagedCrackedEggs);
  const days = new Set(approved.map((r) => r.productionDate)).size;
  const prevApproved = ctx.previous ? scoped.filter((r) => r.status === "approved" && inRange(r.productionDate, ctx.previous!)) : [];
  const prevCollected = sumBy(prevApproved, (r) => r.eggsCollected);

  const summary: SummaryCard[] = [
    { label: "Eggs Collected", value: `${fmtNumber(collected)} eggs`, hint: (ctx.previous && pctChange(collected, prevCollected)) || "Approved records only" },
    { label: size ? `Good Eggs — ${size}` : "Good Eggs", value: `${fmtNumber(sumBy(approved, sizeCount))} eggs` },
    { label: "Cracked / Damaged", value: `${fmtNumber(damaged)} eggs`, hint: "Recorded as one combined figure" },
    { label: "Average per Collection Day", value: days > 0 ? `${fmtNumber(collected / days, 0)} eggs` : "—", hint: `${days} day(s) with approved collections` },
    { label: "Pending Review", value: `${fmtNumber(sumBy(pending, (r) => r.eggsCollected))} eggs`, hint: `${pending.length} record(s) — not in totals`, tone: pending.length ? "warning" : "default" },
    { label: "Rejected", value: `${fmtNumber(sumBy(rejected, (r) => r.eggsCollected))} eggs`, hint: `${rejected.length} record(s) — not in totals` },
  ];

  const rows: ReportRow[] = listed.map((r) => ({
    farm: r.farmName,
    date: r.productionDate,
    reference: ref("EP", r.id),
    house: r.housePen,
    collected: r.eggsCollected,
    good: r.goodEggs,
    damaged: r.damagedCrackedEggs,
    sizes: sizeBreakdownText(r),
    status: statusLabel(r.status),
    recordedBy: r.recordedByName ?? "—",
    reviewedBy: r.status === "pending" ? "—" : (r.reviewedByName ?? "—"),
    reviewedAt: r.reviewedAt,
    remarks: r.reviewNotes ? `${r.notes ?? ""}${r.notes ? " · " : ""}Review: ${r.reviewNotes}` : (r.notes ?? ""),
  }));

  const periodGroup = (key: (d: string) => string) => {
    const map = new Map<string, ReportRow>();
    for (const r of approved) {
      const row = map.get(key(r.productionDate)) ?? { collected: 0, good: 0, damaged: 0 };
      addInto(row, { collected: r.eggsCollected, good: r.goodEggs, damaged: r.damagedCrackedEggs });
      map.set(key(r.productionDate), row);
    }
    return map;
  };
  const prodCols = [
    { key: "collected", label: "Collected", format: "number" as const },
    { key: "good", label: "Good", format: "number" as const },
    { key: "damaged", label: "Cracked / Damaged", format: "number" as const },
  ];
  const byHouse = new Map<string, ReportRow>();
  for (const r of approved) {
    const row = byHouse.get(r.housePen) ?? { collected: 0, good: 0, damaged: 0 };
    addInto(row, { collected: r.eggsCollected, good: r.goodEggs, damaged: r.damagedCrackedEggs });
    byHouse.set(r.housePen, row);
  }
  const sizes = new Map<string, ReportRow>();
  for (const s of EGG_SIZES) sizes.set(s, { eggs: sumBy(approved, (r) => r[GOOD_EGGS_FIELD_BY_SIZE[s]]) });
  sizes.set("Unclassified", { eggs: sumBy(approved, (r) => Math.max(r.goodEggs - classifiedEggs(r), 0)) });
  const statusRows = new Map<string, ReportRow>([
    ["Approved (official)", { records: approved.length, eggs: collected }],
    ["Pending", { records: pending.length, eggs: sumBy(pending, (r) => r.eggsCollected) }],
    ["Rejected", { records: rejected.length, eggs: sumBy(rejected, (r) => r.eggsCollected) }],
  ]);

  return {
    summary,
    notes: [
      "Official production = approved egg collection records only. Pending and rejected submissions are listed separately and excluded from every total.",
      "Expected Eggs/Day (active layers × expected rate) is an estimate and is never shown as actual production here.",
      "Egg sizes come from each record's Good Eggs classification; good eggs that weren't classified by size are shown as Unclassified rather than assigned a size. Breed isn't recorded on egg collections.",
    ],
    tables: [
      {
        id: "records",
        title: "Egg Collection Records",
        columns: withFarmColumn(ctx, [
          { key: "date", label: "Date", format: "date" },
          { key: "reference", label: "Reference" },
          { key: "house", label: "House / Pen" },
          { key: "collected", label: "Collected", format: "number" },
          { key: "good", label: "Good", format: "number" },
          { key: "damaged", label: "Cracked / Damaged", format: "number" },
          { key: "sizes", label: "Size Breakdown" },
          { key: "status", label: "Status", format: "status" },
          { key: "recordedBy", label: "Recorded By" },
          { key: "reviewedBy", label: "Reviewed By" },
          { key: "reviewedAt", label: "Reviewed At", format: "datetime" },
          { key: "remarks", label: "Remarks" },
        ]),
        rows,
        totals: { collected: sumBy(listed, (r) => r.eggsCollected), good: sumBy(listed, (r) => r.goodEggs), damaged: sumBy(listed, (r) => r.damagedCrackedEggs) },
        sort: { key: "date", dir: "desc" },
      },
      breakdownTable("status", "By Approval Status", "Status", statusRows, [
        { key: "records", label: "Records", format: "number" },
        { key: "eggs", label: "Eggs Collected", format: "number" },
      ]),
      breakdownTable("daily", "Daily Production (approved)", "Date", periodGroup((d) => d), prodCols),
      breakdownTable("weekly", "Weekly Production (approved, week starting Monday)", "Week Of", periodGroup(weekStart), prodCols),
      breakdownTable("monthly", "Monthly Production (approved)", "Month", periodGroup((d) => d.slice(0, 7)), prodCols),
      breakdownTable("byHouse", "House / Pen Comparison (approved)", "House / Pen", byHouse, prodCols, { sortKey: "collected", sortDir: "desc" }),
      breakdownTable("sizes", "Good Eggs by Size (approved)", "Egg Size", sizes, [{ key: "eggs", label: "Eggs", format: "number" }]),
    ],
  };
}

// ═════════════════════════════════════════════════════════════════════════
// Egg inventory (remaining sellable eggs) — needs Sales, so finance roles only
// ═════════════════════════════════════════════════════════════════════════

interface EggMove {
  date: string;
  createdAt: string;
  reference: string;
  type: string;
  detail: string;
  farm: string;
  /** Per size for itemized movements; "Unclassified"/"Unattributed" otherwise. */
  bySize: Partial<Record<EggSize | "Unclassified" | "Unattributed", number>>;
  total: number;
}

function eggMoves(data: ReportData): EggMove[] {
  const moves: EggMove[] = [];
  for (const r of data.eggs) {
    if (r.status !== "approved") continue;
    const bySize: EggMove["bySize"] = {};
    for (const s of EGG_SIZES) if (r[GOOD_EGGS_FIELD_BY_SIZE[s]] > 0) bySize[s] = r[GOOD_EGGS_FIELD_BY_SIZE[s]];
    const unclassified = r.goodEggs - classifiedEggs(r);
    if (unclassified > 0) bySize.Unclassified = unclassified;
    moves.push({ date: r.productionDate, createdAt: r.createdAt, reference: ref("EP", r.id), type: "Approved Good Eggs", detail: r.housePen, farm: r.farmName, bySize, total: r.goodEggs });
  }
  for (const s of data.sales) {
    if (s.itemCategory !== "Eggs") continue;
    const bySize: EggMove["bySize"] = {};
    for (const item of s.items) bySize[item.eggSize] = (bySize[item.eggSize] ?? 0) - item.eggsCount;
    const total = totalEggsForSale(s);
    if (s.items.length === 0 && total > 0) bySize.Unattributed = -total;
    moves.push({ date: s.saleDate, createdAt: s.createdAt, reference: ref("SL", s.id), type: "Egg Sale", detail: s.buyerName ?? "Walk-in", farm: s.farmName, bySize, total: -total });
  }
  return moves.sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
}

interface EggPosition {
  opening: number;
  added: number;
  sold: number;
  closing: number;
  rows: ReportRow[];
  moves: EggMove[];
}

/** Opening/added/sold/closing sellable eggs for the period (optionally one size). */
function eggPosition(data: ReportData, range: DateRange, size: EggSize | undefined): EggPosition {
  const qty = (m: EggMove) => (size ? (m.bySize[size] ?? 0) : m.total);
  const moves = eggMoves(data).filter((m) => m.date <= range.to);
  let balance = 0;
  let opening = 0;
  let openingSet = false;
  const rows: ReportRow[] = [];
  for (const m of moves) {
    if (!openingSet && m.date >= range.from) {
      opening = balance;
      openingSet = true;
    }
    const q = qty(m);
    const before = balance;
    balance += q;
    if (m.date >= range.from && q !== 0) {
      rows.push({
        farm: m.farm,
        date: m.date,
        reference: m.reference,
        type: m.type,
        detail: m.detail,
        eggsIn: q > 0 ? q : null,
        eggsOut: q < 0 ? -q : null,
        before,
        after: balance,
      });
    }
  }
  if (!openingSet) opening = balance;
  const added = sumBy(rows, (r) => (typeof r.eggsIn === "number" ? r.eggsIn : 0));
  const sold = sumBy(rows, (r) => (typeof r.eggsOut === "number" ? r.eggsOut : 0));
  return { opening, added, sold, closing: balance, rows, moves };
}

export function buildEggInventoryReport(data: ReportData, ctx: ReportContext): ReportOutput {
  const size = (ctx.filters.eggSize || undefined) as EggSize | undefined;
  const { opening, added, sold, closing: balance, rows, moves } = eggPosition(data, ctx.range, size);

  const perSize = new Map<string, ReportRow>();
  for (const key of [...EGG_SIZES, "Unclassified", "Unattributed"] as const) {
    let open = 0;
    let addedS = 0;
    let soldS = 0;
    for (const m of moves) {
      const q = m.bySize[key] ?? 0;
      if (m.date < ctx.range.from) open += q;
      else if (q > 0) addedS += q;
      else soldS -= q;
    }
    if (open || addedS || soldS) perSize.set(key, { opening: open, added: addedS, sold: soldS, closing: open + addedS - soldS });
  }

  const notes = [
    "Closing Remaining Eggs = Opening + Approved Good Eggs − Eggs Sold. Cracked/damaged eggs never enter sellable stock; pending/rejected collections don't either. Selling eggs lowers remaining stock — it never changes recorded production.",
    "Eggs sold before multi-size sales existed have no size, so they appear as Unattributed in the size table; good eggs never classified by size appear as Unclassified.",
  ];
  if (!size && ctx.range.to === ctx.today) {
    const current = computeRemainingEggStock(data.eggs, data.sales);
    notes.push(
      current === balance
        ? `Reconciled: matches Remaining Eggs on the Dashboard (${fmtNumber(current)} eggs).`
        : `Reconciliation difference: Dashboard Remaining Eggs is ${fmtNumber(current)} (floored at zero) vs ${fmtNumber(balance)} here.`
    );
  }

  return {
    summary: [
      { label: size ? `Opening Stock — ${size}` : "Opening Sellable Eggs", value: `${fmtNumber(opening)} eggs` },
      { label: "Approved Good Eggs Added", value: `+${fmtNumber(added)}`, tone: "positive" },
      { label: "Eggs Sold", value: `−${fmtNumber(sold)}` },
      { label: "Closing Remaining Eggs", value: `${fmtNumber(balance)} eggs`, hint: `${fmtNumber(Math.floor(balance / 30))} full trays + ${fmtNumber(balance % 30)} eggs` },
    ],
    notes,
    tables: [
      {
        id: "ledger",
        title: "Egg Stock Movements",
        columns: withFarmColumn(ctx, [
          { key: "date", label: "Date", format: "date" },
          { key: "reference", label: "Reference" },
          { key: "type", label: "Movement" },
          { key: "detail", label: "House / Buyer" },
          { key: "eggsIn", label: "Eggs In", format: "number" },
          { key: "eggsOut", label: "Eggs Out", format: "number" },
          { key: "before", label: "Stock Before", format: "number" },
          { key: "after", label: "Stock After", format: "number" },
        ]),
        rows,
        totals: { eggsIn: added, eggsOut: sold },
        sort: { key: "date", dir: "asc" },
      },
      breakdownTable("bySize", "Stock by Egg Size", "Egg Size", perSize, [
        { key: "opening", label: "Opening", format: "number" },
        { key: "added", label: "Added", format: "number" },
        { key: "sold", label: "Sold", format: "number" },
        { key: "closing", label: "Closing", format: "number" },
      ]),
    ],
  };
}

// ═════════════════════════════════════════════════════════════════════════
// Feed & vitamins — one ledger engine for both
// ═════════════════════════════════════════════════════════════════════════

interface StockItem {
  key: string;
  name: string;
  brand: string | null;
  category: string | null;
  packaging: string;
  unit: string;
}

interface Batch {
  id: string;
  item: StockItem;
  farm: string;
  quantity: number;
  remaining: number;
  purchaseDate: string;
  recordedBy: string | null;
}

interface Usage {
  id: string;
  batchId: string;
  farm: string;
  date: string;
  house: string;
  quantity: number;
  status: Status;
  submittedBy: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  remarks: string | null;
  reviewNotes: string | null;
  extra: Record<string, string | number | null>;
}

interface StockSet {
  kind: "feed" | "vitamin";
  batches: Batch[];
  usage: Usage[];
  /** Usage rows whose batch is archived (not visible) — excluded, and reported as such. */
  orphanUsage: number;
}

/** A farm's Feed Consumption Unit (Feed Consumption Settings); every farm has one, defaulting to sacks. */
export function feedUnitFor(data: ReportData, farmId: string | null): FeedConsumptionUnit {
  return (farmId && data.feedUnits[farmId]) || "sack";
}

/**
 * Feed ledger in each farm's chosen unit. Stock itself is stored in sacks; in
 * kg mode every batch (its purchase, remaining stock and approved usage) is
 * multiplied by THAT batch's own sack size, so opening + in − out = closing
 * still holds exactly. A batch with no sack size can't be weighed — it stays
 * in sacks and totals show it separately ("5,000 kg · 3 Sacks") rather than
 * guessing a size.
 */
function feedStockSet(data: ReportData): StockSet {
  const factorById = new Map<string, number>();
  const batches: Batch[] = data.feeds.map((f) => {
    const kg = feedUnitFor(data, f.farmId) === "kg" ? feedSackKg(f.packageSize) : null;
    const factor = kg ?? 1;
    factorById.set(f.id, factor);
    return {
      id: f.id,
      farm: f.farmName,
      item: {
        key: `${f.feedName}|${f.packageSize ?? ""}`,
        name: f.feedName,
        brand: f.brand,
        category: f.category,
        packaging: formatFeedPackaging(f.packageSize),
        unit: kg !== null ? "kg" : f.unit || "Sack",
      },
      quantity: Number(f.quantity) * factor,
      remaining: Number(f.remainingStock) * factor,
      purchaseDate: f.purchaseDate,
      recordedBy: f.recordedByName,
    };
  });
  const ids = new Set(batches.map((b) => b.id));
  const usage: Usage[] = data.feedDistribution
    .filter((r) => ids.has(r.feedId))
    .map((r) => ({
      id: r.id,
      batchId: r.feedId,
      farm: r.farmName,
      date: r.distributionDate,
      house: r.housePen,
      quantity: Number(r.quantityUsed) * (factorById.get(r.feedId) ?? 1),
      status: r.status,
      submittedBy: r.recordedByName,
      reviewedBy: r.reviewedByName,
      reviewedAt: r.reviewedAt,
      remarks: r.remarks,
      reviewNotes: r.reviewNotes,
      extra: {},
    }));
  return { kind: "feed", batches, usage, orphanUsage: data.feedDistribution.filter((r) => !ids.has(r.feedId)).length };
}

function vitaminStockSet(data: ReportData): StockSet {
  const batches: Batch[] = data.vitamins.map((v) => ({
    id: v.id,
    farm: v.farmName,
    item: {
      key: `${v.vitaminName}|${v.unit}`,
      name: v.vitaminName,
      brand: v.brand,
      category: v.category,
      packaging: v.packageSize ?? "—",
      unit: v.unit,
    },
    quantity: Number(v.quantity),
    remaining: Number(v.remainingStock),
    purchaseDate: v.purchaseDate,
    recordedBy: v.recordedByName,
  }));
  const ids = new Set(batches.map((b) => b.id));
  const usage: Usage[] = data.vitaminAdministration
    .filter((r) => ids.has(r.vitaminId))
    .map((r) => ({
      id: r.id,
      batchId: r.vitaminId,
      farm: r.farmName,
      date: r.administrationDate,
      house: r.housePen,
      quantity: Number(r.quantityUsed),
      status: r.status,
      submittedBy: r.recordedByName,
      reviewedBy: r.reviewedByName,
      reviewedAt: r.reviewedAt,
      remarks: r.remarks,
      reviewNotes: r.reviewNotes,
      extra: { dosage: r.dosage, purpose: r.purpose, stockBefore: r.stockBefore, stockAfter: r.stockAfter },
    }));
  return { kind: "vitamin", batches, usage, orphanUsage: data.vitaminAdministration.filter((r) => !ids.has(r.vitaminId)).length };
}

function itemMatches(set: StockSet, item: StockItem, ctx: ReportContext): boolean {
  if (set.kind === "feed") {
    return matches(ctx.filters, "feedItem", item.name) && matches(ctx.filters, "feedBrand", item.brand) && matches(ctx.filters, "feedCategory", item.category);
  }
  return matches(ctx.filters, "vitamin", item.name) && matches(ctx.filters, "vitaminCategory", item.category);
}

export function feedFilterOptions(data: ReportData): FilterOptions {
  return {
    feedItem: distinct(data.feeds.map((f) => f.feedName)),
    feedBrand: distinct(data.feeds.map((f) => f.brand)),
    feedCategory: distinct(data.feeds.map((f) => f.category)),
    house: distinct(data.feedDistribution.map((r) => r.housePen)),
    status: ["approved", "pending", "rejected"],
    staff: distinct(data.feedDistribution.map((r) => r.recordedByName)),
  };
}

export function vitaminFilterOptions(data: ReportData): FilterOptions {
  return {
    vitamin: distinct(data.vitamins.map((v) => v.vitaminName)),
    vitaminCategory: distinct(data.vitamins.map((v) => v.category)),
    house: distinct(data.vitaminAdministration.map((r) => r.housePen)),
    status: ["approved", "pending", "rejected"],
    staff: distinct(data.vitaminAdministration.map((r) => r.recordedByName)),
  };
}

interface ItemPosition {
  item: StockItem;
  opening: number;
  received: number;
  used: number;
  pending: number;
  closing: number;
  current: number;
}

/** Opening/received/used/closing per item from batch purchases and approved usage — the same two inputs remaining_stock is maintained from. */
function itemPositions(set: StockSet, ctx: ReportContext, range: DateRange): Map<string, ItemPosition> {
  const batchById = new Map(set.batches.map((b) => [b.id, b]));
  const positions = new Map<string, ItemPosition>();
  const pos = (item: StockItem) => {
    let p = positions.get(item.key);
    if (!p) {
      p = { item, opening: 0, received: 0, used: 0, pending: 0, closing: 0, current: 0 };
      positions.set(item.key, p);
    }
    return p;
  };
  for (const b of set.batches) {
    if (!itemMatches(set, b.item, ctx)) continue;
    const p = pos(b.item);
    p.current += b.remaining;
    if (b.purchaseDate < range.from) p.opening += b.quantity;
    else if (b.purchaseDate <= range.to) p.received += b.quantity;
  }
  for (const u of set.usage) {
    const b = batchById.get(u.batchId);
    if (!b || !itemMatches(set, b.item, ctx)) continue;
    const p = pos(b.item);
    if (u.status === "approved") {
      if (u.date < range.from) p.opening -= u.quantity;
      else if (u.date <= range.to) p.used += u.quantity;
    } else if (u.status === "pending" && inRange(u.date, range)) {
      p.pending += u.quantity;
    }
  }
  for (const p of positions.values()) p.closing = p.opening + p.received - p.used;
  return positions;
}

function unitTotals(rows: { unit: string; value: number }[]): string {
  const byUnit = new Map<string, number>();
  for (const r of rows) byUnit.set(r.unit, (byUnit.get(r.unit) ?? 0) + r.value);
  if (byUnit.size === 0) return "0";
  return [...byUnit.entries()].map(([unit, value]) => fmtQty(value, unit)).join(" · ");
}

export type ConsumptionPeriod = "daily" | "weekly" | "monthly" | "usage";

function buildStockUsageReport(set: StockSet, data: ReportData, ctx: ReportContext, period: ConsumptionPeriod): ReportOutput {
  const isFeed = set.kind === "feed";
  const noun = isFeed ? "Feed" : "Vitamin";
  const positions = itemPositions(set, ctx, ctx.range);
  const batchById = new Map(set.batches.map((b) => [b.id, b]));
  const usageRows = set.usage.filter((u) => {
    const b = batchById.get(u.batchId);
    return (
      b &&
      itemMatches(set, b.item, ctx) &&
      inRange(u.date, ctx.range) &&
      matches(ctx.filters, "house", u.house) &&
      matches(ctx.filters, "staff", u.submittedBy)
    );
  });
  const approvedUsage = usageRows.filter((u) => u.status === "approved");
  const listed = usageRows.filter((u) => matches(ctx.filters, "status", u.status));
  const posList = [...positions.values()];
  const totalsOf = (field: keyof Omit<ItemPosition, "item">) => unitTotals(posList.map((p) => ({ unit: p.item.unit, value: p[field] })));
  const usedInScope = unitTotals(approvedUsage.map((u) => ({ unit: batchById.get(u.batchId)!.item.unit, value: u.quantity })));

  // Previous period (same filters) — only for a comparison when it had usage.
  let comparison: string | null = null;
  if (ctx.previous) {
    const prevUsed = sumBy(
      set.usage.filter((u) => {
        const b = batchById.get(u.batchId);
        return b && u.status === "approved" && itemMatches(set, b.item, ctx) && inRange(u.date, ctx.previous!) && matches(ctx.filters, "house", u.house) && matches(ctx.filters, "staff", u.submittedBy);
      }),
      (u) => u.quantity
    );
    const units = new Set(approvedUsage.map((u) => batchById.get(u.batchId)!.item.unit));
    if (units.size <= 1) comparison = pctChange(sumBy(approvedUsage, (u) => u.quantity), prevUsed);
  }

  const summary: SummaryCard[] = [
    { label: `Opening ${noun} Stock`, value: totalsOf("opening") },
    { label: isFeed ? "Feed Received" : "Purchased", value: totalsOf("received"), tone: "positive" },
    {
      label: "Approved Usage",
      value: usedInScope,
      hint: comparison ?? (ctx.filters.house || ctx.filters.staff ? "For the selected house/staff" : "Pending excluded"),
    },
    { label: "Pending Usage", value: unitTotals(usageRows.filter((u) => u.status === "pending").map((u) => ({ unit: batchById.get(u.batchId)!.item.unit, value: u.quantity }))), hint: "Not deducted until approved", tone: "warning" },
    { label: `Closing ${noun} Stock`, value: totalsOf("closing") },
  ];

  const notes = [
    `Closing = Opening + ${isFeed ? "Received" : "Purchased"} − Approved Usage. Pending usage hasn't been deducted; rejected usage never is. Each approved record is counted once, on its ${isFeed ? "distribution" : "administration"} date.`,
    isFeed
      ? "Feed is counted in whole sacks; sack size is shown per item and never added across sizes."
      : "Vitamins are counted per container (bottles, packs, boxes) — different units are never added together.",
  ];
  if (ctx.filters.house || ctx.filters.staff) notes.push("House/staff filters narrow usage figures; opening/closing stock is farm-level (stock isn't held per house).");
  if (ctx.range.to === ctx.today) {
    const mismatched = posList.filter((p) => p.closing !== p.current);
    notes.push(
      mismatched.length === 0
        ? `Reconciled: every item's closing stock matches current ${noun} Inventory remaining stock.`
        : `Reconciliation difference for: ${mismatched.map((p) => `${p.item.name} (inventory ${fmtNumber(p.current)} vs ${fmtNumber(p.closing)})`).join(", ")}.`
    );
  }
  if (set.orphanUsage > 0) notes.push(`${set.orphanUsage} usage record(s) belong to archived batches and are excluded, the same as archived stock is excluded from inventory.`);
  notes.push("Batch quantities reflect any later corrections made with Edit Stock (full before/after history is in the Audit Log).");

  const reconciliation: ReportTable = {
    id: "reconciliation",
    title: "Stock Reconciliation by Item",
    columns: [
      { key: "name", label: isFeed ? "Feed Item" : "Vitamin" },
      { key: "brand", label: "Brand" },
      { key: "category", label: "Category" },
      { key: "packaging", label: isFeed ? "Sack Size" : "Package Size" },
      { key: "unit", label: "Unit" },
      { key: "opening", label: "Opening", format: "number" },
      { key: "received", label: isFeed ? "Received" : "Purchased", format: "number" },
      { key: "used", label: "Approved Used", format: "number" },
      { key: "pending", label: "Pending", format: "number" },
      { key: "closing", label: "Closing", format: "number" },
      ...(ctx.range.to === ctx.today ? [{ key: "current", label: "Inventory Now", format: "number" as const }] : []),
    ],
    rows: posList.map((p) => ({
      name: p.item.name,
      brand: p.item.brand ?? "—",
      category: p.item.category ?? "—",
      packaging: p.item.packaging,
      unit: formatUnitLabel(p.item.unit, 2),
      opening: p.opening,
      received: p.received,
      used: p.used,
      pending: p.pending,
      closing: p.closing,
      current: p.current,
    })),
    sort: { key: "name", dir: "asc" },
    compact: true,
  };

  const detail: ReportTable = {
    id: "records",
    title: isFeed ? "Feed Distribution Records" : "Vitamin Administration Records",
    columns: withFarmColumn(ctx, [
      { key: "date", label: "Date", format: "date" },
      { key: "reference", label: "Reference" },
      { key: "item", label: isFeed ? "Feed" : "Vitamin" },
      ...(isFeed ? [{ key: "brand", label: "Brand" }] : []),
      { key: "category", label: "Category" },
      { key: "packaging", label: isFeed ? "Sack Size" : "Package Size" },
      { key: "house", label: "House / Pen" },
      { key: "quantity", label: "Quantity", format: "number" as const },
      { key: "unit", label: "Unit" },
      ...(isFeed
        ? []
        : [
            { key: "stockBefore", label: "Stock Before", format: "number" as const },
            { key: "stockAfter", label: "Stock After", format: "number" as const },
            { key: "dosage", label: "Dosage" },
            { key: "purpose", label: "Purpose" },
          ]),
      { key: "status", label: "Status", format: "status" as const },
      { key: "submittedBy", label: "Submitted By" },
      { key: "reviewedBy", label: "Reviewed By" },
      { key: "reviewedAt", label: "Reviewed At", format: "datetime" as const },
      { key: "remarks", label: "Remarks" },
    ]),
    rows: listed.map((u) => {
      const b = batchById.get(u.batchId)!;
      return {
        farm: u.farm,
        date: u.date,
        reference: ref(isFeed ? "FD" : "VA", u.id),
        item: b.item.name,
        brand: b.item.brand ?? "—",
        category: b.item.category ?? "—",
        packaging: b.item.packaging,
        house: u.house,
        quantity: u.quantity,
        unit: formatUnitLabel(b.item.unit, u.quantity),
        stockBefore: (u.extra.stockBefore as number | null) ?? null,
        stockAfter: (u.extra.stockAfter as number | null) ?? null,
        dosage: (u.extra.dosage as string | null) ?? "—",
        purpose: (u.extra.purpose as string | null) ?? "—",
        status: statusLabel(u.status),
        submittedBy: u.submittedBy ?? "—",
        reviewedBy: u.status === "pending" ? "—" : (u.reviewedBy ?? "—"),
        reviewedAt: u.reviewedAt,
        remarks: [u.remarks, u.reviewNotes ? `Review: ${u.reviewNotes}` : null].filter(Boolean).join(" · "),
      };
    }),
    sort: { key: "date", dir: "desc" },
  };

  const receipts: ReportTable = {
    id: "receipts",
    title: isFeed ? "Feed Received in Period" : "Vitamins Purchased in Period",
    columns: withFarmColumn(ctx, [
      { key: "date", label: "Purchase Date", format: "date" },
      { key: "reference", label: "Reference" },
      { key: "item", label: isFeed ? "Feed" : "Vitamin" },
      { key: "category", label: "Category" },
      { key: "packaging", label: isFeed ? "Sack Size" : "Package Size" },
      { key: "quantity", label: "Quantity", format: "number" },
      { key: "unit", label: "Unit" },
      { key: "recordedBy", label: "Recorded By" },
    ]),
    rows: set.batches
      .filter((b) => itemMatches(set, b.item, ctx) && inRange(b.purchaseDate, ctx.range))
      .map((b) => {
        const purchase = data.purchases.find((p) => p.items.some((i) => i.inventoryItemId === b.id));
        return {
          farm: b.farm,
          date: b.purchaseDate,
          reference: purchase?.referenceNumber ?? ref(isFeed ? "FB" : "VB", b.id),
          item: b.item.name,
          category: b.item.category ?? "—",
          packaging: b.item.packaging,
          quantity: b.quantity,
          unit: formatUnitLabel(b.item.unit, b.quantity),
          recordedBy: b.recordedBy ?? "—",
        };
      }),
    sort: { key: "date", dir: "desc" },
  };

  // Breakdowns of approved usage.
  const grouped = (key: (u: Usage) => string) => {
    const map = new Map<string, ReportRow>();
    for (const u of approvedUsage) {
      const b = batchById.get(u.batchId)!;
      const k = key(u);
      const row = map.get(k) ?? { records: 0, quantity: 0, unit: formatUnitLabel(b.item.unit, 2) };
      addInto(row, { records: 1, quantity: u.quantity });
      if (row.unit !== formatUnitLabel(b.item.unit, 2)) row.unit = "Mixed units — see items";
      map.set(k, row);
    }
    return map;
  };
  const usageCols = [
    { key: "records", label: "Records", format: "number" as const },
    { key: "quantity", label: "Approved Quantity", format: "number" as const },
    { key: "unit", label: "Unit" },
  ];
  const itemLabel = (u: Usage) => {
    const b = batchById.get(u.batchId)!;
    return isFeed ? `${b.item.name} (${b.item.packaging})` : `${b.item.name} (${formatUnitLabel(b.item.unit, 2)})`;
  };

  const dailyMap = new Map<string, ReportRow>();
  for (const day of period === "weekly" || period === "daily" ? eachDay(ctx.range, 31) : []) dailyMap.set(day, { records: 0, quantity: 0, unit: "" });
  for (const u of approvedUsage) {
    const b = batchById.get(u.batchId)!;
    const row = dailyMap.get(u.date) ?? { records: 0, quantity: 0, unit: "" };
    addInto(row, { records: 1, quantity: u.quantity });
    const label = formatUnitLabel(b.item.unit, 2);
    row.unit = !row.unit || row.unit === label ? label : "Mixed units";
    dailyMap.set(u.date, row);
  }

  const tables: ReportTable[] = [reconciliation, detail];
  tables.push(breakdownTable("byDay", "Approved Usage by Date", "Date", dailyMap, usageCols));
  tables.push(breakdownTable("byItem", `Usage by ${isFeed ? "Feed Item" : "Vitamin"}`, isFeed ? "Feed Item" : "Vitamin", grouped(itemLabel), usageCols, { sortKey: "quantity", sortDir: "desc" }));
  if (isFeed) tables.push(breakdownTable("byBrand", "Usage by Brand", "Brand", grouped((u) => batchById.get(u.batchId)!.item.brand ?? "Not recorded"), usageCols));
  tables.push(breakdownTable("byCategory", "Usage by Category", "Category", grouped((u) => batchById.get(u.batchId)!.item.category ?? "Not recorded"), usageCols));
  tables.push(breakdownTable("byHouse", "Usage by House / Pen", "House / Pen", grouped((u) => u.house), usageCols, { sortKey: "quantity", sortDir: "desc" }));
  tables.push(breakdownTable("byStaff", "Usage by Staff (submitted by)", "Staff", grouped((u) => u.submittedBy ?? "Unknown"), usageCols, { sortKey: "quantity", sortDir: "desc" }));
  if (period === "monthly") tables.push(breakdownTable("byWeek", "Usage by Week (starting Monday)", "Week Of", grouped((u) => weekStart(u.date)), usageCols));
  tables.push(receipts);
  return { summary, notes, tables };
}

export function buildFeedConsumptionReport(period: ConsumptionPeriod) {
  return (data: ReportData, ctx: ReportContext) => buildStockUsageReport(feedStockSet(data), data, ctx, period);
}

export function buildVitaminUsageReport(data: ReportData, ctx: ReportContext): ReportOutput {
  const out = buildStockUsageReport(vitaminStockSet(data), data, ctx, "usage");
  out.notes.push("Vitamin usage never creates an expense — the cost was recorded once, as the purchase expense.");
  return out;
}

// ═════════════════════════════════════════════════════════════════════════
// Stock movement ledger (all inventories)
// ═════════════════════════════════════════════════════════════════════════

export const MOVEMENT_TYPES = ["Layers", "Feed", "Vitamins", "Eggs"] as const;

export function movementFilterOptions(data: ReportData, ctx: { role: ReportContext["role"] }): FilterOptions {
  return {
    transactionType: canSeeFinance(ctx.role) ? [...MOVEMENT_TYPES] : MOVEMENT_TYPES.filter((t) => t !== "Eggs"),
    status: ["approved", "pending", "rejected"],
    house: distinct([
      ...layerMovements(data).flatMap((m) => [m.fromHouse, m.toHouse]),
      ...data.feedDistribution.map((r) => r.housePen),
      ...data.vitaminAdministration.map((r) => r.housePen),
    ]),
  };
}

export function buildStockMovementReport(data: ReportData, ctx: ReportContext): ReportOutput {
  const rows: ReportRow[] = [];
  const want = (t: string) => matches(ctx.filters, "transactionType", t);
  const house = ctx.filters.house || undefined;
  const statusOk = (s: string) => matches(ctx.filters, "status", s);
  const totals = new Map<string, { inQ: number; outQ: number; unit: string }>();
  const tally = (inventory: string, unit: string, q: number) => {
    const key = `${inventory}|${unit}`;
    const t = totals.get(key) ?? { inQ: 0, outQ: 0, unit };
    if (q > 0) t.inQ += q;
    else t.outQ -= q;
    totals.set(key, t);
  };

  if (want("Layers")) {
    let balance = 0;
    for (const m of layerMovements(data)) {
      if (m.date > ctx.range.to) break;
      const delta = layerScopeDelta(m, house);
      const official = m.status === "approved";
      const before = balance;
      if (official) balance += delta;
      if (!inRange(m.date, ctx.range) || !statusOk(m.status) || !touchesHouse(m, house)) continue;
      // A farm-wide transfer moves birds out of one pen and into another:
      // both sides are shown, the balance doesn't move.
      const farmTransfer = m.kind === "transfer" && !house;
      rows.push({
        farm: m.farm,
        date: m.date,
        reference: m.reference,
        inventory: "Layers",
        type: LAYER_EVENT_LABEL[m.kind],
        item: m.breed ? `Layers — ${m.breed}` : "Layers",
        from: m.fromHouse ?? "—",
        to: m.toHouse ?? "—",
        qtyIn: farmTransfer ? m.quantity : delta > 0 ? delta : null,
        qtyOut: farmTransfer ? m.quantity : delta < 0 ? -delta : null,
        unit: "birds",
        before: official ? before : null,
        after: official ? balance : null,
        status: statusLabel(m.status),
        createdBy: m.submittedBy ?? "—",
        approvedBy: m.status === "pending" ? "—" : (m.approvedBy ?? "—"),
        remarks: farmTransfer ? "Transfer between pens — farm total unchanged" : (m.notes ?? ""),
      });
      if (official && !farmTransfer) tally("Layers", "birds", delta);
    }
  }

  const stockLedger = (set: StockSet, inventory: string, prefix: string) => {
    const batchById = new Map(set.batches.map((b) => [b.id, b]));
    type Mv = { date: string; created: string; batch: Batch; q: number; status: Status; usage?: Usage };
    const mvs: Mv[] = [
      ...set.batches.map((b) => ({ date: b.purchaseDate, created: "", batch: b, q: b.quantity, status: "approved" as Status })),
      ...set.usage.map((u) => ({ date: u.date, created: u.id, batch: batchById.get(u.batchId)!, q: -u.quantity, status: u.status, usage: u })),
    ].sort((a, b) => a.date.localeCompare(b.date) || (a.q > 0 ? -1 : 1));
    const balance = new Map<string, number>();
    for (const mv of mvs) {
      if (mv.date > ctx.range.to) continue;
      const key = mv.batch.item.key;
      const before = balance.get(key) ?? 0;
      const official = mv.status === "approved";
      if (official) balance.set(key, before + mv.q);
      if (!inRange(mv.date, ctx.range) || !statusOk(mv.status)) continue;
      if (house && (!mv.usage || mv.usage.house !== house)) continue;
      const purchase = mv.usage ? null : data.purchases.find((p) => p.items.some((i) => i.inventoryItemId === mv.batch.id));
      rows.push({
        farm: mv.batch.farm,
        date: mv.date,
        reference: mv.usage ? ref(prefix, mv.usage.id) : (purchase?.referenceNumber ?? ref(`${prefix[0]}B`, mv.batch.id)),
        inventory,
        type: mv.usage ? (inventory === "Feed" ? "Distribution" : "Administration") : "Purchase / Stock Received",
        item: `${mv.batch.item.name} (${mv.batch.item.packaging})`,
        from: mv.usage ? "Store" : "Supplier",
        to: mv.usage ? mv.usage.house : "Store",
        qtyIn: mv.q > 0 ? mv.q : null,
        qtyOut: mv.q < 0 ? -mv.q : null,
        unit: formatUnitLabel(mv.batch.item.unit, Math.abs(mv.q)),
        before: official ? before : null,
        after: official ? before + mv.q : null,
        status: statusLabel(mv.status),
        createdBy: mv.usage ? (mv.usage.submittedBy ?? "—") : (mv.batch.recordedBy ?? "—"),
        approvedBy: mv.usage ? (mv.status === "pending" ? "—" : (mv.usage.reviewedBy ?? "—")) : "—",
        remarks: mv.usage?.remarks ?? "",
      });
      if (official) tally(inventory, mv.batch.item.unit, mv.q);
    }
  };
  if (want("Feed")) stockLedger(feedStockSet(data), "Feed", "FD");
  if (want("Vitamins")) stockLedger(vitaminStockSet(data), "Vitamins", "VA");

  if (want("Eggs") && canSeeFinance(ctx.role) && !house) {
    let balance = 0;
    for (const m of eggMoves(data)) {
      if (m.date > ctx.range.to) break;
      const before = balance;
      balance += m.total;
      if (!inRange(m.date, ctx.range) || !statusOk("approved")) continue;
      rows.push({
        farm: m.farm,
        date: m.date,
        reference: m.reference,
        inventory: "Eggs",
        type: m.type,
        item: "Sellable eggs",
        from: m.total > 0 ? m.detail : "Store",
        to: m.total > 0 ? "Store" : m.detail,
        qtyIn: m.total > 0 ? m.total : null,
        qtyOut: m.total < 0 ? -m.total : null,
        unit: "eggs",
        before,
        after: balance,
        status: "Approved",
        createdBy: "—",
        approvedBy: "—",
        remarks: "",
      });
      tally("Eggs", "eggs", m.total);
    }
  }

  const summary: SummaryCard[] = [...totals.entries()].map(([key, t]) => ({
    label: `${key.split("|")[0]} — official movement`,
    value: `+${fmtQty(t.inQ, t.unit)} / −${fmtNumber(t.outQ)}`,
    hint: `Net ${fmtSigned(t.inQ - t.outQ)} ${formatUnitLabel(t.unit, 2)}`,
  }));
  if (summary.length === 0) summary.push({ label: "Official Movements", value: "0", hint: "No approved movements in this period" });

  return {
    summary,
    notes: [
      "Stock Before/After is the running official balance for that inventory item (layers: farm-wide, or the selected house). Pending and rejected rows are listed but have no balance effect.",
      "Each inventory keeps its own unit — birds, sacks, bottles/packs/boxes and eggs are never added together.",
      "Pen-to-pen transfers are shown with the moved quantity but don't change the farm-wide layer total.",
      ...(canSeeFinance(ctx.role) ? [] : ["Egg stock movements include sales, so they're available to Farm Admin and Manager only."]),
      ...(house ? ["House filter: egg movements and stock purchases aren't tied to a house and are hidden."] : []),
    ],
    tables: [
      {
        id: "ledger",
        title: "Inventory Transaction Ledger",
        columns: withFarmColumn(ctx, [
          { key: "date", label: "Date", format: "date" },
          { key: "reference", label: "Reference" },
          { key: "inventory", label: "Inventory" },
          { key: "type", label: "Movement" },
          { key: "item", label: "Item" },
          { key: "from", label: "Source" },
          { key: "to", label: "Destination" },
          { key: "qtyIn", label: "Qty In", format: "number" },
          { key: "qtyOut", label: "Qty Out", format: "number" },
          { key: "unit", label: "Unit" },
          { key: "before", label: "Stock Before", format: "number" },
          { key: "after", label: "Stock After", format: "number" },
          { key: "status", label: "Status", format: "status" },
          { key: "createdBy", label: "Created By" },
          { key: "approvedBy", label: "Reviewed By" },
          { key: "remarks", label: "Remarks" },
        ]),
        rows,
        sort: { key: "date", dir: "asc" },
      },
    ],
  };
}

// ═════════════════════════════════════════════════════════════════════════
// Monthly inventory summary
// ═════════════════════════════════════════════════════════════════════════

export function buildMonthlyInventoryReport(data: ReportData, ctx: ReportContext): ReportOutput {
  const layerCtx = { ...ctx, filters: {} };
  const movements = layerMovements(data);
  const ledger = runLayerLedger(movements, layerCtx);
  const off = ledger.inRangeOfficial;
  const kindSum = (k: LayerMovement["kind"]) => sumBy(off.filter((m) => m.kind === k), (m) => m.farmDelta);
  const layerRows = new Map<string, ReportRow>([
    ["Opening active layers", { quantity: ledger.opening }],
    ["New arrivals", { quantity: kindSum("arrival") }],
    ["Transfers between pens (net)", { quantity: 0 }],
    ["Sales", { quantity: kindSum("sale") }],
    ["Culling", { quantity: kindSum("culling") }],
    ["Mortality", { quantity: kindSum("mortality_record") }],
    ["Count corrections", { quantity: kindSum("count_update") }],
    ["Closing active layers", { quantity: ledger.closing }],
  ]);

  const stockTable = (set: StockSet, id: string, title: string, reportId: string): ReportTable => {
    const positions = [...itemPositions(set, layerCtx, ctx.range).values()];
    return {
      id,
      title,
      columns: [
        { key: "name", label: "Item" },
        { key: "unit", label: "Unit" },
        { key: "opening", label: "Opening", format: "number" },
        { key: "received", label: "Purchases / Receipts", format: "number" },
        { key: "used", label: "Approved Usage", format: "number" },
        { key: "closing", label: "Closing", format: "number" },
      ],
      rows: positions.map((p) => ({
        name: `${p.item.name} (${p.item.packaging})`,
        unit: formatUnitLabel(p.item.unit, 2),
        opening: p.opening,
        received: p.received,
        used: p.used,
        closing: p.closing,
      })),
      sort: { key: "name", dir: "asc" },
      compact: true,
      drillDown: [{ reportId, label: "View transactions" }],
    };
  };

  const tables: ReportTable[] = [
    {
      ...breakdownTable("layers", "Layer Inventory", "Line", layerRows, [{ key: "quantity", label: "Birds", format: "signed" }]),
      sort: undefined,
      drillDown: [{ reportId: "poultry-stock", label: "View transactions" }],
    },
    stockTable(feedStockSet(data), "feed", "Feed Inventory", "feed-monthly"),
    stockTable(vitaminStockSet(data), "vitamins", "Vitamin Inventory", "vitamin-usage"),
  ];
  if (canSeeFinance(ctx.role)) {
    const eggs = eggPosition(data, ctx.range, undefined);
    tables.push({
      id: "eggs",
      title: "Egg Inventory",
      columns: [
        { key: "name", label: "Line" },
        { key: "eggs", label: "Eggs", format: "signed" },
      ],
      rows: [
        { name: "Opening sellable eggs", eggs: eggs.opening },
        { name: "Approved good eggs added", eggs: eggs.added },
        { name: "Eggs sold", eggs: -eggs.sold },
        { name: "Closing remaining eggs", eggs: eggs.closing },
      ],
      compact: true,
      drillDown: [{ reportId: "egg-inventory", label: "View transactions" }],
    });
  }
  return {
    summary: [
      { label: "Closing Active Layers", value: `${fmtNumber(ledger.closing)} birds` },
      { label: "Layer Net Change", value: `${fmtSigned(ledger.closing - ledger.opening)} birds` },
    ],
    notes: [
      "Each inventory is summarised in its own unit — birds, sacks, containers and eggs are never combined. Only approved transactions count.",
      "Use “View transactions” under each section to open the detailed report for the same period.",
    ],
    tables,
  };
}

// ═════════════════════════════════════════════════════════════════════════
// Overview
// ═════════════════════════════════════════════════════════════════════════

export function buildOverviewReport(data: ReportData, ctx: ReportContext): ReportOutput {
  const movements = layerMovements(data);
  const ledger = runLayerLedger(movements, { ...ctx, filters: {} });
  const eggsApproved = data.eggs.filter((r) => r.status === "approved" && inRange(r.productionDate, ctx.range));
  const mortality = sumBy(data.mortality.filter((m) => m.status === "approved" && inRange(m.recordDate, ctx.range)), (m) => m.deadBirds);
  const pendingCount =
    data.eggs.filter((r) => r.status === "pending").length +
    data.feedDistribution.filter((r) => r.status === "pending").length +
    data.vitaminAdministration.filter((r) => r.status === "pending").length +
    data.mortality.filter((r) => r.status === "pending").length +
    data.events.filter((e) => e.reviewStatus === "pending").length;
  const feedNow = data.feeds.length === 0 ? "0" : [...new Set(data.feeds.map((f) => feedUnitFor(data, f.farmId)))]
    .map((mode) => formatFeedStockTotal(data.feeds.filter((f) => feedUnitFor(data, f.farmId) === mode), mode))
    .join(" · ");
  const vitaminNow = unitTotals(data.vitamins.map((v) => ({ unit: v.unit, value: Number(v.remainingStock) })));

  const summary: SummaryCard[] = [
    { label: "Active Layers (period end)", value: `${fmtNumber(ledger.closing)} birds`, hint: `${fmtSigned(ledger.closing - ledger.opening)} in period` },
    { label: "Eggs Collected", value: `${fmtNumber(sumBy(eggsApproved, (r) => r.eggsCollected))} eggs`, hint: "Approved records" },
    { label: "Mortality", value: `${fmtNumber(mortality)} birds`, hint: "Approved records" },
    { label: "Feed in Stock (now)", value: feedNow },
    { label: "Vitamins in Stock (now)", value: vitaminNow },
    { label: "Awaiting Approval (now)", value: `${pendingCount}`, tone: pendingCount ? "warning" : "default" },
  ];
  if (canSeeFinance(ctx.role)) {
    const revenue = sumBy(data.sales.filter((s) => inRange(s.saleDate, ctx.range)), (s) => Number(s.totalAmount));
    const expense = sumBy(data.expenses.filter((e) => inRange(e.expenseDate, ctx.range)), (e) => Number(e.amount));
    summary.push(
      { label: "Remaining Eggs (now)", value: `${fmtNumber(computeRemainingEggStock(data.eggs, data.sales))} eggs` },
      { label: "Revenue", value: `₱${revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
      { label: "Expenses", value: `₱${expense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
      { label: "Net Profit / Loss", value: `₱${(revenue - expense).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, tone: revenue - expense >= 0 ? "positive" : "negative" }
    );
  }

  type Recent = ReportRow & { sortKey: string };
  const recent: Recent[] = [];
  const push = (r: Omit<Recent, "sortKey">, createdAt: string) => recent.push({ ...r, sortKey: createdAt });
  for (const m of movements) {
    if (!inRange(m.date, ctx.range)) continue;
    push({ farm: m.farm, date: m.date, module: "Layer Inventory", reference: m.reference, detail: `${LAYER_EVENT_LABEL[m.kind]} — ${fmtNumber(m.quantity)} birds (${moveHouseLabel(m)})`, status: statusLabel(m.status), by: m.submittedBy ?? "—" }, m.createdAt);
  }
  for (const r of data.eggs) {
    if (!inRange(r.productionDate, ctx.range)) continue;
    push({ farm: r.farmName, date: r.productionDate, module: "Egg Production", reference: ref("EP", r.id), detail: `${fmtNumber(r.eggsCollected)} eggs — ${r.housePen}`, status: statusLabel(r.status), by: r.recordedByName ?? "—" }, r.createdAt);
  }
  for (const r of data.feedDistribution) {
    if (!inRange(r.distributionDate, ctx.range)) continue;
    push({ farm: r.farmName, date: r.distributionDate, module: "Feed", reference: ref("FD", r.id), detail: `${formatFeedUsage(r, feedUnitFor(data, r.farmId))} ${r.feedName} — ${r.housePen}`, status: statusLabel(r.status), by: r.recordedByName ?? "—" }, r.createdAt);
  }
  for (const r of data.vitaminAdministration) {
    if (!inRange(r.administrationDate, ctx.range)) continue;
    push({ farm: r.farmName, date: r.administrationDate, module: "Vitamins", reference: ref("VA", r.id), detail: `${fmtQty(Number(r.quantityUsed), r.unit)} ${r.vitaminName} — ${r.housePen}`, status: statusLabel(r.status), by: r.recordedByName ?? "—" }, r.createdAt);
  }
  if (canSeeFinance(ctx.role)) {
    for (const s of data.sales) {
      if (!inRange(s.saleDate, ctx.range)) continue;
      push({ farm: s.farmName, date: s.saleDate, module: "Sales", reference: ref("SL", s.id), detail: `₱${Number(s.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })} — ${fmtNumber(totalEggsForSale(s))} eggs`, status: statusLabel(s.paymentStatus), by: s.recordedByName ?? "—" }, s.createdAt);
    }
    for (const e of data.expenses) {
      if (!inRange(e.expenseDate, ctx.range)) continue;
      push({ farm: e.farmName, date: e.expenseDate, module: "Expenses", reference: ref("EX", e.id), detail: `₱${Number(e.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} — ${e.category}: ${e.description}`, status: "Recorded", by: e.recordedByName ?? "—" }, e.createdAt);
    }
  }
  recent.sort((a, b) => b.sortKey.localeCompare(a.sortKey));

  return {
    summary,
    notes: ["Period figures use approved records only. “Now” figures are the live inventory values the dashboard shows."],
    tables: [
      {
        id: "recent",
        title: "Transactions in Period",
        columns: withFarmColumn(ctx, [
          { key: "date", label: "Date", format: "date" },
          { key: "module", label: "Module" },
          { key: "reference", label: "Reference" },
          { key: "detail", label: "Detail" },
          { key: "status", label: "Status", format: "status" },
          { key: "by", label: "Recorded By" },
        ]),
        rows: recent.map(({ sortKey: _s, ...rest }) => rest),
        sort: { key: "date", dir: "desc" },
      },
    ],
  };
}

export function overviewFilterOptions(): FilterOptions {
  return {};
}

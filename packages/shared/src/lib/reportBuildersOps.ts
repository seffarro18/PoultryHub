import { totalEggsForSale } from "../services/salesExpensesService";
import type { ReportData } from "../services/reportDataService";
import { EGG_SIZES, EGG_UNIT_LABEL } from "../types/eggPricing";
import { EXPENSE_CATEGORIES, type ExpenseRecord, type SaleRecord } from "../types/salesExpenses";
import { TASK_STATUS_LABEL } from "../types/task";
import { formatFeedUsage } from "../types/feedVitamin";
import type { FilterOptions, ReportContext, ReportOutput, ReportRow, ReportTable, SummaryCard } from "../types/report";
import { daysBetween, eachDay, inRange, isIncomplete, weekStart, type DateRange } from "./reportPeriods";
import { addInto, breakdownTable, distinct, fmtNumber, fmtPeso, matches, pctChange, ref, statusLabel, sumBy, withFarmColumn } from "./reportUtils";

const UNIT_TYPE_LABEL = EGG_UNIT_LABEL;
const SOURCE_LABEL: Record<ExpenseRecord["source"], string> = { manual: "Manual Expense", inventory_purchase: "Inventory Purchase" };

// ═════════════════════════════════════════════════════════════════════════
// Shared finance selection — every financial report filters through these
// two functions, so Sales, Expenses and the Financial Summary always agree.
// ═════════════════════════════════════════════════════════════════════════

/**
 * Valid sales = every row in `sales` (a deleted sale no longer exists; there
 * is no cancelled/void state in this schema). Each sale is counted once at its
 * stored total — the price charged at the time, never re-priced.
 */
function selectSales(data: ReportData, ctx: ReportContext, range: DateRange): SaleRecord[] {
  return data.sales.filter(
    (s) =>
      inRange(s.saleDate, range) &&
      matches(ctx.filters, "paymentMethod", s.paymentMethod ?? "Cash") &&
      matches(ctx.filters, "staff", s.recordedByName) &&
      (!ctx.filters.eggSize || s.items.some((i) => i.eggSize === ctx.filters.eggSize))
  );
}

/** Revenue of a sale within the current egg-size filter (line totals of that size), else its stored total. */
function saleRevenue(s: SaleRecord, ctx: ReportContext): number {
  if (!ctx.filters.eggSize) return Number(s.totalAmount);
  return sumBy(s.items.filter((i) => i.eggSize === ctx.filters.eggSize), (i) => Number(i.lineTotal));
}

function saleEggs(s: SaleRecord, ctx: ReportContext): number {
  if (!ctx.filters.eggSize) return totalEggsForSale(s);
  return sumBy(s.items.filter((i) => i.eggSize === ctx.filters.eggSize), (i) => i.eggsCount);
}

/**
 * Valid expenses = every `expenses` row. Inventory purchases create exactly
 * one expense each (record_feed_purchase/record_vitamin_purchase), so they're
 * counted from here only — purchase_transactions are used for references,
 * never added on top. Feed/vitamin usage creates no expense.
 */
function selectExpenses(data: ReportData, ctx: ReportContext, range: DateRange): ExpenseRecord[] {
  return data.expenses.filter(
    (e) =>
      inRange(e.expenseDate, range) &&
      matches(ctx.filters, "expenseCategory", e.category) &&
      matches(ctx.filters, "paymentMethod", e.paymentMethod) &&
      matches(ctx.filters, "staff", e.recordedByName) &&
      matches(ctx.filters, "expenseSource", SOURCE_LABEL[e.source])
  );
}

export function salesFilterOptions(data: ReportData): FilterOptions {
  return {
    eggSize: [...EGG_SIZES],
    paymentMethod: distinct(data.sales.map((s) => s.paymentMethod ?? "Cash")),
    staff: distinct(data.sales.map((s) => s.recordedByName)),
  };
}

export function expenseFilterOptions(data: ReportData): FilterOptions {
  return {
    expenseCategory: [...EXPENSE_CATEGORIES],
    expenseSource: Object.values(SOURCE_LABEL),
    paymentMethod: distinct(data.expenses.map((e) => e.paymentMethod)),
    staff: distinct(data.expenses.map((e) => e.recordedByName)),
  };
}

export function financeFilterOptions(data: ReportData): FilterOptions {
  return {
    paymentMethod: distinct([...data.sales.map((s) => s.paymentMethod ?? "Cash"), ...data.expenses.map((e) => e.paymentMethod)]),
    expenseCategory: [...EXPENSE_CATEGORIES],
  };
}

function purchaseRef(data: ReportData, e: ExpenseRecord): { reference: string; linked: string } {
  if (e.source !== "inventory_purchase" || !e.purchaseId) return { reference: ref("EX", e.id), linked: "—" };
  const p = data.purchases.find((x) => x.id === e.purchaseId);
  if (!p) return { reference: ref("EX", e.id), linked: "Purchase record not visible" };
  const item = p.items[0];
  return {
    reference: p.referenceNumber,
    linked: item ? `${fmtNumber(item.quantity)} × ${item.itemName}${item.packageSize ? ` (${item.packageSize})` : ""} @ ${fmtPeso(Number(item.unitPrice))}` : p.referenceNumber,
  };
}

// ═════════════════════════════════════════════════════════════════════════
// Sales
// ═════════════════════════════════════════════════════════════════════════

export function buildSalesReport(data: ReportData, ctx: ReportContext): ReportOutput {
  const sales = selectSales(data, ctx, ctx.range);
  const revenue = sumBy(sales, (s) => saleRevenue(s, ctx));
  const eggs = sumBy(sales, (s) => saleEggs(s, ctx));
  const prevRevenue = ctx.previous ? sumBy(selectSales(data, ctx, ctx.previous), (s) => saleRevenue(s, ctx)) : 0;

  const lines: ReportRow[] = [];
  for (const s of sales) {
    const common = {
      farm: s.farmName,
      date: s.saleDate,
      recordedAt: s.createdAt,
      reference: ref("SL", s.id),
      customer: s.buyerName ?? "—",
      saleTotal: Number(s.totalAmount),
      paymentMethod: s.paymentMethod ?? "Cash",
      paymentStatus: statusLabel(s.paymentStatus),
      recordedBy: s.recordedByName ?? "—",
    };
    if (s.items.length === 0) {
      lines.push({ ...common, size: s.eggSize ?? "—", unitType: s.unit ?? "—", quantity: s.quantity, eggs: totalEggsForSale(s), unitPrice: s.unitPrice, lineTotal: Number(s.totalAmount) });
      continue;
    }
    for (const i of s.items) {
      if (ctx.filters.eggSize && i.eggSize !== ctx.filters.eggSize) continue;
      lines.push({ ...common, size: i.eggSize, unitType: UNIT_TYPE_LABEL[i.unitType], quantity: i.quantity, eggs: i.eggsCount, unitPrice: Number(i.unitPrice), lineTotal: Number(i.lineTotal) });
    }
  }

  const bySize = new Map<string, ReportRow>();
  for (const s of sales) {
    for (const i of s.items) {
      if (ctx.filters.eggSize && i.eggSize !== ctx.filters.eggSize) continue;
      const row = bySize.get(i.eggSize) ?? { eggs: 0, revenue: 0 };
      addInto(row, { eggs: i.eggsCount, revenue: Number(i.lineTotal) });
      bySize.set(i.eggSize, row);
    }
    if (s.items.length === 0 && !ctx.filters.eggSize) {
      const row = bySize.get("Legacy (no size)") ?? { eggs: 0, revenue: 0 };
      addInto(row, { eggs: totalEggsForSale(s), revenue: Number(s.totalAmount) });
      bySize.set("Legacy (no size)", row);
    }
  }
  const group = (key: (s: SaleRecord) => string) => {
    const map = new Map<string, ReportRow>();
    for (const s of sales) {
      const row = map.get(key(s)) ?? { sales: 0, eggs: 0, revenue: 0 };
      addInto(row, { sales: 1, eggs: saleEggs(s, ctx), revenue: saleRevenue(s, ctx) });
      map.set(key(s), row);
    }
    return map;
  };
  const saleCols = [
    { key: "sales", label: "Sales", format: "number" as const },
    { key: "eggs", label: "Eggs", format: "number" as const },
    { key: "revenue", label: "Revenue", format: "currency" as const },
  ];

  return {
    summary: [
      { label: "Valid Sales", value: `${sales.length}` },
      { label: "Eggs Sold", value: `${fmtNumber(eggs)} eggs`, hint: `${fmtNumber(eggs / 30, 1)} trays equivalent` },
      { label: "Revenue", value: fmtPeso(revenue), hint: (ctx.previous && pctChange(revenue, prevRevenue)) || undefined, tone: "positive" },
      ...(sales.length > 0 ? [{ label: "Average Sale", value: fmtPeso(revenue / sales.length) }] : []),
    ],
    notes: [
      "Each sale keeps the egg price charged at the time of sale; old sales are never re-priced with today's Egg Pricing.",
      "Every recorded sale is valid — this schema has no cancelled/void sale state (a deleted sale is removed entirely). Payment status (Paid/Pending/Partial) is shown for reference and doesn't change revenue, matching the Sales & Expenses module.",
      "Customer details appear only where a buyer name was recorded.",
    ],
    tables: [
      {
        id: "lines",
        title: "Sale Lines",
        description: "One row per egg size and tray unit sold.",
        columns: withFarmColumn(ctx, [
          { key: "date", label: "Sale Date", format: "date" },
          { key: "recordedAt", label: "Recorded At", format: "datetime" },
          { key: "reference", label: "Reference" },
          { key: "customer", label: "Customer" },
          { key: "size", label: "Egg Size" },
          { key: "unitType", label: "Unit" },
          { key: "quantity", label: "Qty", format: "number" },
          { key: "eggs", label: "Eggs", format: "number" },
          { key: "unitPrice", label: "Unit Price (at sale)", format: "currency" },
          { key: "lineTotal", label: "Line Total", format: "currency" },
          { key: "saleTotal", label: "Sale Total", format: "currency" },
          { key: "paymentMethod", label: "Payment Method" },
          { key: "paymentStatus", label: "Payment Status", format: "status" },
          { key: "recordedBy", label: "Recorded By" },
        ]),
        rows: lines,
        totals: { eggs, lineTotal: sumBy(lines, (l) => Number(l.lineTotal ?? 0)) },
        sort: { key: "date", dir: "desc" },
      },
      breakdownTable("bySize", "Sales by Egg Size", "Egg Size", bySize, [
        { key: "eggs", label: "Eggs", format: "number" },
        { key: "revenue", label: "Revenue", format: "currency" },
      ]),
      breakdownTable("byDay", "Sales by Day", "Date", group((s) => s.saleDate), saleCols),
      breakdownTable("byWeek", "Sales by Week (starting Monday)", "Week Of", group((s) => weekStart(s.saleDate)), saleCols),
      breakdownTable("byMonth", "Sales by Month", "Month", group((s) => s.saleDate.slice(0, 7)), saleCols),
      breakdownTable("byMethod", "Sales by Payment Method", "Payment Method", group((s) => s.paymentMethod ?? "Cash"), saleCols),
      breakdownTable("byStatus", "Sales by Payment Status", "Payment Status", group((s) => statusLabel(s.paymentStatus)), saleCols),
    ],
  };
}

// ═════════════════════════════════════════════════════════════════════════
// Expenses
// ═════════════════════════════════════════════════════════════════════════

function expenseRows(data: ReportData, expenses: ExpenseRecord[]): ReportRow[] {
  return expenses.map((e) => {
    const { reference, linked } = purchaseRef(data, e);
    return {
      farm: e.farmName,
      date: e.expenseDate,
      reference,
      category: e.category,
      description: e.description,
      amount: Number(e.amount),
      paymentMethod: e.paymentMethod ?? "—",
      source: SOURCE_LABEL[e.source],
      linked,
      vendor: e.vendor ?? "—",
      recordedBy: e.recordedByName ?? "—",
      remarks: e.remarks ?? "",
    };
  });
}

export function buildExpenseReport(data: ReportData, ctx: ReportContext): ReportOutput {
  const expenses = selectExpenses(data, ctx, ctx.range);
  const total = sumBy(expenses, (e) => Number(e.amount));
  const purchases = expenses.filter((e) => e.source === "inventory_purchase");
  const feed = sumBy(purchases.filter((e) => e.category === "Feed"), (e) => Number(e.amount));
  const vitamins = sumBy(purchases.filter((e) => e.category === "Medicine & Vitamins"), (e) => Number(e.amount));
  const otherInventory = sumBy(purchases, (e) => Number(e.amount)) - feed - vitamins;
  const manual = sumBy(expenses.filter((e) => e.source === "manual"), (e) => Number(e.amount));
  const prevTotal = ctx.previous ? sumBy(selectExpenses(data, ctx, ctx.previous), (e) => Number(e.amount)) : 0;

  // Duplicate check: an inventory purchase must have at most one expense.
  const perPurchase = new Map<string, number>();
  for (const e of data.expenses) if (e.purchaseId) perPurchase.set(e.purchaseId, (perPurchase.get(e.purchaseId) ?? 0) + 1);
  const duplicates = [...perPurchase.values()].filter((n) => n > 1).length;

  const group = (key: (e: ExpenseRecord) => string) => {
    const map = new Map<string, ReportRow>();
    for (const e of expenses) {
      const row = map.get(key(e)) ?? { count: 0, amount: 0 };
      addInto(row, { count: 1, amount: Number(e.amount) });
      map.set(key(e), row);
    }
    return map;
  };
  const cols = [
    { key: "count", label: "Transactions", format: "number" as const },
    { key: "amount", label: "Amount", format: "currency" as const },
  ];

  return {
    summary: [
      { label: "Total Expenses", value: fmtPeso(total), hint: (ctx.previous && pctChange(total, prevTotal)) || `${expenses.length} transaction(s)`, tone: "negative" },
      { label: "Feed Purchases", value: fmtPeso(feed) },
      { label: "Vitamin Purchases", value: fmtPeso(vitamins) },
      ...(otherInventory ? [{ label: "Other Inventory Purchases", value: fmtPeso(otherInventory) }] : []),
      { label: "Manual Expenses", value: fmtPeso(manual) },
    ],
    notes: [
      "Inventory purchases are counted once — from the expense each purchase automatically created; the purchase receipt supplies the reference only. Using feed or vitamins never creates another expense.",
      duplicates === 0 ? "Checked: no inventory purchase has more than one expense." : `Warning: ${duplicates} purchase(s) are linked to more than one expense.`,
      "Expenses have no cancelled/void state in this schema — every recorded expense is counted.",
    ],
    tables: [
      {
        id: "expenses",
        title: "Expense Transactions",
        columns: withFarmColumn(ctx, [
          { key: "date", label: "Expense Date", format: "date" },
          { key: "reference", label: "Reference" },
          { key: "category", label: "Category" },
          { key: "description", label: "Description" },
          { key: "amount", label: "Amount", format: "currency" },
          { key: "paymentMethod", label: "Payment Method" },
          { key: "source", label: "Source" },
          { key: "linked", label: "Linked Purchase" },
          { key: "vendor", label: "Vendor" },
          { key: "recordedBy", label: "Recorded By" },
          { key: "remarks", label: "Remarks" },
        ]),
        rows: expenseRows(data, expenses),
        totals: { amount: total },
        sort: { key: "date", dir: "desc" },
      },
      breakdownTable("byCategory", "Expenses by Category", "Category", group((e) => e.category), cols, { sortKey: "amount", sortDir: "desc" }),
      breakdownTable("bySource", "Expenses by Source", "Source", group((e) => SOURCE_LABEL[e.source]), cols),
      breakdownTable("byDay", "Expenses by Date", "Date", group((e) => e.expenseDate), cols),
      breakdownTable("byMethod", "Expenses by Payment Method", "Payment Method", group((e) => e.paymentMethod ?? "Not recorded"), cols),
    ],
  };
}

// ═════════════════════════════════════════════════════════════════════════
// Financial summary / daily / weekly / monthly
// ═════════════════════════════════════════════════════════════════════════

export type FinancePeriod = "summary" | "daily" | "weekly" | "monthly";

export function buildFinancialReport(period: FinancePeriod) {
  return (data: ReportData, ctx: ReportContext): ReportOutput => {
    // Egg size is a sales-only filter; expense category an expenses-only one —
    // each narrows only its own side, so both sides stay comparable.
    const salesCtx = { ...ctx, filters: { ...ctx.filters, expenseCategory: undefined } };
    const expenseCtx = { ...ctx, filters: { ...ctx.filters, eggSize: undefined } };
    const sales = selectSales(data, salesCtx, ctx.range);
    const expenses = selectExpenses(data, expenseCtx, ctx.range);
    const revenue = sumBy(sales, (s) => saleRevenue(s, salesCtx));
    const expenseTotal = sumBy(expenses, (e) => Number(e.amount));
    const net = revenue - expenseTotal;

    let prevNote: string | undefined;
    let prevRevenue = 0;
    let prevExpenses = 0;
    if (ctx.previous) {
      prevRevenue = sumBy(selectSales(data, salesCtx, ctx.previous), (s) => saleRevenue(s, salesCtx));
      prevExpenses = sumBy(selectExpenses(data, expenseCtx, ctx.previous), (e) => Number(e.amount));
      prevNote = pctChange(revenue, prevRevenue) ?? undefined;
    }

    const summary: SummaryCard[] = [
      { label: "Sales Revenue", value: fmtPeso(revenue), hint: prevNote ?? `${sales.length} sale(s)`, tone: "positive" },
      { label: "Expenses", value: fmtPeso(expenseTotal), hint: (ctx.previous && pctChange(expenseTotal, prevExpenses)) || `${expenses.length} expense(s)`, tone: "negative" },
      { label: net >= 0 ? "Net Profit" : "Net Loss", value: fmtPeso(net), hint: "Revenue − Expenses", tone: net >= 0 ? "positive" : "negative" },
      { label: "Transactions", value: `${sales.length} sales · ${expenses.length} expenses` },
    ];
    if (ctx.previous) summary.push({ label: "Previous Period Net", value: fmtPeso(prevRevenue - prevExpenses), hint: `${ctx.previous.from} to ${ctx.previous.to}` });

    // Day-by-day (every day for short periods; days with activity for long ones).
    const days = daysBetween(ctx.range.from, ctx.range.to) <= 62 ? eachDay(ctx.range) : [];
    const daily = new Map<string, ReportRow>(days.map((d) => [d, { revenue: 0, expenses: 0, net: 0 }]));
    for (const s of sales) {
      const row = daily.get(s.saleDate) ?? { revenue: 0, expenses: 0, net: 0 };
      addInto(row, { revenue: saleRevenue(s, salesCtx), net: saleRevenue(s, salesCtx) });
      daily.set(s.saleDate, row);
    }
    for (const e of expenses) {
      const row = daily.get(e.expenseDate) ?? { revenue: 0, expenses: 0, net: 0 };
      addInto(row, { expenses: Number(e.amount), net: -Number(e.amount) });
      daily.set(e.expenseDate, row);
    }
    const moneyCols = [
      { key: "revenue", label: "Revenue", format: "currency" as const },
      { key: "expenses", label: "Expenses", format: "currency" as const },
      { key: "net", label: "Net Profit / Loss", format: "currency" as const },
    ];

    const byCategory = new Map<string, ReportRow>();
    for (const e of expenses) {
      const row = byCategory.get(e.category) ?? { count: 0, amount: 0 };
      addInto(row, { count: 1, amount: Number(e.amount) });
      byCategory.set(e.category, row);
    }
    const bySize = new Map<string, ReportRow>();
    for (const s of sales) {
      for (const i of s.items) {
        if (salesCtx.filters.eggSize && i.eggSize !== salesCtx.filters.eggSize) continue;
        const row = bySize.get(i.eggSize) ?? { eggs: 0, revenue: 0 };
        addInto(row, { eggs: i.eggsCount, revenue: Number(i.lineTotal) });
        bySize.set(i.eggSize, row);
      }
      if (s.items.length === 0) {
        const row = bySize.get("Legacy (no size)") ?? { eggs: 0, revenue: 0 };
        addInto(row, { eggs: totalEggsForSale(s), revenue: Number(s.totalAmount) });
        bySize.set("Legacy (no size)", row);
      }
    }
    const byMethod = new Map<string, ReportRow>();
    for (const s of sales) {
      const k = s.paymentMethod ?? "Cash";
      const row = byMethod.get(k) ?? { revenue: 0, expenses: 0, net: 0 };
      addInto(row, { revenue: saleRevenue(s, salesCtx), net: saleRevenue(s, salesCtx) });
      byMethod.set(k, row);
    }
    for (const e of expenses) {
      const k = e.paymentMethod ?? "Not recorded";
      const row = byMethod.get(k) ?? { revenue: 0, expenses: 0, net: 0 };
      addInto(row, { expenses: Number(e.amount), net: -Number(e.amount) });
      byMethod.set(k, row);
    }

    const transactions: ReportRow[] = [
      ...sales.map((s) => ({
        farm: s.farmName,
        date: s.saleDate,
        time: s.createdAt,
        type: "Sale",
        reference: ref("SL", s.id),
        description: `${fmtNumber(saleEggs(s, salesCtx))} eggs${s.buyerName ? ` — ${s.buyerName}` : ""}`,
        category: "Eggs",
        paymentMethod: s.paymentMethod ?? "Cash",
        amount: saleRevenue(s, salesCtx),
        recordedBy: s.recordedByName ?? "—",
      })),
      ...expenses.map((e) => ({
        farm: e.farmName,
        date: e.expenseDate,
        time: e.createdAt,
        type: "Expense",
        reference: purchaseRef(data, e).reference,
        description: e.description,
        category: e.category,
        paymentMethod: e.paymentMethod ?? "—",
        amount: -Number(e.amount),
        recordedBy: e.recordedByName ?? "—",
      })),
    ];

    const notes = [
      "Net Profit = Sales Revenue − Expenses, using the same sale and expense records as the Sales and Expense reports for this period and filters — the figures reconcile exactly.",
      "Inventory purchases are counted once (their automatic expense); stock usage never adds an expense. No cost-of-goods-sold is applied — the app's accounting model doesn't define one.",
    ];
    if (isIncomplete(ctx.range, ctx.today)) notes.push("This period isn't over yet — comparisons with the previous (complete) period are partial.");
    if (period === "weekly") notes.push("Weeks run Monday to Sunday, matching the rest of the app.");

    const tables: ReportTable[] = [
      breakdownTable("daily", period === "monthly" ? "Daily Revenue & Expenses" : "Revenue & Expenses by Day", "Date", daily, moneyCols, {
        totals: { revenue, expenses: expenseTotal, net },
      }),
    ];
    if (period === "monthly" || period === "summary") {
      const weekly = new Map<string, ReportRow>();
      for (const [day, row] of daily) {
        const w = weekly.get(weekStart(day)) ?? { revenue: 0, expenses: 0, net: 0 };
        addInto(w, { revenue: Number(row.revenue), expenses: Number(row.expenses), net: Number(row.net) });
        weekly.set(weekStart(day), w);
      }
      tables.push(breakdownTable("weekly", "By Week (starting Monday)", "Week Of", weekly, moneyCols));
    }
    tables.push(
      breakdownTable("byCategory", "Expenses by Category", "Category", byCategory, [
        { key: "count", label: "Transactions", format: "number" },
        { key: "amount", label: "Amount", format: "currency" },
      ], { sortKey: "amount", sortDir: "desc" }),
      breakdownTable("bySize", "Revenue by Egg Size", "Egg Size", bySize, [
        { key: "eggs", label: "Eggs", format: "number" },
        { key: "revenue", label: "Revenue", format: "currency" },
      ]),
      breakdownTable("byMethod", "Totals by Payment Method", "Payment Method", byMethod, moneyCols),
      {
        id: "transactions",
        title: "Supporting Transactions",
        description: "Every sale (+) and expense (−) behind the totals above.",
        columns: withFarmColumn(ctx, [
          { key: "date", label: "Date", format: "date" },
          { key: "time", label: "Recorded At", format: "datetime" },
          { key: "type", label: "Type" },
          { key: "reference", label: "Reference" },
          { key: "description", label: "Description" },
          { key: "category", label: "Category" },
          { key: "paymentMethod", label: "Payment Method" },
          { key: "amount", label: "Amount", format: "currency" },
          { key: "recordedBy", label: "Recorded By" },
        ]),
        rows: transactions,
        totals: { amount: net },
        sort: { key: "date", dir: "desc" },
      }
    );
    return { summary, notes, tables };
  };
}

// ═════════════════════════════════════════════════════════════════════════
// Tasks
// ═════════════════════════════════════════════════════════════════════════

export function taskFilterOptions(data: ReportData): FilterOptions {
  return {
    status: Object.keys(TASK_STATUS_LABEL),
    staff: distinct(data.tasks.map((t) => t.assignedToName)),
    house: distinct(data.tasks.map((t) => t.housePen)),
  };
}

export function buildTaskReport(data: ReportData, ctx: ReportContext): ReportOutput {
  const now = Date.now();
  // A task belongs to the period if it was created, due, or completed in it.
  const tasks = data.tasks.filter(
    (t) =>
      (inRange(t.createdAt, ctx.range) || inRange(t.scheduledEnd, ctx.range) || inRange(t.completedAt, ctx.range)) &&
      matches(ctx.filters, "status", t.status) &&
      matches(ctx.filters, "staff", t.assignedToName) &&
      matches(ctx.filters, "house", t.housePen)
  );
  const overdueDays = (due: string | null, done: string | null) => {
    if (!due) return null;
    const end = done ? new Date(done).getTime() : now;
    const late = (end - new Date(due).getTime()) / 86_400_000;
    return late > 0 ? Math.floor(late * 10) / 10 : null;
  };
  const rows: ReportRow[] = tasks.map((t) => ({
    farm: "",
    title: t.title,
    assignedTo: t.assignedToName ?? "—",
    house: t.housePen ?? "—",
    created: t.createdAt,
    due: t.scheduledEnd,
    status: TASK_STATUS_LABEL[t.status],
    completed: t.completedAt,
    assignedBy: t.createdByName ?? "—",
    overdue: t.status === "completed" ? overdueDays(t.scheduledEnd, t.completedAt) : overdueDays(t.scheduledEnd, null),
  }));
  const count = (s: string) => tasks.filter((t) => t.status === s).length;
  const overdueOpen = tasks.filter((t) => t.status !== "completed" && t.scheduledEnd && new Date(t.scheduledEnd).getTime() < now).length;
  const byStaff = new Map<string, ReportRow>();
  for (const t of tasks) {
    const row = byStaff.get(t.assignedToName ?? "Unassigned") ?? { total: 0, completed: 0 };
    addInto(row, { total: 1, completed: t.status === "completed" ? 1 : 0 });
    byStaff.set(t.assignedToName ?? "Unassigned", row);
  }
  return {
    summary: [
      { label: "Tasks", value: `${tasks.length}` },
      { label: "Completed", value: `${count("completed")}`, tone: "positive" },
      { label: "In Progress", value: `${count("in_progress")}` },
      { label: "Pending", value: `${count("pending")}` },
      { label: "Blocked", value: `${count("blocked")}`, tone: count("blocked") ? "warning" : "default" },
      { label: "Overdue (open)", value: `${overdueOpen}`, tone: overdueOpen ? "negative" : "default" },
    ],
    notes: [
      "A task is included when it was created, due, or completed within the period. Overdue = days past the scheduled end (for completed tasks: how late it was finished).",
      ...(ctx.role === "Staff" ? ["Showing only tasks assigned to you."] : []),
    ],
    tables: [
      {
        id: "tasks",
        title: "Tasks",
        columns: [
          { key: "title", label: "Task" },
          { key: "assignedTo", label: "Assigned Staff" },
          { key: "house", label: "House / Pen" },
          { key: "created", label: "Created", format: "datetime" },
          { key: "due", label: "Due", format: "datetime" },
          { key: "status", label: "Status", format: "status" },
          { key: "completed", label: "Completed", format: "datetime" },
          { key: "assignedBy", label: "Assigned By" },
          { key: "overdue", label: "Overdue (days)", format: "number" },
        ],
        rows,
        sort: { key: "created", dir: "desc" },
      },
      breakdownTable("byStaff", "Tasks by Staff", "Staff", byStaff, [
        { key: "total", label: "Assigned", format: "number" },
        { key: "completed", label: "Completed", format: "number" },
      ]),
    ],
  };
}

// ═════════════════════════════════════════════════════════════════════════
// Approvals
// ═════════════════════════════════════════════════════════════════════════

const APPROVAL_TYPES = ["Egg Production", "Feed Distribution", "Vitamin Administration", "Mortality", "Layer Inventory"] as const;

interface Submission {
  farm: string;
  type: (typeof APPROVAL_TYPES)[number];
  reference: string;
  recordDate: string;
  detail: string;
  submittedById: string | null;
  submittedBy: string | null;
  submittedAt: string;
  status: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reason: string | null;
}

function submissions(data: ReportData): Submission[] {
  return [
    ...data.eggs.map((r) => ({ farm: r.farmName, type: "Egg Production" as const, reference: ref("EP", r.id), recordDate: r.productionDate, detail: `${fmtNumber(r.eggsCollected)} eggs — ${r.housePen}`, submittedById: r.recordedById, submittedBy: r.recordedByName, submittedAt: r.createdAt, status: r.status, reviewedBy: r.reviewedByName, reviewedAt: r.reviewedAt, reason: r.reviewNotes })),
    ...data.feedDistribution.map((r) => ({ farm: r.farmName, type: "Feed Distribution" as const, reference: ref("FD", r.id), recordDate: r.distributionDate, detail: `${formatFeedUsage(r, data.feedUnits[r.farmId] ?? r.enteredUnit)} of ${r.feedName} — ${r.housePen}`, submittedById: r.recordedById, submittedBy: r.recordedByName, submittedAt: r.createdAt, status: r.status, reviewedBy: r.reviewedByName, reviewedAt: r.reviewedAt, reason: r.reviewNotes })),
    ...data.vitaminAdministration.map((r) => ({ farm: r.farmName, type: "Vitamin Administration" as const, reference: ref("VA", r.id), recordDate: r.administrationDate, detail: `${fmtNumber(Number(r.quantityUsed))} × ${r.vitaminName} — ${r.housePen}`, submittedById: r.recordedById, submittedBy: r.recordedByName, submittedAt: r.createdAt, status: r.status, reviewedBy: r.reviewedByName, reviewedAt: r.reviewedAt, reason: r.reviewNotes })),
    ...data.mortality.map((r) => ({ farm: r.farmName, type: "Mortality" as const, reference: ref("MR", r.id), recordDate: r.recordDate, detail: `${fmtNumber(r.deadBirds)} birds — ${r.housePen}`, submittedById: r.recordedById, submittedBy: r.recordedByName, submittedAt: r.createdAt, status: r.status, reviewedBy: r.reviewedByName, reviewedAt: r.reviewedAt, reason: r.reviewNotes })),
    ...data.events.map((e) => ({ farm: e.farmName, type: "Layer Inventory" as const, reference: ref("PI", e.id), recordDate: e.eventDate, detail: `${e.eventType} — ${fmtNumber(e.quantity)} birds`, submittedById: e.recordedById, submittedBy: e.recordedByName, submittedAt: e.createdAt, status: e.reviewStatus, reviewedBy: e.reviewedByName, reviewedAt: e.reviewedAt, reason: e.reviewNotes })),
  ];
}

export function approvalFilterOptions(data: ReportData): FilterOptions {
  return {
    transactionType: [...APPROVAL_TYPES],
    status: ["pending", "approved", "rejected"],
    staff: distinct(submissions(data).map((s) => s.submittedBy)),
  };
}

export function buildApprovalReport(data: ReportData, ctx: ReportContext): ReportOutput {
  const all = submissions(data).filter(
    (s) =>
      inRange(s.submittedAt, ctx.range) &&
      matches(ctx.filters, "transactionType", s.type) &&
      matches(ctx.filters, "status", s.status) &&
      matches(ctx.filters, "staff", s.submittedBy) &&
      (ctx.role !== "Staff" || s.submittedById === ctx.userId)
  );
  const decided = all.filter((s) => s.status !== "pending" && s.reviewedAt);
  const avgHours = decided.length
    ? sumBy(decided, (s) => (new Date(s.reviewedAt!).getTime() - new Date(s.submittedAt).getTime()) / 3_600_000) / decided.length
    : null;
  const byType = new Map<string, ReportRow>();
  for (const s of all) {
    const row = byType.get(s.type) ?? { total: 0, pending: 0, approved: 0, rejected: 0 };
    addInto(row, { total: 1, [s.status]: 1 });
    byType.set(s.type, row);
  }
  return {
    summary: [
      { label: "Submissions", value: `${all.length}` },
      { label: "Pending", value: `${all.filter((s) => s.status === "pending").length}`, tone: "warning" },
      { label: "Approved", value: `${all.filter((s) => s.status === "approved").length}`, tone: "positive" },
      { label: "Rejected", value: `${all.filter((s) => s.status === "rejected").length}`, tone: "negative" },
      { label: "Average Decision Time", value: avgHours === null ? "—" : `${avgHours.toFixed(1)} hours`, hint: "Submitted → reviewed" },
    ],
    notes: [
      "Submissions are dated by when they were entered (created_at). Records entered directly by a Farm Admin are approved at entry and appear as approved by them.",
      "Reviewer, decision time and reason are shown only where the database recorded them — older records may not have a reviewer.",
      ...(ctx.role === "Staff" ? ["Showing only your own submissions."] : []),
    ],
    tables: [
      {
        id: "submissions",
        title: "Approval Log",
        columns: withFarmColumn(ctx, [
          { key: "type", label: "Transaction Type" },
          { key: "reference", label: "Reference" },
          { key: "recordDate", label: "Record Date", format: "date" },
          { key: "detail", label: "Detail" },
          { key: "submittedBy", label: "Submitted By" },
          { key: "submittedAt", label: "Submitted At", format: "datetime" },
          { key: "status", label: "Status", format: "status" },
          { key: "reviewedBy", label: "Reviewed By" },
          { key: "reviewedAt", label: "Decision At", format: "datetime" },
          { key: "reason", label: "Rejection Reason" },
        ]),
        rows: all.map((s) => ({
          farm: s.farm,
          type: s.type,
          reference: s.reference,
          recordDate: s.recordDate,
          detail: s.detail,
          submittedBy: s.submittedBy ?? "—",
          submittedAt: s.submittedAt,
          status: statusLabel(s.status),
          reviewedBy: s.status === "pending" ? "—" : (s.reviewedBy ?? "Not recorded"),
          reviewedAt: s.reviewedAt,
          reason: s.status === "rejected" ? (s.reason ?? "Not recorded") : "",
        })),
        sort: { key: "submittedAt", dir: "desc" },
      },
      breakdownTable("byType", "By Transaction Type", "Type", byType, [
        { key: "total", label: "Total", format: "number" },
        { key: "pending", label: "Pending", format: "number" },
        { key: "approved", label: "Approved", format: "number" },
        { key: "rejected", label: "Rejected", format: "number" },
      ]),
    ],
  };
}

// ═════════════════════════════════════════════════════════════════════════
// Activity / audit
// ═════════════════════════════════════════════════════════════════════════

export function auditFilterOptions(data: ReportData): FilterOptions {
  return {
    module: distinct(data.audit.map((a) => a.module)),
    staff: distinct(data.audit.map((a) => a.userName)),
  };
}

export function buildAuditReport(data: ReportData, ctx: ReportContext): ReportOutput {
  const entries = data.audit.filter((a) => matches(ctx.filters, "module", a.module) && matches(ctx.filters, "staff", a.userName));
  const byModule = new Map<string, ReportRow>();
  for (const a of entries) {
    const row = byModule.get(a.module) ?? { events: 0, failures: 0 };
    addInto(row, { events: 1, failures: a.status === "failure" ? 1 : 0 });
    byModule.set(a.module, row);
  }
  const byUser = new Map<string, ReportRow>();
  for (const a of entries) {
    const key = a.userName ?? "System";
    const row = byUser.get(key) ?? { events: 0 };
    addInto(row, { events: 1 });
    byUser.set(key, row);
  }
  return {
    summary: [
      { label: "Activity Events", value: `${entries.length}` },
      { label: "Users", value: `${byUser.size}` },
      { label: "Failures", value: `${entries.filter((a) => a.status === "failure").length}`, tone: entries.some((a) => a.status === "failure") ? "warning" : "default" },
    ],
    notes: [
      ctx.role === "Staff" ? "Showing only your own activity." : ctx.role === "Super Admin" ? "Platform activity, narrowed by the farm selector." : "Activity recorded for your farm.",
      ...(data.auditTruncated ? ["This period has more than 5,000 events — only the most recent 5,000 are included. Narrow the date range for a complete list."] : []),
    ],
    tables: [
      {
        id: "audit",
        title: "Activity Log",
        columns: withFarmColumn(ctx, [
          { key: "time", label: "Date / Time", format: "datetime" },
          { key: "user", label: "User" },
          { key: "role", label: "Role" },
          { key: "action", label: "Action" },
          { key: "module", label: "Module" },
          { key: "record", label: "Related Record" },
          { key: "outcome", label: "Outcome", format: "status" },
          { key: "description", label: "Description" },
        ]),
        rows: entries.map((a) => ({
          farm: a.farmName ?? "—",
          time: a.createdAt,
          user: a.userName ?? "System",
          role: a.userRole ?? "—",
          action: a.action.replace(/_/g, " "),
          module: a.module,
          record: a.tableName ? `${a.tableName}${a.recordId ? ` · ${a.recordId.slice(0, 8)}` : ""}` : "—",
          outcome: statusLabel(a.status),
          description: a.description ?? "",
        })),
        sort: { key: "time", dir: "desc" },
      },
      breakdownTable("byModule", "Activity by Module", "Module", byModule, [
        { key: "events", label: "Events", format: "number" },
        { key: "failures", label: "Failures", format: "number" },
      ], { sortKey: "events", sortDir: "desc" }),
      breakdownTable("byUser", "Activity by User", "User", byUser, [{ key: "events", label: "Events", format: "number" }], { sortKey: "events", sortDir: "desc" }),
    ],
  };
}

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CalendarDays, ChartPie, Download, Loader2, Monitor, Printer, Receipt, Search, ShoppingCart, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import {
  expensesByCategory,
  expensesByFarm,
  listExpenses,
  listSales,
  salesByCategory,
  salesByFarm,
  totalExpenses,
  totalSales,
} from "@poultryhub/shared/services/salesExpensesService";
import { downloadCsv } from "@poultryhub/shared/lib/exportCsv";
import SalesExpensesAnalytics from "@poultryhub/shared/components/finance/SalesExpensesAnalytics";
import StatTile from "@poultryhub/shared/components/production/StatTile";
import { useBreakpoint } from "@poultryhub/shared/hooks/useBreakpoint";
import type { ExpenseRecord, SaleRecord } from "@poultryhub/shared/types/salesExpenses";

type Tab = "sales" | "expenses";
const todayIso = () => new Date().toISOString().slice(0, 10);
const currency = (v: number) => `₱${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function SalesExpensesOversightPage() {
  const breakpoint = useBreakpoint();
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>("sales");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([listSales(), listExpenses()])
      .then(([s, e]) => {
        if (cancelled) return;
        setSales(s);
        setExpenses(e);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load sales & expenses data.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const revenue = useMemo(() => totalSales(sales), [sales]);
  const expenseTotal = useMemo(() => totalExpenses(expenses), [expenses]);
  const netProfit = revenue - expenseTotal;

  const filteredSales = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return sales;
    return sales.filter((s) => `${s.farmName} ${s.itemCategory} ${s.buyerName ?? ""} ${s.description ?? ""}`.toLowerCase().includes(term));
  }, [sales, search]);

  const filteredExpenses = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return expenses;
    return expenses.filter((e) => `${e.farmName} ${e.category} ${e.vendor ?? ""} ${e.description}`.toLowerCase().includes(term));
  }, [expenses, search]);

  const today = todayIso();

  const handleExportSales = () =>
    downloadCsv(
      `sales-report-${today}.csv`,
      sales.map((s) => ({
        Farm: s.farmName,
        Date: s.saleDate,
        Category: s.itemCategory,
        Description: s.description ?? "",
        Quantity: s.quantity,
        Unit: s.unit,
        "Unit Price": s.unitPrice,
        Total: s.totalAmount,
        Buyer: s.buyerName ?? "",
        "Payment Status": s.paymentStatus,
      }))
    );

  const handleExportExpenses = () =>
    downloadCsv(
      `expense-report-${today}.csv`,
      expenses.map((e) => ({
        Farm: e.farmName,
        Date: e.expenseDate,
        Category: e.category,
        Description: e.description,
        Amount: e.amount,
        Vendor: e.vendor ?? "",
        "Payment Method": e.paymentMethod ?? "",
      }))
    );

  const handleExportFinancialSummary = () =>
    downloadCsv(`financial-summary-${today}.csv`, [
      { Metric: "Total Revenue", Amount: revenue },
      { Metric: "Total Expenses", Amount: expenseTotal },
      { Metric: "Net Profit", Amount: netProfit },
    ]);

  const handleExportSalesByCategory = () =>
    downloadCsv(
      `sales-by-category-${today}.csv`,
      salesByCategory(sales).map((c) => ({ Category: c.label, "Total Revenue": c.value }))
    );

  const handleExportExpensesByCategory = () =>
    downloadCsv(
      `expenses-by-category-${today}.csv`,
      expensesByCategory(expenses).map((c) => ({ Category: c.label, "Total Amount": c.value }))
    );

  const handleExportFarmComparison = () => {
    const revenueByFarm = salesByFarm(sales);
    const expensesByFarmMap = expensesByFarm(expenses);
    const farms = new Map<string, string>();
    for (const f of revenueByFarm) farms.set(f.label, f.label);
    for (const f of expensesByFarmMap) farms.set(f.label, f.label);
    downloadCsv(
      `farm-financial-comparison-${today}.csv`,
      [...farms.keys()].map((farm) => {
        const rev = revenueByFarm.find((f) => f.label === farm)?.value ?? 0;
        const exp = expensesByFarmMap.find((f) => f.label === farm)?.value ?? 0;
        return { Farm: farm, Revenue: rev, Expenses: exp, "Net Profit": rev - exp };
      })
    );
  };

  const combinedTransactionRows = (saleRows: SaleRecord[], expenseRows: ExpenseRecord[]) => [
    ...saleRows.map((s) => ({
      Type: "Sale",
      Farm: s.farmName,
      Date: s.saleDate,
      Category: s.itemCategory,
      Description: s.description ?? "",
      Amount: s.totalAmount,
    })),
    ...expenseRows.map((e) => ({
      Type: "Expense",
      Farm: e.farmName,
      Date: e.expenseDate,
      Category: e.category,
      Description: e.description,
      Amount: e.amount,
    })),
  ];

  const handleExportDaily = () =>
    downloadCsv(
      `daily-financial-report-${today}.csv`,
      combinedTransactionRows(
        sales.filter((s) => s.saleDate === today),
        expenses.filter((e) => e.expenseDate === today)
      )
    );

  const handleExportMonthly = () => {
    const monthPrefix = today.slice(0, 7);
    downloadCsv(
      `monthly-financial-report-${monthPrefix}.csv`,
      combinedTransactionRows(
        sales.filter((s) => s.saleDate.slice(0, 7) === monthPrefix),
        expenses.filter((e) => e.expenseDate.slice(0, 7) === monthPrefix)
      )
    );
  };

  if (breakpoint !== "desktop") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-6 py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
          <Monitor size={26} strokeWidth={1.75} />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold text-[var(--color-foreground)]">Best viewed on a larger screen</h2>
          <p className="mt-1.5 max-w-sm text-sm text-[var(--color-muted)]">Sales & Expenses supervision is designed for desktop. Please switch to a larger screen.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-24 text-sm text-[var(--color-muted)]">
        <Loader2 size={16} className="spinner" /> Loading sales & expenses…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-24 text-center">
        <AlertCircle size={20} className="text-[var(--color-danger)]" />
        <p className="text-sm text-[var(--color-foreground)]">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 print:gap-3">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="font-display text-xl font-semibold text-[var(--color-foreground)]">Sales & Expenses</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">System-wide financial oversight — read-only. Recording happens in each farm's own portal.</p>
        </div>
        <button type="button" onClick={() => window.print()} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
          <Printer size={14} /> Print / Save as PDF
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        <StatTile icon={TrendingUp} label="Total Revenue" value={currency(revenue)} />
        <StatTile icon={TrendingDown} label="Total Expenses" value={currency(expenseTotal)} />
        <StatTile icon={Wallet} label="Net Profit" value={currency(netProfit)} />
        <StatTile icon={ShoppingCart} label="Sales Recorded" value={sales.length} />
        <StatTile icon={Receipt} label="Expenses Recorded" value={expenses.length} />
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <h2 className="font-display text-base font-semibold text-[var(--color-foreground)]">Records</h2>
          <div className="relative sm:max-w-xs">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search farm, category, buyer/vendor…"
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] py-2 pl-9 pr-3 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)]"
            />
          </div>
        </div>

        <div className="mt-3 flex rounded-lg border border-[var(--color-border)] p-0.5 text-xs font-medium print:hidden" style={{ width: "fit-content" }}>
          {(["sales", "expenses"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 capitalize transition-colors ${tab === t ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"}`}
            >
              {t === "sales" ? "Sales" : "Expenses"}
            </button>
          ))}
        </div>

        <div className="mt-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
          {tab === "sales" ? (
            filteredSales.length === 0 ? (
              <div className="py-16 text-center text-sm text-[var(--color-muted)]">No sales match that search.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-muted)]">
                      <th className="px-4 py-3 font-medium">Farm</th>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Category</th>
                      <th className="px-4 py-3 font-medium">Quantity</th>
                      <th className="px-4 py-3 font-medium">Total</th>
                      <th className="px-4 py-3 font-medium">Buyer</th>
                      <th className="px-4 py-3 font-medium">Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSales.map((s) => (
                      <tr key={s.id} className="border-b border-[var(--color-border)] last:border-0">
                        <td className="px-4 py-3 text-[var(--color-foreground)]">{s.farmName}</td>
                        <td className="px-4 py-3 text-[var(--color-muted)]">{new Date(`${s.saleDate}T00:00:00`).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-[var(--color-muted)]">{s.itemCategory}</td>
                        <td className="px-4 py-3 text-[var(--color-muted)]">{s.quantity.toLocaleString()} {s.unit}</td>
                        <td className="px-4 py-3 text-[var(--color-foreground)]">{currency(s.totalAmount)}</td>
                        <td className="px-4 py-3 text-[var(--color-muted)]">{s.buyerName ?? "—"}</td>
                        <td className="px-4 py-3 text-[var(--color-muted)] capitalize">{s.paymentStatus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : filteredExpenses.length === 0 ? (
            <div className="py-16 text-center text-sm text-[var(--color-muted)]">No expenses match that search.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-muted)]">
                    <th className="px-4 py-3 font-medium">Farm</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Description</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Vendor</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.map((e) => (
                    <tr key={e.id} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="px-4 py-3 text-[var(--color-foreground)]">{e.farmName}</td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{new Date(`${e.expenseDate}T00:00:00`).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{e.category}</td>
                      <td className="px-4 py-3 text-[var(--color-foreground)]">{e.description}</td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{currency(e.amount)}</td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{e.vendor ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="print:hidden">
        <SalesExpensesAnalytics sales={sales} expenses={expenses} showFarmComparison />
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 print:hidden">
        <h2 className="font-display text-sm font-semibold text-[var(--color-foreground)]">Reports</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={handleExportSales} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
            <Download size={13} /> Sales Report
          </button>
          <button type="button" onClick={handleExportExpenses} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
            <Download size={13} /> Expense Report
          </button>
          <button type="button" onClick={handleExportFinancialSummary} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
            <Download size={13} /> Financial Summary
          </button>
          <button type="button" onClick={handleExportSalesByCategory} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
            <ChartPie size={13} /> Sales by Category
          </button>
          <button type="button" onClick={handleExportExpensesByCategory} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
            <ChartPie size={13} /> Expenses by Category
          </button>
          <button type="button" onClick={handleExportFarmComparison} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
            <Download size={13} /> Farm Financial Comparison
          </button>
          <button type="button" onClick={handleExportDaily} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
            <CalendarDays size={13} /> Daily Financial Report
          </button>
          <button type="button" onClick={handleExportMonthly} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
            <CalendarDays size={13} /> Monthly Financial Report
          </button>
          <button type="button" onClick={() => window.print()} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
            <Printer size={13} /> Print / Save as PDF
          </button>
        </div>
      </div>
    </div>
  );
}

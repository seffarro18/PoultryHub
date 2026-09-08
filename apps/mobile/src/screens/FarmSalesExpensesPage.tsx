import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CalendarDays, Download, Loader2, Pencil, Plus, Printer, ShieldAlert, ShoppingCart, Trash2, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { deleteExpense, deleteSale, listExpenses, listSales, totalExpenses, totalSales } from "@poultryhub/shared/services/salesExpensesService";
import { downloadCsv } from "@poultryhub/shared/lib/exportCsv";
import SaleFormDrawer from "../components/finance/SaleFormDrawer";
import ExpenseFormDrawer from "../components/finance/ExpenseFormDrawer";
import SalesExpensesAnalytics from "@poultryhub/shared/components/finance/SalesExpensesAnalytics";
import StatTile from "@poultryhub/shared/components/production/StatTile";
import { useAuth } from "@poultryhub/shared/context/AuthContext";
import type { ExpenseRecord, SaleRecord } from "@poultryhub/shared/types/salesExpenses";

type Tab = "sales" | "expenses";
const todayIso = () => new Date().toISOString().slice(0, 10);
const currency = (v: number) => `₱${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function FarmSalesExpensesPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("sales");
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingSale, setEditingSale] = useState<SaleRecord | null | "new">(null);
  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null | "new">(null);

  const refresh = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [s, e] = await Promise.all([listSales(), listExpenses()]);
      setSales(s);
      setExpenses(e);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load sales & expenses data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.farmId) void refresh();
    else setIsLoading(false);
  }, [user?.farmId]);

  const today = todayIso();
  const revenue = useMemo(() => totalSales(sales), [sales]);
  const expenseTotal = useMemo(() => totalExpenses(expenses), [expenses]);
  const todaysRevenue = useMemo(() => totalSales(sales.filter((s) => s.saleDate === today)), [sales, today]);

  const handleDeleteSale = async (sale: SaleRecord) => {
    if (!window.confirm(`Delete this ${sale.itemCategory} sale (${currency(sale.totalAmount)})?`)) return;
    setBusyId(sale.id);
    try {
      await deleteSale(sale.id);
      setSales((prev) => prev.filter((s) => s.id !== sale.id));
    } catch (err) {
      console.error("[FarmSalesExpensesPage] delete sale failed:", err);
      alert("Couldn't delete this sale.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteExpense = async (expense: ExpenseRecord) => {
    if (!window.confirm(`Delete this expense (${currency(expense.amount)})?`)) return;
    setBusyId(expense.id);
    try {
      await deleteExpense(expense.id);
      setExpenses((prev) => prev.filter((e) => e.id !== expense.id));
    } catch (err) {
      console.error("[FarmSalesExpensesPage] delete expense failed:", err);
      alert("Couldn't delete this expense.");
    } finally {
      setBusyId(null);
    }
  };

  const handleExportSales = () =>
    downloadCsv(
      `sales-${today}.csv`,
      sales.map((s) => ({
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
      `expenses-${today}.csv`,
      expenses.map((e) => ({
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
      { Metric: "Net Profit", Amount: revenue - expenseTotal },
    ]);

  const combinedTransactionRows = (saleRows: SaleRecord[], expenseRows: ExpenseRecord[]) => [
    ...saleRows.map((s) => ({
      Type: "Sale",
      Date: s.saleDate,
      Category: s.itemCategory,
      Description: s.description ?? "",
      Amount: s.totalAmount,
    })),
    ...expenseRows.map((e) => ({
      Type: "Expense",
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

  const handleExportWeekly = () => {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    downloadCsv(
      `weekly-financial-report-${today}.csv`,
      combinedTransactionRows(
        sales.filter((s) => s.saleDate >= cutoff),
        expenses.filter((e) => e.expenseDate >= cutoff)
      )
    );
  };

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

  if (!user?.farmId) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-6 py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-warning)]/10 text-[var(--color-warning)]">
          <ShieldAlert size={26} strokeWidth={1.75} />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold text-[var(--color-foreground)]">Not assigned to a farm yet</h2>
          <p className="mt-1.5 max-w-sm text-sm text-[var(--color-muted)]">Ask your Super Admin to assign your account to a farm before you can manage sales & expenses.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 print:gap-3">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="font-display text-xl font-semibold text-[var(--color-foreground)]">Sales & Expenses</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">Record sales and track expenses for your farm.</p>
        </div>
        <button type="button" onClick={() => window.print()} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
          <Printer size={14} /> Print / Save as PDF
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile icon={TrendingUp} label="Total Revenue" value={currency(revenue)} />
        <StatTile icon={TrendingDown} label="Total Expenses" value={currency(expenseTotal)} />
        <StatTile icon={Wallet} label="Net Profit" value={currency(revenue - expenseTotal)} />
        <StatTile icon={ShoppingCart} label="Revenue Today" value={currency(todaysRevenue)} />
      </div>

      <div className="flex rounded-lg border border-[var(--color-border)] p-0.5 text-xs font-medium print:hidden" style={{ width: "fit-content" }}>
        <button
          type="button"
          onClick={() => setTab("sales")}
          className={`rounded-md px-3 py-1.5 transition-colors ${tab === "sales" ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"}`}
        >
          Sales
        </button>
        <button
          type="button"
          onClick={() => setTab("expenses")}
          className={`rounded-md px-3 py-1.5 transition-colors ${tab === "expenses" ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"}`}
        >
          Expenses
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-16 text-sm text-[var(--color-muted)]">
          <Loader2 size={16} className="spinner" /> Loading…
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-16 text-center">
          <AlertCircle size={20} className="text-[var(--color-danger)]" />
          <p className="text-sm text-[var(--color-foreground)]">{loadError}</p>
        </div>
      ) : tab === "sales" ? (
        <>
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-base font-semibold text-[var(--color-foreground)]">Sales</h2>
              <div className="flex gap-2 print:hidden">
                <button type="button" onClick={() => setEditingSale("new")} className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-3.5 py-2 text-sm font-semibold text-white">
                  <Plus size={15} /> Record Sale
                </button>
              </div>
            </div>
            <div className="mt-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
              {sales.length === 0 ? (
                <div className="py-16 text-center text-sm text-[var(--color-muted)]">No sales recorded yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-muted)]">
                        <th className="px-4 py-3 font-medium">Date</th>
                        <th className="px-4 py-3 font-medium">Category</th>
                        <th className="px-4 py-3 font-medium">Quantity</th>
                        <th className="px-4 py-3 font-medium">Total</th>
                        <th className="px-4 py-3 font-medium">Buyer</th>
                        <th className="px-4 py-3 font-medium">Payment</th>
                        <th className="px-4 py-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sales.map((s) => (
                        <tr key={s.id} className="border-b border-[var(--color-border)] last:border-0">
                          <td className="px-4 py-3 text-[var(--color-foreground)]">{new Date(`${s.saleDate}T00:00:00`).toLocaleDateString()}</td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">{s.itemCategory}</td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">{s.quantity.toLocaleString()} {s.unit}</td>
                          <td className="px-4 py-3 text-[var(--color-foreground)]">{currency(s.totalAmount)}</td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">{s.buyerName ?? "—"}</td>
                          <td className="px-4 py-3 text-[var(--color-muted)] capitalize">{s.paymentStatus}</td>
                          <td className="px-4 py-3">
                            {busyId === s.id ? (
                              <Loader2 size={15} className="spinner text-[var(--color-muted)]" />
                            ) : (
                              <div className="flex items-center gap-1">
                                <button type="button" onClick={() => setEditingSale(s)} title="Edit" className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)] hover:text-[var(--color-foreground)]">
                                  <Pencil size={14} />
                                </button>
                                <button type="button" onClick={() => void handleDeleteSale(s)} title="Delete" className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)]">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-base font-semibold text-[var(--color-foreground)]">Expenses</h2>
              <div className="flex gap-2 print:hidden">
                <button type="button" onClick={() => setEditingExpense("new")} className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-3.5 py-2 text-sm font-semibold text-white">
                  <Plus size={15} /> Record Expense
                </button>
              </div>
            </div>
            <div className="mt-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
              {expenses.length === 0 ? (
                <div className="py-16 text-center text-sm text-[var(--color-muted)]">No expenses recorded yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-muted)]">
                        <th className="px-4 py-3 font-medium">Date</th>
                        <th className="px-4 py-3 font-medium">Category</th>
                        <th className="px-4 py-3 font-medium">Description</th>
                        <th className="px-4 py-3 font-medium">Amount</th>
                        <th className="px-4 py-3 font-medium">Vendor</th>
                        <th className="px-4 py-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.map((e) => (
                        <tr key={e.id} className="border-b border-[var(--color-border)] last:border-0">
                          <td className="px-4 py-3 text-[var(--color-foreground)]">{new Date(`${e.expenseDate}T00:00:00`).toLocaleDateString()}</td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">{e.category}</td>
                          <td className="px-4 py-3 text-[var(--color-foreground)]">{e.description}</td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">{currency(e.amount)}</td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">{e.vendor ?? "—"}</td>
                          <td className="px-4 py-3">
                            {busyId === e.id ? (
                              <Loader2 size={15} className="spinner text-[var(--color-muted)]" />
                            ) : (
                              <div className="flex items-center gap-1">
                                <button type="button" onClick={() => setEditingExpense(e)} title="Edit" className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)] hover:text-[var(--color-foreground)]">
                                  <Pencil size={14} />
                                </button>
                                <button type="button" onClick={() => void handleDeleteExpense(e)} title="Delete" className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)]">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {!isLoading && !loadError && (
        <div className="print:hidden">
          <SalesExpensesAnalytics sales={sales} expenses={expenses} />
        </div>
      )}

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
          <button type="button" onClick={handleExportDaily} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
            <CalendarDays size={13} /> Daily Financial Report
          </button>
          <button type="button" onClick={handleExportWeekly} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
            <CalendarDays size={13} /> Weekly Financial Report
          </button>
          <button type="button" onClick={handleExportMonthly} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
            <CalendarDays size={13} /> Monthly Financial Report
          </button>
          <button type="button" onClick={() => window.print()} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
            <Printer size={13} /> Print / Save as PDF
          </button>
        </div>
      </div>

      {editingSale !== null && user.farmId && (
        <SaleFormDrawer
          sale={editingSale === "new" ? null : editingSale}
          fixedFarmId={user.farmId}
          onClose={() => setEditingSale(null)}
          onSaved={() => {
            setEditingSale(null);
            void refresh();
          }}
        />
      )}

      {editingExpense !== null && user.farmId && (
        <ExpenseFormDrawer
          expense={editingExpense === "new" ? null : editingExpense}
          fixedFarmId={user.farmId}
          onClose={() => setEditingExpense(null)}
          onSaved={() => {
            setEditingExpense(null);
            void refresh();
          }}
        />
      )}
    </div>
  );
}

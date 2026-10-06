import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { createExpense, updateExpense } from "@poultryhub/shared/services/salesExpensesService";
import { filterDecimalText, parseNumericText } from "@poultryhub/shared/lib/numericInput";
import { EXPENSE_CATEGORIES, type ExpenseInput, type ExpenseRecord } from "@poultryhub/shared/types/salesExpenses";

interface ExpenseFormDrawerProps {
  /** null = add mode */
  expense: ExpenseRecord | null;
  fixedFarmId: string;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Expenses only ever use Cash going forward — no dropdown, no manual
 * choice. A new expense is always "cash" (the one canonical stored value).
 * Editing an old expense leaves its existing paymentMethod untouched
 * (whatever it was, e.g. a legacy "GCash" row from before this
 * restriction) — correcting an unrelated field like the description must
 * never silently rewrite that historical value.
 */
function toInputState(expense: ExpenseRecord | null, fixedFarmId: string): ExpenseInput {
  if (expense) {
    return {
      farmId: expense.farmId,
      expenseDate: expense.expenseDate,
      category: expense.category,
      description: expense.description,
      amount: expense.amount,
      paymentMethod: expense.paymentMethod,
      vendor: expense.vendor,
      remarks: expense.remarks,
    };
  }
  return {
    farmId: fixedFarmId,
    expenseDate: new Date().toISOString().slice(0, 10),
    category: "Feed",
    description: "",
    amount: 0,
    paymentMethod: "cash",
    vendor: null,
    remarks: null,
  };
}

const inputClass =
  "rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)]";

export default function ExpenseFormDrawer({ expense, fixedFarmId, onClose, onSaved }: ExpenseFormDrawerProps) {
  const isEdit = expense !== null;
  const [input, setInput] = useState<ExpenseInput>(() => toInputState(expense, fixedFarmId));
  // A raw text buffer, not derived from input.amount — a plain 0-collapses-
  // to-empty display would strip the "0" the moment it's typed, making it
  // impossible to type a sub-1 amount like "0.05" character by character.
  const [amountText, setAmountText] = useState(() => (expense && expense.amount > 0 ? String(expense.amount) : ""));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.description.trim()) {
      setError("Description is required.");
      return;
    }
    if (input.amount <= 0) {
      setError("Amount must be greater than zero.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: ExpenseInput = { ...input, description: input.description.trim() };
      if (isEdit) {
        await updateExpense(expense.id, payload);
      } else {
        await createExpense(payload);
      }
      onSaved();
    } catch (err) {
      console.error("[ExpenseFormDrawer] save failed:", err);
      setError("Couldn't save this expense. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <h2 className="font-display text-base font-semibold text-[var(--color-foreground)]">{isEdit ? "Edit Expense" : "Record Expense"}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)]" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex flex-col gap-4 px-5 py-4">
            {error && <p className="rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">{error}</p>}

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="expense-date" className="text-sm font-medium text-[var(--color-foreground)]">Date</label>
                <input id="expense-date" type="date" value={input.expenseDate} onChange={(e) => setInput((prev) => ({ ...prev, expenseDate: e.target.value }))} className={inputClass} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="expense-category" className="text-sm font-medium text-[var(--color-foreground)]">Category</label>
                <select
                  id="expense-category"
                  value={input.category}
                  onChange={(e) => setInput((prev) => ({ ...prev, category: e.target.value as ExpenseInput["category"] }))}
                  className={inputClass}
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="expense-description" className="text-sm font-medium text-[var(--color-foreground)]">Description</label>
              <input
                id="expense-description"
                value={input.description}
                onChange={(e) => setInput((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="e.g. 20 sacks of layer feed"
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="expense-amount" className="text-sm font-medium text-[var(--color-foreground)]">Amount</label>
                <input
                  id="expense-amount"
                  type="text"
                  inputMode="decimal"
                  placeholder="Enter amount"
                  value={amountText}
                  onChange={(e) => {
                    const filtered = filterDecimalText(e.target.value);
                    setAmountText(filtered);
                    setInput((prev) => ({ ...prev, amount: parseNumericText(filtered) }));
                  }}
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-[var(--color-foreground)]">Payment Method</span>
                <div className={`${inputClass} bg-[var(--color-muted-bg)] capitalize text-[var(--color-muted)]`}>
                  {input.paymentMethod ?? "Cash"}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="expense-vendor" className="text-sm font-medium text-[var(--color-foreground)]">Vendor</label>
              <input
                id="expense-vendor"
                value={input.vendor ?? ""}
                onChange={(e) => setInput((prev) => ({ ...prev, vendor: e.target.value || null }))}
                placeholder="Optional"
                className={inputClass}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="expense-remarks" className="text-sm font-medium text-[var(--color-foreground)]">Remarks</label>
              <textarea
                id="expense-remarks"
                value={input.remarks ?? ""}
                onChange={(e) => setInput((prev) => ({ ...prev, remarks: e.target.value || null }))}
                rows={2}
                placeholder="Optional"
                className={`${inputClass} resize-none`}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] px-5 py-4">
            <button type="button" onClick={onClose} className="rounded-lg px-3.5 py-2 text-sm font-medium text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)]">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-70">
              {saving && <Loader2 size={14} className="spinner" />}
              {isEdit ? "Save changes" : "Record expense"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

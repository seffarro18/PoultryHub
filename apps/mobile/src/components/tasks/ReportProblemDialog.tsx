import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Button from "@poultryhub/shared/components/ui/Button";
import { useEscapeKey } from "@poultryhub/shared/hooks/useEscapeKey";
import { TASK_PROBLEM_CATEGORY_LABEL, type TaskProblemCategory } from "@poultryhub/shared/types/task";

interface ReportProblemDialogProps {
  onCancel: () => void;
  onConfirm: (category: TaskProblemCategory, comment: string) => void;
  confirming?: boolean;
}

const CATEGORIES = Object.keys(TASK_PROBLEM_CATEGORY_LABEL) as TaskProblemCategory[];

export default function ReportProblemDialog({ onCancel, onConfirm, confirming = false }: ReportProblemDialogProps) {
  const [category, setCategory] = useState<TaskProblemCategory>("missing_supplies");
  const [comment, setComment] = useState("");
  const trimmed = comment.trim();
  const reducedMotion = useReducedMotion();

  useEscapeKey(onCancel);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0.01 : 0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, scale: reducedMotion ? 1 : 0.96, y: reducedMotion ? 0 : 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0.01 : 0.25, ease: [0.22, 1, 0.36, 1] }}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="report-problem-title"
        className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="report-problem-title" className="font-display text-base font-semibold text-[var(--color-foreground)]">
          Report a problem
        </h2>
        <p className="mt-1.5 text-sm text-[var(--color-muted)]">
          This marks the task as blocked and alerts your Farm Admin/Manager.
        </p>

        <div className="mt-3 flex flex-col gap-1.5">
          <label htmlFor="problem-category" className="text-sm font-medium text-[var(--color-foreground)]">
            Category
          </label>
          <select
            id="problem-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as TaskProblemCategory)}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {TASK_PROBLEM_CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </div>

        <label htmlFor="problem-comment" className="sr-only">
          Describe the problem
        </label>
        <textarea
          id="problem-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder="Describe what's blocking this task…"
          className="mt-3 w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
        />

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            loading={confirming}
            loadingText="Reporting…"
            disabled={!trimmed}
            onClick={() => onConfirm(category, trimmed)}
            className="!bg-[var(--color-danger)] !text-white hover:!brightness-95"
          >
            Report Problem
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

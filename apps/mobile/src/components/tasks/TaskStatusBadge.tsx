import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { TASK_STATUS_LABEL, type TaskStatus } from "@poultryhub/shared/types/task";

const STATUS_STYLE: Record<TaskStatus, { color: string }> = {
  pending: { color: "var(--color-warning)" },
  in_progress: { color: "var(--color-primary)" },
  completed: { color: "var(--color-success)" },
  blocked: { color: "var(--color-danger)" },
};

interface TaskStatusBadgeProps {
  status: TaskStatus;
  /** Computed, never stored — see isTaskOverdue(). Shown alongside the status pill, never in place of it. */
  overdue?: boolean;
}

/** Keyed by status so a transition plays a quick, single settle-in on the badge — same technique as ProductionStatusBadge. */
export default function TaskStatusBadge({ status, overdue = false }: TaskStatusBadgeProps) {
  const { color } = STATUS_STYLE[status];
  const reducedMotion = useReducedMotion();

  return (
    <div className="inline-flex items-center gap-1.5">
      <motion.span
        key={status}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: reducedMotion ? 0.01 : 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
        style={{ color, backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)` }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
        {TASK_STATUS_LABEL[status]}
      </motion.span>
      {overdue && (
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-danger)]/10 px-2 py-0.5 text-xs font-medium text-[var(--color-danger)]">
          <AlertTriangle size={11} />
          Overdue
        </span>
      )}
    </div>
  );
}

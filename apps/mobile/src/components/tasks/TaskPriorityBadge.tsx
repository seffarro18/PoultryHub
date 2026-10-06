import { TASK_PRIORITY_LABEL, type TaskPriority } from "@poultryhub/shared/types/task";

const PRIORITY_STYLE: Record<TaskPriority, { color: string }> = {
  low: { color: "var(--color-muted)" },
  medium: { color: "var(--color-warning)" },
  high: { color: "var(--color-danger)" },
};

/** Same visual recipe as TaskStatusBadge — a small dot + label pill, no new pattern introduced. */
export default function TaskPriorityBadge({ priority }: { priority: TaskPriority }) {
  const { color } = PRIORITY_STYLE[priority];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ color, backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {TASK_PRIORITY_LABEL[priority]}
    </span>
  );
}

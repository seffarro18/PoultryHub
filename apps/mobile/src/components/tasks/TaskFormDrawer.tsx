import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { createTask, updateTask } from "@poultryhub/shared/services/taskService";
import Button from "@poultryhub/shared/components/ui/Button";
import { useToast } from "@poultryhub/shared/components/ui/ToastContext";
import { useEscapeKey } from "@poultryhub/shared/hooks/useEscapeKey";
import type { StaffMember } from "@poultryhub/shared/services/staffService";
import { TASK_PRIORITY_LABEL, type Task, type TaskInput, type TaskPriority } from "@poultryhub/shared/types/task";

interface TaskFormDrawerProps {
  /** null = create mode */
  task: Task | null;
  /** Active staff of the caller's farm — the single-assignee picker, no "All Staff" option (single assignee per task, see plan). */
  staff: StaffMember[];
  fixedFarmId: string;
  onClose: () => void;
  onSaved: () => void;
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

function toInputState(task: Task | null, fixedFarmId: string): TaskInput {
  if (task) {
    return {
      farmId: task.farmId,
      title: task.title,
      description: task.description,
      assignedToId: task.assignedToId,
      priority: task.priority,
      housePen: task.housePen,
      scheduledStart: task.scheduledStart,
      scheduledEnd: task.scheduledEnd,
    };
  }
  return {
    farmId: fixedFarmId,
    title: "",
    description: null,
    assignedToId: "",
    priority: "medium",
    housePen: null,
    scheduledStart: null,
    scheduledEnd: null,
  };
}

const PRIORITY_OPTIONS: TaskPriority[] = ["low", "medium", "high"];

export default function TaskFormDrawer({ task, staff, fixedFarmId, onClose, onSaved }: TaskFormDrawerProps) {
  const isEdit = task !== null;
  const [input, setInput] = useState<TaskInput>(() => toInputState(task, fixedFarmId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reducedMotion = useReducedMotion();
  const toast = useToast();

  useEscapeKey(onClose);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!input.assignedToId) {
      setError("Select a staff member to assign this to.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isEdit) {
        await updateTask(task.id, input);
      } else {
        await createTask(input);
      }
      toast.success(isEdit ? "Task updated." : "Task created.");
      onSaved();
    } catch (err) {
      console.error("[TaskFormDrawer] save failed:", err);
      setError("Couldn't save this task. Please try again.");
      toast.error("Couldn't save this task.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0.01 : 0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: reducedMotion ? 1 : 0.96, y: reducedMotion ? 0 : 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0.01 : 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <h2 className="font-display text-base font-semibold text-[var(--color-foreground)]">
            {isEdit ? "Edit Task" : "New Task"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)]"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex flex-col gap-4 px-5 py-4">
            {error && (
              <p className="rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">{error}</p>
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="task-title" className="text-sm font-medium text-[var(--color-foreground)]">
                Title
              </label>
              <input
                id="task-title"
                value={input.title}
                onChange={(e) => setInput((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="e.g. Clean House 3 water lines"
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="task-assignee" className="text-sm font-medium text-[var(--color-foreground)]">
                Assign to
              </label>
              <select
                id="task-assignee"
                value={input.assignedToId}
                onChange={(e) => setInput((prev) => ({ ...prev, assignedToId: e.target.value }))}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
              >
                <option value="">Select staff…</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="task-house-pen" className="text-sm font-medium text-[var(--color-foreground)]">
                  Poultry House/Pen
                </label>
                <input
                  id="task-house-pen"
                  value={input.housePen ?? ""}
                  onChange={(e) => setInput((prev) => ({ ...prev, housePen: e.target.value || null }))}
                  placeholder="e.g. House 1 (optional)"
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)]"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="task-priority" className="text-sm font-medium text-[var(--color-foreground)]">
                  Priority
                </label>
                <select
                  id="task-priority"
                  value={input.priority}
                  onChange={(e) => setInput((prev) => ({ ...prev, priority: e.target.value as TaskPriority }))}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
                >
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {TASK_PRIORITY_LABEL[p]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="task-start" className="text-sm font-medium text-[var(--color-foreground)]">
                  Start (optional)
                </label>
                <input
                  id="task-start"
                  type="datetime-local"
                  value={toDatetimeLocal(input.scheduledStart)}
                  onChange={(e) => setInput((prev) => ({ ...prev, scheduledStart: fromDatetimeLocal(e.target.value) }))}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="task-end" className="text-sm font-medium text-[var(--color-foreground)]">
                  Due (optional)
                </label>
                <input
                  id="task-end"
                  type="datetime-local"
                  value={toDatetimeLocal(input.scheduledEnd)}
                  onChange={(e) => setInput((prev) => ({ ...prev, scheduledEnd: fromDatetimeLocal(e.target.value) }))}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="task-description" className="text-sm font-medium text-[var(--color-foreground)]">
                Description
              </label>
              <textarea
                id="task-description"
                value={input.description ?? ""}
                onChange={(e) => setInput((prev) => ({ ...prev, description: e.target.value || null }))}
                rows={3}
                placeholder="Optional details or instructions"
                className="resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] px-5 py-4">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={saving} loadingText={isEdit ? "Saving…" : "Creating…"}>
              {isEdit ? "Save changes" : "Create task"}
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

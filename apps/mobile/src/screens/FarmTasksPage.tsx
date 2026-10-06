import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { ListChecks, Plus, Search, ShieldAlert, Trash2 } from "lucide-react";
import { deleteTask, listTasks } from "@poultryhub/shared/services/taskService";
import { listFarmStaff, type StaffMember } from "@poultryhub/shared/services/staffService";
import TaskFormDrawer from "../components/tasks/TaskFormDrawer";
import TaskStatusBadge from "../components/tasks/TaskStatusBadge";
import TaskPriorityBadge from "../components/tasks/TaskPriorityBadge";
import Button from "@poultryhub/shared/components/ui/Button";
import ConfirmDialog from "@poultryhub/shared/components/layout/ConfirmDialog";
import { SkeletonCard } from "@poultryhub/shared/components/ui/Skeleton";
import { StaggerGroup, StaggerItem } from "@poultryhub/shared/components/motion/Stagger";
import EmptyState from "@poultryhub/shared/components/ui/EmptyState";
import ErrorState from "@poultryhub/shared/components/ui/ErrorState";
import { useToast } from "@poultryhub/shared/components/ui/ToastContext";
import { isTaskOverdue, type Task, type TaskStatus } from "@poultryhub/shared/types/task";
import { useAuth } from "@poultryhub/shared/context/AuthContext";
import { getErrorMessage } from "@poultryhub/shared/lib/errorMessage";

type Tab = "all" | TaskStatus;
const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "in_progress", label: "In Progress" },
  { key: "blocked", label: "Blocked" },
  { key: "completed", label: "Completed" },
];

export default function FarmTasksPage() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [editingTask, setEditingTask] = useState<Task | null | "new">(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refresh = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setTasks(await listTasks());
    } catch (err) {
      setLoadError(getErrorMessage(err, "Couldn't load tasks."));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.farmId) void refresh();
    else setIsLoading(false);
  }, [user?.farmId]);

  useEffect(() => {
    if (!user?.farmId) return;
    listFarmStaff()
      .then((rows) => setStaff(rows.filter((s) => s.farmId === user.farmId && s.status === "active")))
      .catch((err) => console.error("[FarmTasksPage] failed to load staff:", err));
  }, [user?.farmId]);

  const counts = useMemo(
    () => ({
      all: tasks.length,
      pending: tasks.filter((t) => t.status === "pending").length,
      in_progress: tasks.filter((t) => t.status === "in_progress").length,
      blocked: tasks.filter((t) => t.status === "blocked").length,
      completed: tasks.filter((t) => t.status === "completed").length,
    }),
    [tasks]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (tab !== "all" && t.status !== tab) return false;
      if (term && !t.title.toLowerCase().includes(term) && !(t.assignedToName ?? "").toLowerCase().includes(term)) return false;
      return true;
    });
  }, [tasks, tab, search]);

  const handleConfirmDelete = async () => {
    const task = deletingTask;
    if (!task) return;
    setDeleting(true);
    try {
      await deleteTask(task.id);
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
      toast.success("Task deleted.");
      setDeletingTask(null);
    } catch (err) {
      console.error("[FarmTasksPage] delete failed:", err);
      toast.error("Couldn't delete that task.");
    } finally {
      setDeleting(false);
    }
  };

  if (!user?.farmId) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-6 py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-warning)]/10 text-[var(--color-warning)]">
          <ShieldAlert size={26} strokeWidth={1.75} />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold text-[var(--color-foreground)]">Not assigned to a farm yet</h2>
          <p className="mt-1.5 max-w-sm text-sm text-[var(--color-muted)]">
            Ask your Super Admin to assign your account to a farm before you can manage tasks.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold text-[var(--color-foreground)]">Tasks</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">Assign work to your staff and track progress.</p>
        </div>
        <Button variant="primary" icon={Plus} onClick={() => setEditingTask("new")}>
          New Task
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap rounded-lg border border-[var(--color-border)] p-0.5 text-xs font-medium">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                tab === t.key ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              }`}
            >
              {t.label} ({counts[t.key]})
            </button>
          ))}
        </div>

        <div className="relative sm:max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title or staff…"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] py-2 pl-9 pr-3 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)]"
          />
        </div>
      </div>

      <div>
        {isLoading ? (
          <div className="flex flex-col gap-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : loadError ? (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
            <ErrorState message={loadError} onRetry={refresh} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
            <EmptyState
              icon={ListChecks}
              title="No tasks match those filters"
              description="Try a different tab or search term."
              action={tab === "all" && !search ? { label: "New Task", onClick: () => setEditingTask("new") } : undefined}
            />
          </div>
        ) : (
          <StaggerGroup className="flex flex-col gap-3">
            {filtered.map((task) => {
              const overdue = isTaskOverdue(task);
              return (
                <StaggerItem
                  key={task.id}
                  className="cursor-pointer rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4"
                  onClick={() => navigate(`/farm/tasks/${task.id}`)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--color-foreground)]">{task.title}</p>
                      <p className="text-xs text-[var(--color-muted)]">
                        {task.housePen ? `${task.housePen} · ` : ""}
                        {task.assignedToName ?? "Unassigned"}
                        {task.scheduledEnd ? ` · Due ${new Date(task.scheduledEnd).toLocaleString()}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <TaskStatusBadge status={task.status} overdue={overdue} />
                      <TaskPriorityBadge priority={task.priority} />
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-end border-t border-[var(--color-border)] pt-3">
                    <Button
                      variant="destructive"
                      size="sm"
                      icon={Trash2}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingTask(task);
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </StaggerItem>
              );
            })}
          </StaggerGroup>
        )}
      </div>

      <AnimatePresence>
        {editingTask !== null && (
          <TaskFormDrawer
            task={editingTask === "new" ? null : editingTask}
            staff={staff}
            fixedFarmId={user.farmId}
            onClose={() => setEditingTask(null)}
            onSaved={() => {
              setEditingTask(null);
              void refresh();
            }}
          />
        )}
      </AnimatePresence>

      {deletingTask && (
        <ConfirmDialog
          title="Delete this task?"
          message={`"${deletingTask.title}" and its comment thread will be permanently removed.`}
          confirmLabel={deleting ? "Deleting…" : "Delete"}
          danger
          onCancel={() => setDeletingTask(null)}
          onConfirm={() => void handleConfirmDelete()}
        />
      )}
    </div>
  );
}

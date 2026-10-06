import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ListChecks, ShieldAlert } from "lucide-react";
import { listTasks } from "@poultryhub/shared/services/taskService";
import TaskStatusBadge from "../components/tasks/TaskStatusBadge";
import TaskPriorityBadge from "../components/tasks/TaskPriorityBadge";
import { SkeletonCard } from "@poultryhub/shared/components/ui/Skeleton";
import { StaggerGroup, StaggerItem } from "@poultryhub/shared/components/motion/Stagger";
import EmptyState from "@poultryhub/shared/components/ui/EmptyState";
import ErrorState from "@poultryhub/shared/components/ui/ErrorState";
import { isTaskOverdue, type Task, type TaskStatus } from "@poultryhub/shared/types/task";
import { useAuth } from "@poultryhub/shared/context/AuthContext";
import { getErrorMessage } from "@poultryhub/shared/lib/errorMessage";

const GROUP_ORDER: TaskStatus[] = ["blocked", "in_progress", "pending", "completed"];
const GROUP_LABEL: Record<TaskStatus, string> = {
  blocked: "Blocked",
  in_progress: "In Progress",
  pending: "Pending",
  completed: "Completed",
};

export default function StaffTasksPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      // RLS scopes this to the signed-in Staff member's own assigned tasks.
      setTasks(await listTasks());
    } catch (err) {
      setLoadError(getErrorMessage(err, "Couldn't load your tasks."));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.farmId) void refresh();
    else setIsLoading(false);
  }, [user?.farmId]);

  const grouped = useMemo(() => {
    const groups = new Map<TaskStatus, Task[]>();
    for (const status of GROUP_ORDER) groups.set(status, []);
    for (const task of tasks) groups.get(task.status)?.push(task);
    return groups;
  }, [tasks]);

  if (!user?.farmId) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-6 py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-warning)]/10 text-[var(--color-warning)]">
          <ShieldAlert size={26} strokeWidth={1.75} />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold text-[var(--color-foreground)]">Not assigned to a farm yet</h2>
          <p className="mt-1.5 max-w-sm text-sm text-[var(--color-muted)]">
            Ask your Super Admin to assign your account to a farm before you can see your tasks.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-xl font-semibold text-[var(--color-foreground)]">My Tasks</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">Work assigned to you by your Farm Admin or Manager.</p>
      </div>

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
      ) : tasks.length === 0 ? (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
          <EmptyState icon={ListChecks} title="No tasks assigned yet" description="Anything assigned to you will show up here." />
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {GROUP_ORDER.filter((status) => (grouped.get(status)?.length ?? 0) > 0).map((status) => (
            <div key={status}>
              <h2 className="font-display text-sm font-semibold text-[var(--color-foreground)]">{GROUP_LABEL[status]}</h2>
              <StaggerGroup className="mt-2 flex flex-col gap-3">
                {grouped.get(status)?.map((task) => {
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
                            {task.housePen ?? ""}
                            {task.housePen && task.scheduledEnd ? " · " : ""}
                            {task.scheduledEnd ? `Due ${new Date(task.scheduledEnd).toLocaleString()}` : ""}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <TaskStatusBadge status={task.status} overdue={overdue} />
                          <TaskPriorityBadge priority={task.priority} />
                        </div>
                      </div>
                      {task.description && <p className="mt-2 text-xs text-[var(--color-muted)] line-clamp-2">{task.description}</p>}
                    </StaggerItem>
                  );
                })}
              </StaggerGroup>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

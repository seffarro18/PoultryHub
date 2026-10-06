import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { Pencil } from "lucide-react";
import {
  addTaskComment,
  completeTask,
  getTask,
  listTaskComments,
  reportTaskProblem,
  startTask,
} from "@poultryhub/shared/services/taskService";
import { listFarmStaff, type StaffMember } from "@poultryhub/shared/services/staffService";
import { supabase } from "@poultryhub/shared/services/supabaseClient";
import PageBackButton from "../components/PageBackButton";
import TaskStatusBadge from "../components/tasks/TaskStatusBadge";
import TaskPriorityBadge from "../components/tasks/TaskPriorityBadge";
import TaskCommentThread from "../components/tasks/TaskCommentThread";
import TaskCommentComposer from "../components/tasks/TaskCommentComposer";
import TaskFormDrawer from "../components/tasks/TaskFormDrawer";
import CompleteTaskDialog from "../components/tasks/CompleteTaskDialog";
import ReportProblemDialog from "../components/tasks/ReportProblemDialog";
import Button from "@poultryhub/shared/components/ui/Button";
import { SkeletonCard } from "@poultryhub/shared/components/ui/Skeleton";
import ErrorState from "@poultryhub/shared/components/ui/ErrorState";
import { useToast } from "@poultryhub/shared/components/ui/ToastContext";
import { useAuth } from "@poultryhub/shared/context/AuthContext";
import { isTaskOverdue, type Task, type TaskComment, type TaskProblemCategory } from "@poultryhub/shared/types/task";
import { getErrorMessage } from "@poultryhub/shared/lib/errorMessage";

export default function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const { user } = useAuth();
  const toast = useToast();

  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [editing, setEditing] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [reportingProblem, setReportingProblem] = useState(false);

  const isFarmManager = user?.role === "Farm Admin" || user?.role === "Manager";

  const refresh = useCallback(async () => {
    if (!taskId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const [taskRow, commentRows] = await Promise.all([getTask(taskId), listTaskComments(taskId)]);
      if (!taskRow) {
        setLoadError("This task no longer exists, or you don't have access to it.");
        setTask(null);
      } else {
        setTask(taskRow);
        setComments(commentRows);
      }
    } catch (err) {
      setLoadError(getErrorMessage(err, "Couldn't load this task."));
    } finally {
      setIsLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!isFarmManager || !user?.farmId) return;
    listFarmStaff()
      .then((rows) => setStaff(rows.filter((s) => s.farmId === user.farmId && s.status === "active")))
      .catch((err) => console.error("[TaskDetailPage] failed to load staff:", err));
  }, [isFarmManager, user?.farmId]);

  // Live thread + live status — Realtime is enabled on both tables specifically
  // for this page (see 0011_tasks.sql); each subscriber is authorized by the
  // existing RLS SELECT policies, same technique as NotificationCountProvider.
  useEffect(() => {
    if (!taskId) return;
    let channel: RealtimeChannel | null = supabase
      .channel(`task:${taskId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "task_comments", filter: `task_id=eq.${taskId}` },
        () => {
          void listTaskComments(taskId)
            .then(setComments)
            .catch((err) => console.error("[TaskDetailPage] comment refresh failed:", err));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tasks", filter: `id=eq.${taskId}` },
        () => {
          void getTask(taskId)
            .then((row) => row && setTask(row))
            .catch((err) => console.error("[TaskDetailPage] task refresh failed:", err));
        }
      )
      .subscribe();

    return () => {
      if (channel) {
        void supabase.removeChannel(channel);
        channel = null;
      }
    };
  }, [taskId]);

  const handleStart = async () => {
    if (!task) return;
    setBusy(true);
    try {
      await startTask(task.id);
      await refresh();
      toast.success("Task started.");
    } catch (err) {
      console.error("[TaskDetailPage] start failed:", err);
      toast.error("Couldn't start this task.");
    } finally {
      setBusy(false);
    }
  };

  const handleComplete = async (comment: string) => {
    if (!task) return;
    setBusy(true);
    try {
      await completeTask(task.id, comment || undefined);
      await refresh();
      toast.success("Task marked complete.");
      setCompleting(false);
    } catch (err) {
      console.error("[TaskDetailPage] complete failed:", err);
      toast.error("Couldn't complete this task.");
    } finally {
      setBusy(false);
    }
  };

  const handleReportProblem = async (category: TaskProblemCategory, comment: string) => {
    if (!task) return;
    setBusy(true);
    try {
      await reportTaskProblem(task.id, category, comment);
      await refresh();
      toast.success("Problem reported.");
      setReportingProblem(false);
    } catch (err) {
      console.error("[TaskDetailPage] report problem failed:", err);
      toast.error("Couldn't report this problem.");
    } finally {
      setBusy(false);
    }
  };

  const handleSendComment = async (comment: string) => {
    if (!task) return;
    try {
      await addTaskComment(task.id, comment);
      setComments(await listTaskComments(task.id));
    } catch (err) {
      console.error("[TaskDetailPage] send comment failed:", err);
      toast.error("Couldn't send that comment.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (loadError || !task) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
        <ErrorState message={loadError ?? "This task no longer exists, or you don't have access to it."} onRetry={refresh} />
      </div>
    );
  }

  const overdue = isTaskOverdue(task);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <PageBackButton />
        <h1 className="flex-1 font-display text-xl font-semibold text-[var(--color-foreground)]">{task.title}</h1>
        {isFarmManager && (
          <Button variant="secondary" size="sm" icon={Pencil} onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <TaskStatusBadge status={task.status} overdue={overdue} />
            <TaskPriorityBadge priority={task.priority} />
          </div>
          {task.completedAt && (
            <span className="text-xs text-[var(--color-muted)]">Completed {new Date(task.completedAt).toLocaleString()}</span>
          )}
        </div>

        {task.description && <p className="mt-3 text-sm text-[var(--color-foreground)]">{task.description}</p>}

        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--color-border)] pt-3 text-xs">
          <div>
            <p className="uppercase tracking-wide text-[var(--color-muted)]">Assigned to</p>
            <p className="mt-0.5 font-medium text-[var(--color-foreground)]">{task.assignedToName ?? "—"}</p>
          </div>
          <div>
            <p className="uppercase tracking-wide text-[var(--color-muted)]">Assigned by</p>
            <p className="mt-0.5 font-medium text-[var(--color-foreground)]">{task.createdByName ?? "—"}</p>
          </div>
          {task.housePen && (
            <div>
              <p className="uppercase tracking-wide text-[var(--color-muted)]">Poultry House/Pen</p>
              <p className="mt-0.5 font-medium text-[var(--color-foreground)]">{task.housePen}</p>
            </div>
          )}
          {task.scheduledStart && (
            <div>
              <p className="uppercase tracking-wide text-[var(--color-muted)]">Start</p>
              <p className="mt-0.5 font-medium text-[var(--color-foreground)]">{new Date(task.scheduledStart).toLocaleString()}</p>
            </div>
          )}
          {task.scheduledEnd && (
            <div>
              <p className="uppercase tracking-wide text-[var(--color-muted)]">Due</p>
              <p className="mt-0.5 font-medium text-[var(--color-foreground)]">{new Date(task.scheduledEnd).toLocaleString()}</p>
            </div>
          )}
        </div>

        {!isFarmManager && (task.status === "pending" || task.status === "blocked" || task.status === "in_progress") && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--color-border)] pt-3">
            {(task.status === "pending" || task.status === "blocked") && (
              <Button variant="primary" size="sm" loading={busy} loadingText="Starting…" onClick={() => void handleStart()}>
                Start Task
              </Button>
            )}
            {task.status === "in_progress" && (
              <>
                <Button variant="destructive" size="sm" onClick={() => setReportingProblem(true)}>
                  Report Problem
                </Button>
                <Button variant="success" size="sm" onClick={() => setCompleting(true)}>
                  Mark Complete
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
        <h2 className="font-display text-sm font-semibold text-[var(--color-foreground)]">Comments</h2>
        <div className="mt-3">
          <TaskCommentThread comments={comments} />
        </div>
        <div className="mt-3">
          <TaskCommentComposer onSend={handleSendComment} />
        </div>
      </div>

      <AnimatePresence>
        {editing && (
          <TaskFormDrawer
            task={task}
            staff={staff}
            fixedFarmId={task.farmId}
            onClose={() => setEditing(false)}
            onSaved={() => {
              setEditing(false);
              void refresh();
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {completing && (
          <CompleteTaskDialog confirming={busy} onCancel={() => setCompleting(false)} onConfirm={(comment) => void handleComplete(comment)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {reportingProblem && (
          <ReportProblemDialog
            confirming={busy}
            onCancel={() => setReportingProblem(false)}
            onConfirm={(category, comment) => void handleReportProblem(category, comment)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

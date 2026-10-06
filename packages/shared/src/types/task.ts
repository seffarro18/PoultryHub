export type TaskStatus = "pending" | "in_progress" | "completed" | "blocked";
export type TaskPriority = "low" | "medium" | "high";
export type TaskCommentType = "progress" | "problem" | "completion";
export type TaskProblemCategory = "missing_supplies" | "equipment_problem" | "schedule_conflict" | "cannot_complete" | "other";

export interface Task {
  id: string;
  farmId: string;
  title: string;
  description: string | null;
  assignedToId: string;
  assignedToName: string | null;
  createdById: string | null;
  createdByName: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  housePen: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskInput {
  farmId: string;
  title: string;
  description: string | null;
  assignedToId: string;
  priority: TaskPriority;
  housePen: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
}

export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string | null;
  userName: string | null;
  userRole: string | null;
  comment: string;
  commentType: TaskCommentType;
  problemCategory: TaskProblemCategory | null;
  createdAt: string;
}

export const TASK_PROBLEM_CATEGORY_LABEL: Record<TaskProblemCategory, string> = {
  missing_supplies: "Missing supplies",
  equipment_problem: "Equipment problem",
  schedule_conflict: "Schedule conflict",
  cannot_complete: "Task cannot be completed",
  other: "Other",
};

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  blocked: "Blocked",
};

/** Computed, never stored — a task reads as overdue once its scheduled end has passed and it isn't done yet. */
export function isTaskOverdue(task: Pick<Task, "scheduledEnd" | "status">, now: Date = new Date()): boolean {
  if (!task.scheduledEnd || task.status === "completed") return false;
  return new Date(task.scheduledEnd) < now;
}

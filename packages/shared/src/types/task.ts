export type TaskStatus = "pending" | "in_progress" | "completed" | "blocked";
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
  /** The house/pen this task is for (poultry_houses, migration 0047) — null for a farm-wide task or a legacy free-text one. */
  houseId: string | null;
  /** Display name: the house's current name, or a legacy task's original free text. */
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
  /** null = farm-wide / not tied to a house. The database fills house_pen from this and checks it belongs to the farm. */
  houseId: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
}

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

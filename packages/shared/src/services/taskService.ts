import { supabase } from "./supabaseClient";
import type { Task, TaskComment, TaskCommentType, TaskInput, TaskProblemCategory } from "../types/task";

interface TaskRow {
  id: string;
  farm_id: string;
  title: string;
  description: string | null;
  assigned_to: string;
  created_by: string | null;
  status: Task["status"];
  priority: Task["priority"];
  house_pen: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  assigned_to_profile: { name: string } | null;
  created_by_profile: { name: string } | null;
}

function mapTask(row: TaskRow): Task {
  return {
    id: row.id,
    farmId: row.farm_id,
    title: row.title,
    description: row.description,
    assignedToId: row.assigned_to,
    assignedToName: row.assigned_to_profile?.name ?? null,
    createdById: row.created_by,
    createdByName: row.created_by_profile?.name ?? null,
    status: row.status,
    priority: row.priority,
    housePen: row.house_pen,
    scheduledStart: row.scheduled_start,
    scheduledEnd: row.scheduled_end,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const TASK_SELECT = `
  id, farm_id, title, description, assigned_to, created_by,
  status, priority, house_pen, scheduled_start, scheduled_end, completed_at, created_at, updated_at,
  assigned_to_profile:profiles!assigned_to ( name ),
  created_by_profile:profiles!created_by ( name )
`;

/** RLS scopes this automatically — Farm Admin/Manager get their farm's tasks, Staff get only their own assigned ones. */
export async function listTasks(): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .order("scheduled_end", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as TaskRow[]).map(mapTask);
}

export async function getTask(id: string): Promise<Task | null> {
  const { data, error } = await supabase.from("tasks").select(TASK_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapTask(data as unknown as TaskRow) : null;
}

/** Farm Admin/Manager only — RLS's own INSERT policy independently verifies assignedToId is an active Staff member of the same farm. */
export async function createTask(input: TaskInput): Promise<void> {
  const { error } = await supabase.from("tasks").insert({
    farm_id: input.farmId,
    title: input.title,
    description: input.description,
    assigned_to: input.assignedToId,
    priority: input.priority,
    house_pen: input.housePen,
    scheduled_start: input.scheduledStart,
    scheduled_end: input.scheduledEnd,
  });
  if (error) throw error;
}

export async function updateTask(id: string, input: TaskInput): Promise<void> {
  const { error } = await supabase
    .from("tasks")
    .update({
      title: input.title,
      description: input.description,
      assigned_to: input.assignedToId,
      priority: input.priority,
      house_pen: input.housePen,
      scheduled_start: input.scheduledStart,
      scheduled_end: input.scheduledEnd,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw error;
}

/** Staff: pending/blocked -> in_progress. */
export async function startTask(id: string): Promise<void> {
  const { error } = await supabase.from("tasks").update({ status: "in_progress" }).eq("id", id);
  if (error) throw error;
}

/**
 * Staff: in_progress -> completed. The optional comment is saved first so a
 * failure partway through never leaves a task marked complete with its
 * explanation silently lost — if this throws, the status update below never
 * runs, and the whole action is safe to retry from the top.
 */
export async function completeTask(id: string, comment?: string): Promise<void> {
  if (comment?.trim()) {
    await addTaskComment(id, comment.trim(), "completion");
  }
  const { error } = await supabase.from("tasks").update({ status: "completed" }).eq("id", id);
  if (error) throw error;
}

/** Staff: in_progress -> blocked, with a required problem report. */
export async function reportTaskProblem(id: string, category: TaskProblemCategory, comment: string): Promise<void> {
  const { error: commentError } = await supabase
    .from("task_comments")
    .insert({ task_id: id, comment, comment_type: "problem", problem_category: category });
  if (commentError) throw commentError;

  const { error } = await supabase.from("tasks").update({ status: "blocked" }).eq("id", id);
  if (error) throw error;
}

interface TaskCommentRow {
  id: string;
  task_id: string;
  user_id: string | null;
  comment: string;
  comment_type: TaskCommentType;
  problem_category: TaskProblemCategory | null;
  created_at: string;
  profiles: { name: string; role: string } | null;
}

function mapComment(row: TaskCommentRow): TaskComment {
  return {
    id: row.id,
    taskId: row.task_id,
    userId: row.user_id,
    userName: row.profiles?.name ?? null,
    userRole: row.profiles?.role ?? null,
    comment: row.comment,
    commentType: row.comment_type,
    problemCategory: row.problem_category,
    createdAt: row.created_at,
  };
}

export async function listTaskComments(taskId: string): Promise<TaskComment[]> {
  const { data, error } = await supabase
    .from("task_comments")
    .select("id, task_id, user_id, comment, comment_type, problem_category, created_at, profiles ( name, role )")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as TaskCommentRow[]).map(mapComment);
}

/** Plain reply — used by both roles for ordinary back-and-forth. */
export async function addTaskComment(taskId: string, comment: string, commentType: TaskCommentType = "progress"): Promise<void> {
  const { error } = await supabase.from("task_comments").insert({ task_id: taskId, comment, comment_type: commentType });
  if (error) throw error;
}

import { supabase } from "./supabaseClient";
import type {
  AppNotification,
  NotificationCategory,
  NotificationSeverity,
  NotificationStatus,
  SendNotificationInput,
} from "../types/notification";

interface NotificationRow {
  id: string;
  farm_id: string | null;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  message: string;
  link: string | null;
  status: NotificationStatus;
  created_at: string;
  read_at: string | null;
  archived_at: string | null;
  farms: { name: string } | null;
  created_by_profile: { name: string } | null;
}

function mapRow(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    farmId: row.farm_id,
    farmName: row.farms?.name ?? null,
    category: row.category,
    severity: row.severity,
    title: row.title,
    message: row.message,
    link: row.link,
    status: row.status,
    createdByName: row.created_by_profile?.name ?? null,
    createdAt: row.created_at,
    readAt: row.read_at,
    archivedAt: row.archived_at,
  };
}

const NOTIFICATION_SELECT = `
  id, farm_id, category, severity, title, message, link, status, created_at, read_at, archived_at,
  farms ( name ),
  created_by_profile:profiles!created_by ( name )
`;

export async function listNotifications(): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select(NOTIFICATION_SELECT)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as NotificationRow[]).map(mapRow);
}

export async function getUnreadCount(): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("status", "unread");
  if (error) throw error;
  return count ?? 0;
}

export async function markAsRead(id: string): Promise<void> {
  const { error } = await supabase.from("notifications").update({ status: "read" }).eq("id", id);
  if (error) throw error;
}

export async function markAllAsRead(): Promise<void> {
  const { error } = await supabase.from("notifications").update({ status: "read" }).eq("status", "unread");
  if (error) throw error;
}

export async function archiveNotification(id: string): Promise<void> {
  const { error } = await supabase.from("notifications").update({ status: "archived" }).eq("id", id);
  if (error) throw error;
}

export async function deleteNotification(id: string): Promise<void> {
  const { error } = await supabase.from("notifications").delete().eq("id", id);
  if (error) throw error;
}

/** Farm Admin/Manager manually notifying one or more staff on their own farm. */
export async function sendNotificationToStaff(input: SendNotificationInput): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const rows = input.recipientIds.map((recipientId) => ({
    recipient_id: recipientId,
    farm_id: input.farmId,
    category: input.category,
    title: input.title,
    message: input.message,
    created_by: auth.user?.id ?? null,
  }));
  const { error } = await supabase.from("notifications").insert(rows);
  if (error) throw error;
}

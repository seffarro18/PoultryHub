import {
  AlertTriangle,
  Archive,
  Bell,
  ClipboardCheck,
  DatabaseBackup,
  Egg,
  HeartPulse,
  LogIn,
  Pill,
  ShieldAlert,
  Stethoscope,
  Syringe,
  TrendingDown,
  UserPlus,
  Users,
  Wheat,
  type LucideIcon,
} from "lucide-react";

export type NotificationCategory =
  | "low_feed_stock"
  | "low_vitamin_stock"
  | "low_inventory"
  | "mortality_alert"
  | "new_user_registration"
  | "system_update"
  | "security_alert"
  | "backup_completion"
  | "failed_login_attempt"
  | "expiring_medicine"
  | "low_egg_production"
  | "new_staff_account"
  | "feed_schedule_reminder"
  | "vaccination_reminder"
  | "production_reminder"
  | "task_assignment"
  | "disease_outbreak"
  | "mortality_threshold_exceeded"
  | "health_case_submitted"
  | "mortality_case_submitted";

export type NotificationSeverity = "info" | "warning" | "critical";
export type NotificationStatus = "unread" | "read" | "archived";

export interface AppNotification {
  id: string;
  farmId: string | null;
  farmName: string | null;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  message: string;
  link: string | null;
  status: NotificationStatus;
  createdByName: string | null;
  createdAt: string;
  readAt: string | null;
  archivedAt: string | null;
}

export interface SendNotificationInput {
  farmId: string;
  recipientIds: string[];
  category: NotificationCategory;
  title: string;
  message: string;
}

export const NOTIFICATION_CATEGORY_META: Record<NotificationCategory, { label: string; icon: LucideIcon }> = {
  low_feed_stock: { label: "Low Feed Stock", icon: Wheat },
  low_vitamin_stock: { label: "Low Vitamin Stock", icon: Syringe },
  low_inventory: { label: "Low Inventory", icon: Archive },
  mortality_alert: { label: "Mortality Alert", icon: AlertTriangle },
  new_user_registration: { label: "New User Registration", icon: UserPlus },
  system_update: { label: "System Update", icon: Bell },
  security_alert: { label: "Security Alert", icon: ShieldAlert },
  backup_completion: { label: "Backup Completion", icon: DatabaseBackup },
  failed_login_attempt: { label: "Failed Login Attempt", icon: LogIn },
  expiring_medicine: { label: "Expiring Medicine", icon: Pill },
  low_egg_production: { label: "Low Egg Production", icon: Egg },
  new_staff_account: { label: "New Staff Account", icon: Users },
  feed_schedule_reminder: { label: "Feed Schedule Reminder", icon: Wheat },
  vaccination_reminder: { label: "Vaccination Reminder", icon: Stethoscope },
  production_reminder: { label: "Production Reminder", icon: Egg },
  task_assignment: { label: "Task Assignment", icon: ClipboardCheck },
  disease_outbreak: { label: "Disease Outbreak", icon: HeartPulse },
  mortality_threshold_exceeded: { label: "Mortality Threshold Exceeded", icon: TrendingDown },
  health_case_submitted: { label: "Health Case Submitted", icon: ClipboardCheck },
  mortality_case_submitted: { label: "Mortality Case Submitted", icon: ClipboardCheck },
};

/** Categories shown in the Super Admin Notification Center's filter chips. */
export const SUPER_ADMIN_CATEGORIES: NotificationCategory[] = [
  "low_feed_stock",
  "low_vitamin_stock",
  "low_inventory",
  "mortality_alert",
  "new_user_registration",
  "system_update",
  "security_alert",
  "backup_completion",
  "failed_login_attempt",
  "disease_outbreak",
  "mortality_threshold_exceeded",
];

/** Categories shown in the Farm Admin/Manager Notification Center's filter chips. */
export const FARM_ADMIN_CATEGORIES: NotificationCategory[] = [
  "low_feed_stock",
  "low_vitamin_stock",
  "expiring_medicine",
  "mortality_alert",
  "low_egg_production",
  "new_staff_account",
  "backup_completion",
  "disease_outbreak",
  "mortality_threshold_exceeded",
  "health_case_submitted",
  "mortality_case_submitted",
];

/** Categories a Farm Admin/Manager can pick when manually sending a notification to staff. */
export const STAFF_SENDABLE_CATEGORIES: NotificationCategory[] = [
  "task_assignment",
  "feed_schedule_reminder",
  "vaccination_reminder",
  "production_reminder",
];

import { Bell, ClipboardCheck, Egg, HeartPulse, TrendingDown, Wheat, type LucideIcon } from "lucide-react";
import type { UserRole } from "./auth";
import type { FarmStatus } from "./farm";

export interface UserSession {
  id: string;
  deviceId: string;
  device: string;
  browser: string;
  operatingSystem: string;
  lastActivity: string;
  createdAt: string;
  isCurrent: boolean;
}

export type ThemePreference = "light" | "dark" | "system";

/** App-level notification groups a user can opt in/out of — coarser than the ~20 raw NotificationCategory values in types/notification.ts. */
export type NotificationPreferenceGroup = "production" | "inventory" | "health" | "mortality" | "approval" | "system";

export const NOTIFICATION_GROUP_META: Record<NotificationPreferenceGroup, { label: string; icon: LucideIcon }> = {
  production: { label: "Production Updates", icon: Egg },
  inventory: { label: "Inventory Alerts", icon: Wheat },
  health: { label: "Health Alerts", icon: HeartPulse },
  mortality: { label: "Mortality Alerts", icon: TrendingDown },
  approval: { label: "Approval Updates", icon: ClipboardCheck },
  system: { label: "System Notifications", icon: Bell },
};

/** Staff never receive new-account-approval notifications, so "Approval Updates" isn't shown to them. */
export function notificationGroupsForRole(role: UserRole): NotificationPreferenceGroup[] {
  const all: NotificationPreferenceGroup[] = ["production", "inventory", "health", "mortality", "approval", "system"];
  return role === "Staff" ? all.filter((g) => g !== "approval") : all;
}

export interface MyFarmSummary {
  id: string;
  name: string;
  farmCode: string | null;
  address: string | null;
  region: string | null;
  province: string | null;
  city: string | null;
  status: FarmStatus;
  latitude: number | null;
  longitude: number | null;
}

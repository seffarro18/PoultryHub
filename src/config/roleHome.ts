import type { User, UserRole } from "../types/auth";
import { DASHBOARD_PATH } from "./navigation";
import { FARM_DASHBOARD_PATH } from "./farmNavigation";

export const PENDING_PATH = "/pending";

/** The single place that decides which portal a role lands on after login. */
export function getHomePathForRole(role: UserRole): string {
  return role === "Super Admin" ? DASHBOARD_PATH : FARM_DASHBOARD_PATH;
}

/** Same as `getHomePathForRole`, but a non-active account always lands on the pending screen first. */
export function getHomePathForUser(user: User): string {
  return user.status === "active" ? getHomePathForRole(user.role) : PENDING_PATH;
}

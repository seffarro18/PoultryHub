import type { User, UserRole } from "@poultryhub/shared/types/auth";
import { PENDING_PATH } from "@poultryhub/shared/constants/paths";
import { FARM_DASHBOARD_PATH } from "./farmNavigation";

/** A signed-in role this app has no home for (e.g. a Super Admin account — that portal is the desktop app). */
export const NO_ACCESS_PATH = "/no-access";

export function getHomePathForRole(role: UserRole): string {
  return role === "Farm Admin" || role === "Manager" || role === "Staff" ? FARM_DASHBOARD_PATH : NO_ACCESS_PATH;
}

/** Same as `getHomePathForRole`, but a non-active account always lands on the pending screen first. */
export function getHomePathForUser(user: User): string {
  return user.status === "active" ? getHomePathForRole(user.role) : PENDING_PATH;
}

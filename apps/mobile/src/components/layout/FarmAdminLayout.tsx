import DashboardLayout from "@poultryhub/shared/components/layout/DashboardLayout";
import { LocalNotifications } from "@capacitor/local-notifications";
import {
  getFarmNavigation,
  getFarmBottomNav,
  getOperationsHubItems,
  FARM_DASHBOARD_PATH,
  FARM_ACCOUNT_PATH,
  FARM_NOTIFICATIONS_PATH,
} from "../../config/farmNavigation";
import { useAuth } from "@poultryhub/shared/context/AuthContext";
import { getNotificationStatus } from "../../lib/permissions";

const NEW_ALERT_NOTIFICATION_ID = 1002;

/** Fires a local notification for newly-arrived in-app alerts while the app is open. Only ever checks status, never requests it — that only happens from the Reminders toggle in AccountNotificationsPage. */
async function handleNewNotifications(newCount: number, previousCount: number) {
  const status = await getNotificationStatus();
  if (status !== "granted") return;
  const delta = newCount - previousCount;
  await LocalNotifications.schedule({
    notifications: [
      {
        id: NEW_ALERT_NOTIFICATION_ID,
        title: "PoultryHub",
        body: delta === 1 ? "You have a new notification." : `You have ${delta} new notifications.`,
      },
    ],
  });
}

export default function FarmAdminLayout() {
  const { user } = useAuth();
  const role = user?.role ?? "Farm Admin";

  return (
    <DashboardLayout
      navigation={getFarmNavigation(role)}
      bottomNavItems={getFarmBottomNav(role)}
      // The Operations hub's sub-pages (Staff Management, Egg Production,
      // Poultry Inventory, Health Records, Audit Logs, Farm Profile) render
      // their own back button inline instead of the topbar's automatic one.
      // Staff has no "Operations" concept at all (getOperationsHubItems
      // falls back to Farm Admin's list for any non-Manager role, so this
      // must be guarded explicitly — otherwise it would wrongly suppress
      // the topbar's back button on Staff's own drill-down pages, e.g.
      // /farm/health reached via their Production hub, which never got a
      // page-level button since it's a different page component entirely).
      pageOwnsBackButtonPaths={role === "Staff" ? [] : getOperationsHubItems(role).map((item) => item.path)}
      homePath={FARM_DASHBOARD_PATH}
      accountPath={FARM_ACCOUNT_PATH}
      accountLabel="My Account"
      portalLabel="Farm Admin"
      notificationsPath={FARM_NOTIFICATIONS_PATH}
      onNewNotifications={(newCount, previousCount) => void handleNewNotifications(newCount, previousCount)}
    />
  );
}

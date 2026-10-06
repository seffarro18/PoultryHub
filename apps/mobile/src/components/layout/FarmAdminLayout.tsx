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

/** Local Android notification ids cycle through a small fixed pool so back-to-back alerts each get their own tray entry instead of overwriting one shared id. */
const NEW_ALERT_NOTIFICATION_ID_BASE = 1100;
const NEW_ALERT_NOTIFICATION_ID_POOL = 20;
let nextAlertNotificationSlot = 0;

/** Fires a local notification for a newly-arrived in-app alert, with its real title/message, while the app is open. Called once per Realtime-delivered row (see NotificationCountContext) — never from a bare count delta, so it's never guessing at content. Only ever checks status, never requests it — that only happens from the Reminders toggle in AccountNotificationsPage. */
async function handleNewNotification(notification: { id: string; title: string; message: string }) {
  const status = await getNotificationStatus();
  if (status !== "granted") return;
  const id = NEW_ALERT_NOTIFICATION_ID_BASE + (nextAlertNotificationSlot % NEW_ALERT_NOTIFICATION_ID_POOL);
  nextAlertNotificationSlot += 1;
  await LocalNotifications.schedule({
    notifications: [{ id, title: notification.title, body: notification.message }],
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
      // Poultry Inventory, Sales & Expenses, Audit Logs, Farm Profile) render
      // their own back button inline instead of the topbar's automatic one.
      // Staff has no "Operations" concept at all (getOperationsHubItems
      // falls back to Farm Admin's list for any non-Manager role, so this
      // must be guarded explicitly — otherwise it would wrongly suppress
      // the topbar's back button on Staff's own drill-down pages, e.g. their
      // own Poultry Inventory page, which never got a page-level button
      // since Staff reaches it via the bottom nav's Inventory tab instead).
      pageOwnsBackButtonPaths={role === "Staff" ? [] : getOperationsHubItems(role).map((item) => item.path)}
      homePath={FARM_DASHBOARD_PATH}
      accountPath={FARM_ACCOUNT_PATH}
      accountLabel="My Account"
      portalLabel="Farm Admin"
      notificationsPath={FARM_NOTIFICATIONS_PATH}
      onNewNotifications={(notification) => void handleNewNotification(notification)}
    />
  );
}

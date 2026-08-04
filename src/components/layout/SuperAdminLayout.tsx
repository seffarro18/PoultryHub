import DashboardLayout from "./DashboardLayout";
import { navigation, DASHBOARD_PATH, PROFILE_PATH } from "../../config/navigation";
import { getDashboardOverview } from "../../services/dashboardService";

export default function SuperAdminLayout() {
  return (
    <DashboardLayout
      navigation={navigation}
      homePath={DASHBOARD_PATH}
      accountPath={PROFILE_PATH}
      accountLabel="Profile"
      notificationCount={getDashboardOverview().activeNotifications}
    />
  );
}

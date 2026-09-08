import DashboardLayout from "@poultryhub/shared/components/layout/DashboardLayout";
import { navigation, DASHBOARD_PATH, PROFILE_PATH, NOTIFICATIONS_PATH } from "../../config/navigation";

export default function SuperAdminLayout() {
  return (
    <DashboardLayout
      navigation={navigation}
      homePath={DASHBOARD_PATH}
      accountPath={PROFILE_PATH}
      accountLabel="Profile"
      notificationsPath={NOTIFICATIONS_PATH}
    />
  );
}

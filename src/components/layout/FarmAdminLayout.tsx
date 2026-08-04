import DashboardLayout from "./DashboardLayout";
import { getFarmNavigation, getFarmBottomNav, FARM_DASHBOARD_PATH, FARM_ACCOUNT_PATH } from "../../config/farmNavigation";
import { getFarmOverview } from "../../services/farmDashboardService";
import { useAuth } from "../../context/AuthContext";

export default function FarmAdminLayout() {
  const { user } = useAuth();
  const role = user?.role ?? "Farm Admin";

  return (
    <DashboardLayout
      navigation={getFarmNavigation(role)}
      bottomNavItems={getFarmBottomNav(role)}
      homePath={FARM_DASHBOARD_PATH}
      accountPath={FARM_ACCOUNT_PATH}
      accountLabel="My Account"
      portalLabel="Farm Admin"
      notificationCount={getFarmOverview().notifications}
    />
  );
}

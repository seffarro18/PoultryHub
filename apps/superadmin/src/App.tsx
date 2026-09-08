import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "@poultryhub/shared/context/ThemeContext";
import { SystemSettingsProvider, useSystemSettings } from "@poultryhub/shared/context/SystemSettingsContext";
import { AuthProvider, useAuth } from "@poultryhub/shared/context/AuthContext";
import { ToastProvider } from "@poultryhub/shared/components/ui/ToastContext";
import ProtectedRoute from "@poultryhub/shared/routes/ProtectedRoute";
import PendingRoute from "@poultryhub/shared/routes/PendingRoute";
import ModulePlaceholder from "@poultryhub/shared/components/layout/ModulePlaceholder";
import LandingPage from "@poultryhub/shared/pages/LandingPage";
import LoginPage from "@poultryhub/shared/pages/LoginPage";
import ResetPasswordPage from "@poultryhub/shared/pages/ResetPasswordPage";
import PendingApprovalPage from "@poultryhub/shared/pages/PendingApprovalPage";
import PublicPrivacyPolicyPage from "@poultryhub/shared/pages/PrivacyPolicyPage";
import PublicTermsOfServicePage from "@poultryhub/shared/pages/TermsOfServicePage";
import SuperAdminLayout from "./components/layout/SuperAdminLayout";
import DashboardPage from "./pages/DashboardPage";
import FarmsPage from "./pages/FarmsPage";
import LocationsPage from "./pages/LocationsPage";
import UsersPage from "./pages/UsersPage";
import RolesPage from "./pages/RolesPage";
import PermissionsPage from "./pages/PermissionsPage";
import EggProductionPage from "./pages/EggProductionPage";
import PoultryInventoryPage from "./pages/PoultryInventoryPage";
import FeedVitaminOversightPage from "./pages/FeedVitaminOversightPage";
import HealthRecordsOversightPage from "./pages/HealthRecordsOversightPage";
import MortalityRecordsOversightPage from "./pages/MortalityRecordsOversightPage";
import AuditLogsOversightPage from "./pages/AuditLogsOversightPage";
import SalesExpensesOversightPage from "./pages/SalesExpensesOversightPage";
import NotificationsPage from "./pages/NotificationsPage";
import SecurityManagementPage from "./pages/SecurityManagementPage";
import SystemGeneralSettingsPage from "./pages/SystemGeneralSettingsPage";
import EmailConfigurationPage from "./pages/EmailConfigurationPage";
import BackupRestorePage from "./pages/BackupRestorePage";
import ProfileMenuPage from "./pages/ProfileMenuPage";
import EditProfilePage from "./pages/EditProfilePage";
import AccountSecurityPage from "./pages/AccountSecurityPage";
import AccountNotificationsPage from "./pages/AccountNotificationsPage";
import AccountAppearancePage from "./pages/AccountAppearancePage";
import PrivacyPage from "./pages/PrivacyPage";
import HelpSupportPage from "./pages/HelpSupportPage";
import AboutPage from "./pages/AboutPage";
import {
  DASHBOARD_PATH,
  PROFILE_PATH,
  USERS_PATH,
  ROLES_PATH,
  PERMISSIONS_PATH,
  EGG_PRODUCTION_PATH,
  POULTRY_INVENTORY_PATH,
  NOTIFICATIONS_PATH,
  FARMS_PATH,
  FARM_LOCATIONS_PATH,
  FEED_VITAMIN_PATH,
  HEALTH_RECORDS_PATH,
  MORTALITY_RECORDS_PATH,
  AUDIT_LOGS_PATH,
  SALES_EXPENSES_PATH,
  SECURITY_PATH,
  GENERAL_SETTINGS_PATH,
  EMAIL_CONFIG_PATH,
  BACKUP_PATH,
  flattenNavLinks,
  navigation,
} from "./config/navigation";
import { getHomePathForUser, getHomePathForRole, NO_ACCESS_PATH } from "./config/roleHome";

const superAdminPlaceholders = flattenNavLinks(navigation).filter(
  (link) =>
    link.path !== DASHBOARD_PATH &&
    link.path !== PROFILE_PATH &&
    link.path !== USERS_PATH &&
    link.path !== ROLES_PATH &&
    link.path !== PERMISSIONS_PATH &&
    link.path !== EGG_PRODUCTION_PATH &&
    link.path !== POULTRY_INVENTORY_PATH &&
    link.path !== NOTIFICATIONS_PATH &&
    link.path !== FARMS_PATH &&
    link.path !== FARM_LOCATIONS_PATH &&
    link.path !== FEED_VITAMIN_PATH &&
    link.path !== HEALTH_RECORDS_PATH &&
    link.path !== MORTALITY_RECORDS_PATH &&
    link.path !== AUDIT_LOGS_PATH &&
    link.path !== SALES_EXPENSES_PATH &&
    link.path !== SECURITY_PATH &&
    link.path !== GENERAL_SETTINGS_PATH &&
    link.path !== EMAIL_CONFIG_PATH &&
    link.path !== BACKUP_PATH
);

/** Keeps the browser tab title in sync with the configured system name. */
function DocumentTitleSync() {
  const { settings } = useSystemSettings();
  useEffect(() => {
    document.title = settings?.systemName || "PoultryHub";
  }, [settings]);
  return null;
}

/** Sends an authenticated user to their portal's home (or /pending), or to /login if signed out. */
function RoleHomeRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  return <Navigate to={user ? getHomePathForUser(user) : "/login"} replace />;
}

/** A signed-in user whose role has no home in this app (e.g. Farm Admin/Manager/Staff — that's the mobile app). */
function NoAccessPage() {
  const { user, signOut } = useAuth();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--color-background)] px-6 text-center">
      <h1 className="font-display text-xl font-semibold text-[var(--color-foreground)]">This portal is for Super Admins only</h1>
      <p className="max-w-sm text-sm text-[var(--color-muted)]">
        {user ? `Your account (${user.role})` : "Your account"} doesn't have access to the desktop admin app — open the
        PoultryHub mobile app instead.
      </p>
      <button
        type="button"
        onClick={signOut}
        className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]"
      >
        Sign out
      </button>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <SystemSettingsProvider>
        <DocumentTitleSync />
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
            <Routes>
              <Route path="/" element={<LandingPage getHomePathForUser={getHomePathForUser} />} />
              <Route path="/login" element={<LoginPage getHomePathForUser={getHomePathForUser} />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/privacy" element={<PublicPrivacyPolicyPage />} />
              <Route path="/terms" element={<PublicTermsOfServicePage />} />
              <Route path="/no-access" element={<NoAccessPage />} />
              <Route
                path="/pending"
                element={
                  <PendingRoute getHomePathForRole={getHomePathForRole}>
                    <PendingApprovalPage />
                  </PendingRoute>
                }
              />

              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute allow={["Super Admin"]} getHomePathForRole={getHomePathForRole}>
                    <SuperAdminLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<DashboardPage />} />
                <Route path="profile" element={<ProfileMenuPage />} />
                <Route path="profile/edit" element={<EditProfilePage />} />
                <Route path="profile/security" element={<AccountSecurityPage />} />
                <Route path="profile/notifications" element={<AccountNotificationsPage />} />
                <Route path="profile/appearance" element={<AccountAppearancePage />} />
                <Route path="profile/privacy" element={<PrivacyPage />} />
                <Route path="profile/help" element={<HelpSupportPage />} />
                <Route path="profile/about" element={<AboutPage />} />
                <Route path="farms" element={<FarmsPage />} />
                <Route path="farms/locations" element={<LocationsPage />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="users/roles" element={<RolesPage />} />
                <Route path="users/permissions" element={<PermissionsPage />} />
                <Route path="production/eggs" element={<EggProductionPage />} />
                <Route path="production/inventory" element={<PoultryInventoryPage />} />
                <Route path="production/feed" element={<FeedVitaminOversightPage />} />
                <Route path="production/health" element={<HealthRecordsOversightPage />} />
                <Route path="production/mortality" element={<MortalityRecordsOversightPage />} />
                <Route path="audit-logs" element={<AuditLogsOversightPage />} />
                <Route path="sales" element={<SalesExpensesOversightPage />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="settings/security" element={<SecurityManagementPage />} />
                <Route path="settings/general" element={<SystemGeneralSettingsPage />} />
                <Route path="settings/email" element={<EmailConfigurationPage />} />
                <Route path="backup" element={<BackupRestorePage />} />
                {superAdminPlaceholders.map((link) => (
                  <Route
                    key={link.path}
                    path={link.path.replace(`${DASHBOARD_PATH}/`, "")}
                    element={<ModulePlaceholder title={link.label} icon={link.icon} />}
                  />
                ))}
              </Route>

              <Route path="*" element={<RoleHomeRedirect />} />
            </Routes>
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </SystemSettingsProvider>
    </BrowserRouter>
  );
}

import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import AppIntro from "./components/AppIntro";
import { ThemeProvider } from "@poultryhub/shared/context/ThemeContext";
import { SystemSettingsProvider, useSystemSettings } from "@poultryhub/shared/context/SystemSettingsContext";
import { AuthProvider, useAuth } from "@poultryhub/shared/context/AuthContext";
import { ToastProvider } from "@poultryhub/shared/components/ui/ToastContext";
import ProtectedRoute from "@poultryhub/shared/routes/ProtectedRoute";
import PendingRoute from "@poultryhub/shared/routes/PendingRoute";
import ModulePlaceholder from "@poultryhub/shared/components/layout/ModulePlaceholder";
import LoginPage from "@poultryhub/shared/pages/LoginPage";
import ResetPasswordPage from "@poultryhub/shared/pages/ResetPasswordPage";
import PendingApprovalPage from "@poultryhub/shared/pages/PendingApprovalPage";
import PrivacyPolicyPage from "@poultryhub/shared/pages/PrivacyPolicyPage";
import TermsOfServicePage from "@poultryhub/shared/pages/TermsOfServicePage";
import FarmAdminLayout from "./components/layout/FarmAdminLayout";
import OnboardingPage from "./screens/OnboardingPage";
import { hasCompletedOnboarding } from "./lib/onboarding";
import FarmDashboardPage from "./screens/FarmDashboardPage";
import FarmEggProductionPage from "./screens/FarmEggProductionPage";
import StaffEggProductionPage from "./screens/StaffEggProductionPage";
import StaffManagementPage from "./screens/StaffManagementPage";
import FarmPoultryInventoryPage from "./screens/FarmPoultryInventoryPage";
import StaffPoultryInventoryPage from "./screens/StaffPoultryInventoryPage";
import FarmNotificationsPage from "./screens/FarmNotificationsPage";
import StaffNotificationsPage from "./screens/StaffNotificationsPage";
import FarmHealthRecordsPage from "./screens/FarmHealthRecordsPage";
import StaffHealthRecordsPage from "./screens/StaffHealthRecordsPage";
import FarmAuditLogsPage from "./screens/FarmAuditLogsPage";
import StaffActivityHistoryPage from "./screens/StaffActivityHistoryPage";
import FarmSalesExpensesPage from "./screens/FarmSalesExpensesPage";
import FarmProfilePage from "./screens/FarmProfilePage";
import EditProfilePage from "./screens/EditProfilePage";
import ProfileMenuPage from "./screens/ProfileMenuPage";
import AccountSecurityPage from "./screens/AccountSecurityPage";
import AccountNotificationsPage from "./screens/AccountNotificationsPage";
import AccountAppearancePage from "./screens/AccountAppearancePage";
import AppPermissionsPage from "./screens/AppPermissionsPage";
import PrivacyPage from "./screens/PrivacyPage";
import HelpSupportPage from "./screens/HelpSupportPage";
import AboutPage from "./screens/AboutPage";
import HubPage from "./screens/HubPage";
import {
  FARM_DASHBOARD_PATH,
  FARM_ACCOUNT_PATH,
  FARM_EGG_PRODUCTION_PATH,
  FARM_STAFF_PATH,
  FARM_POULTRY_INVENTORY_PATH,
  FARM_NOTIFICATIONS_PATH,
  FARM_FEED_PATH,
  FARM_VITAMINS_PATH,
  FARM_HEALTH_PATH,
  FARM_MORTALITY_PATH,
  FARM_AUDIT_LOGS_PATH,
  FARM_SALES_EXPENSES_PATH,
  FARM_PROFILE_PATH,
  getAllFarmNavLinks,
  getOperationsHubItems,
  getProductionHubItems,
  getInventoryHubItems,
} from "./config/farmNavigation";
import { getHomePathForUser, getHomePathForRole } from "./config/roleHome";

// The union of every role's farm nav — every path any role can point to needs a
// mounted route, regardless of which role is currently logged in.
const farmPlaceholders = getAllFarmNavLinks().filter(
  (link) =>
    link.path !== FARM_DASHBOARD_PATH &&
    link.path !== FARM_ACCOUNT_PATH &&
    link.path !== FARM_EGG_PRODUCTION_PATH &&
    link.path !== FARM_STAFF_PATH &&
    link.path !== FARM_POULTRY_INVENTORY_PATH &&
    link.path !== FARM_NOTIFICATIONS_PATH &&
    link.path !== FARM_FEED_PATH &&
    link.path !== FARM_VITAMINS_PATH &&
    link.path !== FARM_HEALTH_PATH &&
    link.path !== FARM_MORTALITY_PATH &&
    link.path !== FARM_AUDIT_LOGS_PATH &&
    link.path !== FARM_SALES_EXPENSES_PATH &&
    link.path !== FARM_PROFILE_PATH
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

/** First launch only: shows the onboarding screen once. After that (or once signed in), "/" always redirects straight past it — signed-in users to their dashboard, everyone else to Login — this app never shows a marketing landing page more than once. */
function RootRoute() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (user) return <Navigate to={getHomePathForUser(user)} replace />;
  if (!hasCompletedOnboarding()) return <OnboardingPage />;
  return <Navigate to="/login" replace />;
}

/** A signed-in user whose role has no home in this app (e.g. a Super Admin — that's the desktop app). */
function NoAccessPage() {
  const { user, signOut } = useAuth();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--color-background)] px-6 text-center">
      <h1 className="font-display text-xl font-semibold text-[var(--color-foreground)]">This app is for farm accounts only</h1>
      <p className="max-w-sm text-sm text-[var(--color-muted)]">
        {user ? `Your account (${user.role})` : "Your account"} doesn't have access here — open the PoultryHub desktop
        admin app instead.
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

function OperationsHubRoute() {
  const { user } = useAuth();
  return (
    <HubPage
      title="Operations"
      subtitle="Everything else, in one place."
      items={getOperationsHubItems(user?.role ?? "Farm Admin")}
    />
  );
}

/** Staff records production; Farm Admin/Manager review it — same route, different page per role. */
function EggProductionRoute() {
  const { user } = useAuth();
  return user?.role === "Staff" ? <StaffEggProductionPage /> : <FarmEggProductionPage />;
}

/** Same split as EggProductionRoute — Staff records limited event types, Farm Admin/Manager manage everything. */
function PoultryInventoryRoute() {
  const { user } = useAuth();
  return user?.role === "Staff" ? <StaffPoultryInventoryPage /> : <FarmPoultryInventoryPage />;
}

/** Staff can only view/mark-as-read; Farm Admin/Manager get archive/delete plus a "Send Notification" composer. */
function NotificationsRoute() {
  const { user } = useAuth();
  return user?.role === "Staff" ? <StaffNotificationsPage /> : <FarmNotificationsPage />;
}

/** Same split as EggProductionRoute — Staff records observations, Farm Admin/Manager review and manage. */
function HealthRoute() {
  const { user } = useAuth();
  return user?.role === "Staff" ? <StaffHealthRecordsPage /> : <FarmHealthRecordsPage />;
}

/** Same split as EggProductionRoute — Staff sees only their own activity, Farm Admin/Manager see their farm's. */
function AuditLogsRoute() {
  const { user } = useAuth();
  return user?.role === "Staff" ? <StaffActivityHistoryPage /> : <FarmAuditLogsPage />;
}

function ProductionHubRoute() {
  return <HubPage title="Production" items={getProductionHubItems()} />;
}

function InventoryHubRoute() {
  return <HubPage title="Inventory" items={getInventoryHubItems()} />;
}

export default function App() {
  const [showIntro, setShowIntro] = useState(true);

  return (
    <>
      <AnimatePresence>{showIntro && <AppIntro onDone={() => setShowIntro(false)} />}</AnimatePresence>
      <BrowserRouter>
      <SystemSettingsProvider>
        <DocumentTitleSync />
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
            <Routes>
              <Route path="/" element={<RootRoute />} />
              <Route path="/login" element={<LoginPage getHomePathForUser={getHomePathForUser} />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/privacy" element={<PrivacyPolicyPage />} />
              <Route path="/terms" element={<TermsOfServicePage />} />
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
                path="/farm"
                element={
                  <ProtectedRoute allow={["Farm Admin", "Manager", "Staff"]} getHomePathForRole={getHomePathForRole}>
                    <FarmAdminLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<FarmDashboardPage />} />
                {/* Mobile's own settings-menu structure — a role-filtered list of
                    categories (see getAccountMenuItems), not the shared ProfilePage
                    Super Admin uses. */}
                <Route path="account" element={<ProfileMenuPage />} />
                <Route path="account/edit" element={<EditProfilePage />} />
                <Route path="account/security" element={<AccountSecurityPage />} />
                <Route path="account/notifications" element={<AccountNotificationsPage />} />
                <Route path="account/appearance" element={<AccountAppearancePage />} />
                <Route path="account/permissions" element={<AppPermissionsPage />} />
                <Route path="account/privacy" element={<PrivacyPage />} />
                <Route path="account/help" element={<HelpSupportPage />} />
                <Route path="account/about" element={<AboutPage />} />
                <Route path="egg-production" element={<EggProductionRoute />} />
                <Route path="staff" element={<StaffManagementPage />} />
                {/* /feed, /vitamins, /mortality stay mounted as aliases into the same merged Poultry Inventory page (it
                    derives its initial tab from location.pathname) — old links and stored notification `link` fields
                    that still point at these paths keep working, landing on the right tab. */}
                <Route path="inventory" element={<PoultryInventoryRoute />} />
                <Route path="feed" element={<PoultryInventoryRoute />} />
                <Route path="vitamins" element={<PoultryInventoryRoute />} />
                <Route path="mortality" element={<PoultryInventoryRoute />} />
                <Route path="health" element={<HealthRoute />} />
                <Route path="audit-logs" element={<AuditLogsRoute />} />
                {/* Farm Admin/Manager only, no role-split — Staff isn't linked here and RLS denies them regardless. */}
                <Route path="sales" element={<FarmSalesExpensesPage />} />
                <Route path="profile" element={<FarmProfilePage />} />
                <Route path="notifications" element={<NotificationsRoute />} />
                <Route path="operations" element={<OperationsHubRoute />} />
                <Route path="production-hub" element={<ProductionHubRoute />} />
                <Route path="inventory-hub" element={<InventoryHubRoute />} />
                {farmPlaceholders.map((link) => (
                  <Route
                    key={link.path}
                    path={link.path.replace(`${FARM_DASHBOARD_PATH}/`, "")}
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
    </>
  );
}

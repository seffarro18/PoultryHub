import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ProtectedRoute from "./routes/ProtectedRoute";
import PendingRoute from "./routes/PendingRoute";
import SuperAdminLayout from "./components/layout/SuperAdminLayout";
import FarmAdminLayout from "./components/layout/FarmAdminLayout";
import ModulePlaceholder from "./components/layout/ModulePlaceholder";
import DashboardPage from "./pages/DashboardPage";
import FarmDashboardPage from "./pages/FarmDashboardPage";
import ProfilePage from "./pages/ProfilePage";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import PendingApprovalPage from "./pages/PendingApprovalPage";
import UsersPage from "./pages/UsersPage";
import RolesPage from "./pages/RolesPage";
import PermissionsPage from "./pages/PermissionsPage";
import EggProductionPage from "./pages/EggProductionPage";
import FarmEggProductionPage from "./pages/FarmEggProductionPage";
import StaffEggProductionPage from "./pages/StaffEggProductionPage";
import StaffManagementPage from "./pages/StaffManagementPage";
import HubPage from "./pages/HubPage";
import {
  DASHBOARD_PATH,
  PROFILE_PATH,
  USERS_PATH,
  ROLES_PATH,
  PERMISSIONS_PATH,
  EGG_PRODUCTION_PATH,
  flattenNavLinks,
  navigation,
} from "./config/navigation";
import {
  FARM_DASHBOARD_PATH,
  FARM_ACCOUNT_PATH,
  FARM_EGG_PRODUCTION_PATH,
  FARM_STAFF_PATH,
  getAllFarmNavLinks,
  getOperationsHubItems,
  getProductionHubItems,
  getInventoryHubItems,
} from "./config/farmNavigation";
import { getHomePathForUser } from "./config/roleHome";

const superAdminPlaceholders = flattenNavLinks(navigation).filter(
  (link) =>
    link.path !== DASHBOARD_PATH &&
    link.path !== PROFILE_PATH &&
    link.path !== USERS_PATH &&
    link.path !== ROLES_PATH &&
    link.path !== PERMISSIONS_PATH &&
    link.path !== EGG_PRODUCTION_PATH
);

// The union of every role's farm nav — every path any role can point to needs a
// mounted route, regardless of which role is currently logged in.
const farmPlaceholders = getAllFarmNavLinks().filter(
  (link) =>
    link.path !== FARM_DASHBOARD_PATH &&
    link.path !== FARM_ACCOUNT_PATH &&
    link.path !== FARM_EGG_PRODUCTION_PATH &&
    link.path !== FARM_STAFF_PATH
);

/** Sends an authenticated user to their portal's home (or /pending), or to /login if signed out. */
function RoleHomeRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  return <Navigate to={user ? getHomePathForUser(user) : "/login"} replace />;
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

function ProductionHubRoute() {
  return <HubPage title="Production" items={getProductionHubItems()} />;
}

function InventoryHubRoute() {
  return <HubPage title="Inventory" items={getInventoryHubItems()} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route
              path="/pending"
              element={
                <PendingRoute>
                  <PendingApprovalPage />
                </PendingRoute>
              }
            />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute allow={["Super Admin"]}>
                  <SuperAdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="users/roles" element={<RolesPage />} />
              <Route path="users/permissions" element={<PermissionsPage />} />
              <Route path="production/eggs" element={<EggProductionPage />} />
              {superAdminPlaceholders.map((link) => (
                <Route
                  key={link.path}
                  path={link.path.replace(`${DASHBOARD_PATH}/`, "")}
                  element={<ModulePlaceholder title={link.label} icon={link.icon} />}
                />
              ))}
            </Route>

            <Route
              path="/farm"
              element={
                <ProtectedRoute allow={["Farm Admin", "Manager", "Staff"]}>
                  <FarmAdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<FarmDashboardPage />} />
              <Route path="account" element={<ProfilePage />} />
              <Route path="egg-production" element={<EggProductionRoute />} />
              <Route path="staff" element={<StaffManagementPage />} />
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
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

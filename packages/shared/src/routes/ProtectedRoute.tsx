import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { PENDING_PATH } from "../constants/paths";
import type { UserRole } from "../types/auth";

interface ProtectedRouteProps {
  children: ReactNode;
  /** Roles allowed on this route. Omit to allow any authenticated user. */
  allow?: UserRole[];
  /** Where a signed-in-but-disallowed role goes instead — each app only knows its own roles' home routes. */
  getHomePathForRole: (role: UserRole) => string;
}

export default function ProtectedRoute({ children, allow, getHomePathForRole }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)]">
        <Loader2 size={24} className="spinner text-[var(--color-primary)]" aria-label="Loading" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.status !== "active") {
    return <Navigate to={PENDING_PATH} replace />;
  }

  if (allow && !allow.includes(user.role)) {
    return <Navigate to={getHomePathForRole(user.role)} replace />;
  }

  return <>{children}</>;
}

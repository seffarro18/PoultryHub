import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import type { UserRole } from "../types/auth";

interface PendingRouteProps {
  children: ReactNode;
  /** Where an already-active user gets bounced instead — each app only knows its own roles' home routes. */
  getHomePathForRole: (role: UserRole) => string;
}

/**
 * Guards the /pending screen itself. Deliberately not a variant of
 * ProtectedRoute — that component redirects non-active users *to* /pending,
 * so reusing it here (with a status check) would infinite-loop them.
 */
export default function PendingRoute({ children, getHomePathForRole }: PendingRouteProps) {
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

  if (user.status === "active") {
    return <Navigate to={getHomePathForRole(user.role)} replace />;
  }

  return <>{children}</>;
}

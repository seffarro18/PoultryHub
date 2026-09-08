import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { getUnreadCount } from "../services/notificationService";
import { useAuth } from "./AuthContext";

const POLL_INTERVAL_MS = 60_000;

interface NotificationCountContextValue {
  count: number;
  /** Re-fetches the unread count — call after mark-as-read/archive/delete so the bell badge updates immediately. */
  refresh: () => Promise<void>;
}

const NotificationCountContext = createContext<NotificationCountContextValue | null>(null);

interface NotificationCountProviderProps {
  children: ReactNode;
  /**
   * Called whenever a foreground poll finds the unread count went up.
   * Left unset by default, so Super Admin (no Capacitor plugins installed
   * at all) is a no-op — the mobile app is the only one that passes this,
   * wiring in a local-notification call from its own code so this shared
   * file never has to import a Capacitor package directly.
   */
  onNewNotifications?: (newCount: number, previousCount: number) => void;
}

/** Scoped inside each portal's DashboardLayout so the Topbar badge and the Notifications pages it renders via Outlet share one live count. */
export function NotificationCountProvider({ children, onNewNotifications }: NotificationCountProviderProps) {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const countRef = useRef(count);
  countRef.current = count;

  const refresh = useCallback(async () => {
    if (!user) {
      setCount(0);
      return;
    }
    try {
      const next = await getUnreadCount();
      if (next > countRef.current) onNewNotifications?.(next, countRef.current);
      setCount(next);
    } catch (err) {
      console.error("[NotificationCountProvider] failed to load unread count:", err);
    }
  }, [user, onNewNotifications]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Foreground-only poll so the mobile bell badge (and, via onNewNotifications,
  // a local notification) stays current while the app is open. Nothing fires
  // while the app is closed — that would need real push (Firebase + a server
  // sender), which this project doesn't have.
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [user, refresh]);

  return <NotificationCountContext.Provider value={{ count, refresh }}>{children}</NotificationCountContext.Provider>;
}

export function useNotificationCount(): NotificationCountContextValue {
  const ctx = useContext(NotificationCountContext);
  if (!ctx) throw new Error("useNotificationCount must be used within a NotificationCountProvider");
  return ctx;
}

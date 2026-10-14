import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { getUnreadCount } from "../services/notificationService";
import { supabase } from "../services/supabaseClient";
import { useToast } from "../components/ui/ToastContext";
import { resolveNotificationLink } from "../lib/notificationNavigation";
import { useAuth } from "./AuthContext";

const POLL_INTERVAL_MS = 60_000;
/** How many recently-surfaced notification ids to remember, so a row already turned into a local notification is never re-surfaced (e.g. if the poll's reconciliation and a Realtime event overlap). */
const NOTIFIED_ID_CAP = 200;
const REFRESH_DEBOUNCE_MS = 300;

/** Raw `notifications` row shape as Realtime delivers it — snake_case, unlike the camelCase AppNotification the rest of the app uses. */
interface RawNotificationRow {
  id: string;
  title: string;
  message: string;
  link?: string | null;
  category?: string;
}

interface NotificationCountContextValue {
  count: number;
  /** Re-fetches the unread count — call after mark-as-read/archive/delete so the bell badge updates immediately. */
  refresh: () => Promise<void>;
  /**
   * Timestamp of the most recently Realtime-delivered INSERT, 0 until the
   * first one arrives — a notification list page (FarmNotificationsPage,
   * StaffNotificationsPage, Super Admin's NotificationsPage) watches this in
   * a useEffect and re-fetches its own list when it changes, so a
   * notification arriving while the panel is already open shows up without
   * a manual reload. Deliberately reuses this one already-open channel
   * instead of each page opening its own Realtime subscription.
   */
  lastInsertedAt: number;
}

const NotificationCountContext = createContext<NotificationCountContextValue | null>(null);

interface NotificationCountProviderProps {
  children: ReactNode;
  /**
   * Called once per genuinely new notification row, as Realtime delivers it —
   * left unset by default, so Super Admin (no Capacitor plugins installed at
   * all) is a no-op. Only the mobile app wires this in, firing a local
   * notification from its own code so this shared file never has to import a
   * Capacitor package directly.
   */
  onNewNotifications?: (notification: RawNotificationRow) => void;
}

/** Scoped inside each portal's DashboardLayout so the Topbar badge and the Notifications pages it renders via Outlet share one live count. */
export function NotificationCountProvider({ children, onNewNotifications }: NotificationCountProviderProps) {
  const { user } = useAuth();
  // Keyed on the id, not the user object — a profile refresh hands back a new
  // object for the same person, and must not tear down and reopen the channel.
  const userId = user?.id ?? null;
  const toast = useToast();
  const onNewNotificationsRef = useRef(onNewNotifications);
  onNewNotificationsRef.current = onNewNotifications;
  const navigate = useNavigate();
  const location = useLocation();
  const [count, setCount] = useState(0);
  const [lastInsertedAt, setLastInsertedAt] = useState(0);
  const notifiedIdsRef = useRef<string[]>([]);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Read inside the Realtime callback without re-subscribing on every
  // navigation — the channel must stay one long-lived subscription.
  const appPrefixRef = useRef<"/dashboard" | "/farm">("/farm");
  appPrefixRef.current = location.pathname.startsWith("/dashboard") ? "/dashboard" : "/farm";
  const showAlertRef = useRef<(row: RawNotificationRow) => void>(() => {});
  showAlertRef.current = (row) => {
    const resolution = resolveNotificationLink(row.link ?? null, appPrefixRef.current);
    toast.info(
      `${row.title} — ${row.message}`,
      resolution.kind === "navigate" ? { label: "View", onClick: () => navigate(resolution.path) } : undefined
    );
  };

  const refresh = useCallback(async () => {
    if (!userId) {
      setCount(0);
      return;
    }
    try {
      setCount(await getUnreadCount());
    } catch (err) {
      console.error("[NotificationCountProvider] failed to load unread count:", err);
    }
  }, [userId]);

  const debouncedRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => void refresh(), REFRESH_DEBOUNCE_MS);
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Foreground poll — a correctness backstop, not the primary delivery path
  // (see the Realtime subscription below). A Capacitor WebView can suspend a
  // WebSocket while backgrounded, so this keeps the badge honest even if a
  // Realtime event was missed; it just won't retroactively fire a local
  // notification for whatever arrived while disconnected (see onNewNotifications
  // above — that's Realtime-driven only, deliberately, so it's never fired
  // from a bare count delta with no real row to describe).
  useEffect(() => {
    if (!userId) return;
    const interval = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [userId, refresh]);

  // Real-time delivery: Postgres Changes over the same Supabase client
  // already used everywhere else — authorized per-subscriber by the existing
  // RLS SELECT policy (recipient_id = auth.uid()), no new policy needed.
  useEffect(() => {
    if (!userId) return;

    let channel: RealtimeChannel | null = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${userId}` },
        (payload: RealtimePostgresChangesPayload<RawNotificationRow>) => {
          if (payload.eventType === "INSERT" && "id" in payload.new) {
            const row = payload.new;
            if (!notifiedIdsRef.current.includes(row.id)) {
              notifiedIdsRef.current = [...notifiedIdsRef.current, row.id].slice(-NOTIFIED_ID_CAP);
              if (import.meta.env.DEV) {
                console.info("[NotificationCountProvider] realtime notification", { id: row.id, category: row.category });
              }
              onNewNotificationsRef.current?.(row);
              showAlertRef.current(row);
              setLastInsertedAt(Date.now());
            }
          }
          debouncedRefresh();
        }
      )
      .subscribe((status, err) => {
        if (import.meta.env.DEV) console.info("[NotificationCountProvider] realtime status:", status);
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          // Realtime unavailable — the badge still self-heals from the REST
          // count (here, the 60s poll, and on reconnect/refocus below).
          console.warn("[NotificationCountProvider] realtime subscription failed:", status, err?.message ?? "");
          void refresh();
        }
      });

    // A network drop (common on mobile data) can leave the socket closed —
    // a plain REST refresh always works regardless of the channel's state,
    // and self-heals the badge even if the channel takes a moment to resume.
    const handleOnline = () => void refresh();
    const handleVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisible);

    return () => {
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisible);
      if (channel) {
        void supabase.removeChannel(channel);
        channel = null;
      }
    };
  }, [userId, debouncedRefresh, refresh]);

  return (
    <NotificationCountContext.Provider value={{ count, refresh, lastInsertedAt }}>{children}</NotificationCountContext.Provider>
  );
}

export function useNotificationCount(): NotificationCountContextValue {
  const ctx = useContext(NotificationCountContext);
  if (!ctx) throw new Error("useNotificationCount must be used within a NotificationCountProvider");
  return ctx;
}

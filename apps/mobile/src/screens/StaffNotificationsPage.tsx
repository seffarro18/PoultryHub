import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Bell, Loader2 } from "lucide-react";
import { listNotifications, markAsRead } from "@poultryhub/shared/services/notificationService";
import { useNotificationCount } from "@poultryhub/shared/context/NotificationCountContext";
import { useToast } from "@poultryhub/shared/components/ui/ToastContext";
import { resolveNotificationLink } from "@poultryhub/shared/lib/notificationNavigation";
import NotificationCard from "@poultryhub/shared/components/notifications/NotificationCard";
import type { AppNotification } from "@poultryhub/shared/types/notification";
import { getErrorMessage } from "@poultryhub/shared/lib/errorMessage";

export default function StaffNotificationsPage() {
  const { refresh: refreshBadge, lastInsertedAt } = useNotificationCount();
  const navigate = useNavigate();
  const toast = useToast();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setNotifications(await listNotifications());
    } catch (err) {
      setLoadError(getErrorMessage(err, "Failed to load notifications."));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  // A notification arriving while this panel is already open should show up
  // here too, not just bump the topbar badge — re-fetches off the same
  // Realtime channel NotificationCountProvider already holds open, rather
  // than opening a second subscription just for this page.
  useEffect(() => {
    if (lastInsertedAt > 0) void refresh();
  }, [lastInsertedAt]);

  const handleOpen = async (n: AppNotification) => {
    if (n.status === "unread") {
      setNotifications((prev) => prev.map((row) => (row.id === n.id ? { ...row, status: "read" } : row)));
      try {
        await markAsRead(n.id);
        void refreshBadge();
      } catch (err) {
        console.error("[StaffNotificationsPage] mark as read failed:", err);
      }
    }
    const resolution = resolveNotificationLink(n.link, "/farm");
    if (resolution.kind === "navigate") navigate(resolution.path);
    else if (resolution.kind === "denied") toast.error("You don't have permission to view this.");
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-xl font-semibold text-[var(--color-foreground)]">Notifications</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">Reminders and updates from your Farm Admin.</p>
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-[var(--color-muted)]">
            <Loader2 size={16} className="spinner" /> Loading notifications…
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <AlertCircle size={20} className="text-[var(--color-danger)]" />
            <p className="text-sm text-[var(--color-foreground)]">{loadError}</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-[var(--color-muted)]">
            <Bell size={22} strokeWidth={1.75} />
            <p className="text-sm">Nothing here yet.</p>
          </div>
        ) : (
          notifications.map((n) => (
            <NotificationCard key={n.id} notification={n} onClick={() => void handleOpen(n)} />
          ))
        )}
      </div>
    </div>
  );
}

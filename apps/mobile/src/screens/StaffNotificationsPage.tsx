import { useEffect, useState } from "react";
import { AlertCircle, Bell, Loader2 } from "lucide-react";
import { listNotifications, markAsRead } from "@poultryhub/shared/services/notificationService";
import { useNotificationCount } from "@poultryhub/shared/context/NotificationCountContext";
import NotificationCard from "@poultryhub/shared/components/notifications/NotificationCard";
import type { AppNotification } from "@poultryhub/shared/types/notification";

export default function StaffNotificationsPage() {
  const { refresh: refreshBadge } = useNotificationCount();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listNotifications()
      .then((rows) => {
        if (!cancelled) setNotifications(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load notifications.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleOpen = async (n: AppNotification) => {
    if (n.status !== "unread") return;
    setNotifications((prev) => prev.map((row) => (row.id === n.id ? { ...row, status: "read" } : row)));
    try {
      await markAsRead(n.id);
      void refreshBadge();
    } catch (err) {
      console.error("[StaffNotificationsPage] mark as read failed:", err);
    }
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

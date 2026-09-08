import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Archive, Bell, Check, Loader2, Trash2 } from "lucide-react";
import {
  archiveNotification,
  deleteNotification,
  listNotifications,
  markAllAsRead,
  markAsRead,
} from "@poultryhub/shared/services/notificationService";
import { useNotificationCount } from "@poultryhub/shared/context/NotificationCountContext";
import NotificationCard from "@poultryhub/shared/components/notifications/NotificationCard";
import { NOTIFICATION_CATEGORY_META, SUPER_ADMIN_CATEGORIES, type AppNotification, type NotificationCategory } from "@poultryhub/shared/types/notification";

type StatusTab = "unread" | "all" | "archived";
const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: "unread", label: "Unread" },
  { key: "all", label: "All" },
  { key: "archived", label: "Archived" },
];

export default function NotificationsPage() {
  const { refresh: refreshBadge } = useNotificationCount();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusTab, setStatusTab] = useState<StatusTab>("unread");
  const [category, setCategory] = useState<NotificationCategory | "all">("all");

  const refresh = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setNotifications(await listNotifications());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load notifications.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const unreadCount = useMemo(() => notifications.filter((n) => n.status === "unread").length, [notifications]);

  const filtered = useMemo(() => {
    return notifications.filter((n) => {
      if (statusTab === "unread" && n.status !== "unread") return false;
      if (statusTab === "all" && n.status === "archived") return false;
      if (statusTab === "archived" && n.status !== "archived") return false;
      if (category !== "all" && n.category !== category) return false;
      return true;
    });
  }, [notifications, statusTab, category]);

  const handleMarkAsRead = async (id: string) => {
    setBusyId(id);
    try {
      await markAsRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, status: "read" } : n)));
      void refreshBadge();
    } catch (err) {
      console.error("[NotificationsPage] mark as read failed:", err);
    } finally {
      setBusyId(null);
    }
  };

  const handleArchive = async (id: string) => {
    setBusyId(id);
    try {
      await archiveNotification(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, status: "archived" } : n)));
      void refreshBadge();
    } catch (err) {
      console.error("[NotificationsPage] archive failed:", err);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this notification? This can't be undone.")) return;
    setBusyId(id);
    try {
      await deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      void refreshBadge();
    } catch (err) {
      console.error("[NotificationsPage] delete failed:", err);
    } finally {
      setBusyId(null);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
      setNotifications((prev) => prev.map((n) => (n.status === "unread" ? { ...n, status: "read" } : n)));
      void refreshBadge();
    } catch (err) {
      console.error("[NotificationsPage] mark all as read failed:", err);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold text-[var(--color-foreground)]">Notifications</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            System-wide alerts across every farm — stock, mortality, and account activity.
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => void handleMarkAllAsRead()}
            className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]"
          >
            <Check size={13} /> Mark all as read
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex rounded-lg border border-[var(--color-border)] p-0.5 text-xs font-medium">
          {STATUS_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setStatusTab(t.key)}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                statusTab === t.key
                  ? "bg-[var(--color-primary)] text-white"
                  : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as NotificationCategory | "all")}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
        >
          <option value="all">All Types</option>
          {SUPER_ADMIN_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {NOTIFICATION_CATEGORY_META[c].label}
            </option>
          ))}
        </select>
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
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-[var(--color-muted)]">
            <Bell size={22} strokeWidth={1.75} />
            <p className="text-sm">Nothing here.</p>
          </div>
        ) : (
          filtered.map((n) => (
            <NotificationCard
              key={n.id}
              notification={n}
              actions={
                busyId === n.id ? (
                  <Loader2 size={15} className="spinner text-[var(--color-muted)]" />
                ) : (
                  <>
                    {n.status === "unread" && (
                      <button
                        type="button"
                        onClick={() => void handleMarkAsRead(n.id)}
                        title="Mark as read"
                        className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)] hover:text-[var(--color-foreground)]"
                      >
                        <Check size={14} />
                      </button>
                    )}
                    {n.status !== "archived" && (
                      <button
                        type="button"
                        onClick={() => void handleArchive(n.id)}
                        title="Archive"
                        className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)] hover:text-[var(--color-foreground)]"
                      >
                        <Archive size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleDelete(n.id)}
                      title="Delete"
                      className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)]"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )
              }
            />
          ))
        )}
      </div>
    </div>
  );
}

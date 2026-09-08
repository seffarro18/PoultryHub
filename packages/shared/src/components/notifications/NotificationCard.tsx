import type { ReactNode } from "react";
import { NOTIFICATION_CATEGORY_META, type AppNotification } from "../../types/notification";

const SEVERITY_STYLES: Record<AppNotification["severity"], { bg: string; text: string }> = {
  info: { bg: "bg-[var(--color-primary)]/10", text: "text-[var(--color-primary)]" },
  warning: { bg: "bg-[var(--color-warning)]/10", text: "text-[var(--color-warning)]" },
  critical: { bg: "bg-[var(--color-danger)]/10", text: "text-[var(--color-danger)]" },
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

interface NotificationCardProps {
  notification: AppNotification;
  actions?: ReactNode;
  onClick?: () => void;
}

export default function NotificationCard({ notification, actions, onClick }: NotificationCardProps) {
  const { icon: Icon, label } = NOTIFICATION_CATEGORY_META[notification.category];
  const { bg, text } = SEVERITY_STYLES[notification.severity];
  const isUnread = notification.status === "unread";

  return (
    <div
      onClick={onClick}
      className={[
        "flex items-start gap-3 border-b border-[var(--color-border)] px-4 py-3.5 last:border-0",
        onClick ? "cursor-pointer hover:bg-[var(--color-muted-bg)]" : "",
      ].join(" ")}
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${bg} ${text}`}>
        <Icon size={16} strokeWidth={2} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {isUnread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-primary)]" aria-hidden="true" />}
          <p className={`truncate text-sm ${isUnread ? "font-semibold text-[var(--color-foreground)]" : "font-medium text-[var(--color-foreground)]"}`}>
            {notification.title}
          </p>
        </div>
        <p className="mt-0.5 text-sm text-[var(--color-muted)]">{notification.message}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--color-muted)]">
          <span>{label}</span>
          {notification.farmName && (
            <>
              <span aria-hidden="true">·</span>
              <span>{notification.farmName}</span>
            </>
          )}
          <span aria-hidden="true">·</span>
          <span>{timeAgo(notification.createdAt)}</span>
        </div>
      </div>

      {actions && (
        <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {actions}
        </div>
      )}
    </div>
  );
}

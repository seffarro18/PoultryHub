import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { listFarmStaff, type StaffMember } from "@poultryhub/shared/services/staffService";
import { sendNotificationToStaff } from "@poultryhub/shared/services/notificationService";
import { listNotificationTemplates } from "@poultryhub/shared/services/emailSettingsService";
import { NOTIFICATION_CATEGORY_META, STAFF_SENDABLE_CATEGORIES, type NotificationCategory } from "@poultryhub/shared/types/notification";

interface SendNotificationDrawerProps {
  fixedFarmId: string;
  onClose: () => void;
  onSent: () => void;
}

const ALL_STAFF = "__all__";

export default function SendNotificationDrawer({ fixedFarmId, onClose, onSent }: SendNotificationDrawerProps) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [recipient, setRecipient] = useState(ALL_STAFF);
  const [category, setCategory] = useState<NotificationCategory>(STAFF_SENDABLE_CATEGORIES[0]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [templates, setTemplates] = useState<Partial<Record<NotificationCategory, { title: string; message: string }>>>({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listFarmStaff()
      .then((rows) => setStaff(rows.filter((s) => s.farmId === fixedFarmId && s.status === "active")))
      .catch((err) => console.error("[SendNotificationDrawer] failed to load staff:", err));
  }, [fixedFarmId]);

  useEffect(() => {
    listNotificationTemplates()
      .then((rows) => {
        const map: Partial<Record<NotificationCategory, { title: string; message: string }>> = {};
        for (const row of rows) map[row.category] = { title: row.title, message: row.message };
        setTemplates(map);
        const template = map[category];
        if (template) {
          setTitle(template.title);
          setMessage(template.message);
        }
      })
      .catch((err) => console.error("[SendNotificationDrawer] failed to load templates:", err));
    // Only prefills once, for the category the drawer opens with — further changes are handled by handleCategoryChange.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCategoryChange = (next: NotificationCategory) => {
    setCategory(next);
    const template = templates[next];
    setTitle(template?.title ?? "");
    setMessage(template?.message ?? "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      setError("Title and message are required.");
      return;
    }
    const recipientIds = recipient === ALL_STAFF ? staff.map((s) => s.id) : [recipient];
    if (recipientIds.length === 0) {
      setError("No staff to notify yet.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      await sendNotificationToStaff({ farmId: fixedFarmId, recipientIds, category, title: title.trim(), message: message.trim() });
      onSent();
    } catch (err) {
      console.error("[SendNotificationDrawer] send failed:", err);
      setError("Couldn't send this notification. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <h2 className="font-display text-base font-semibold text-[var(--color-foreground)]">Send Notification</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)]"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex flex-col gap-4 px-5 py-4">
            {error && (
              <p className="rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">{error}</p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="recipient" className="text-sm font-medium text-[var(--color-foreground)]">
                  Recipient
                </label>
                <select
                  id="recipient"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
                >
                  <option value={ALL_STAFF}>All Staff ({staff.length})</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="category" className="text-sm font-medium text-[var(--color-foreground)]">
                  Type
                </label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => handleCategoryChange(e.target.value as NotificationCategory)}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
                >
                  {STAFF_SENDABLE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {NOTIFICATION_CATEGORY_META[c].label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="notif-title" className="text-sm font-medium text-[var(--color-foreground)]">
                Title
              </label>
              <input
                id="notif-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Vaccinate Pen 3 by Friday"
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="notif-message" className="text-sm font-medium text-[var(--color-foreground)]">
                Message
              </label>
              <textarea
                id="notif-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                className="resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3.5 py-2 text-sm font-medium text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sending}
              className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
            >
              {sending && <Loader2 size={14} className="spinner" />}
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

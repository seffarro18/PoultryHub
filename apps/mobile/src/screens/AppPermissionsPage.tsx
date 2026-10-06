import { useEffect, useState } from "react";
import { Bell, Camera, CheckCircle2, MapPin, XCircle } from "lucide-react";
import AccountScreenHeader from "../components/AccountScreenHeader";
import {
  getCameraStatus,
  getLocationStatus,
  getNotificationStatus,
  openAppSettings,
  openNotificationSettings,
  type PermissionStatus,
} from "../lib/permissions";

interface PermissionRowConfig {
  key: string;
  icon: typeof Bell;
  label: string;
  description: string;
  getStatus: () => Promise<PermissionStatus>;
  openSettings: () => Promise<void>;
}

const ROWS: PermissionRowConfig[] = [
  {
    key: "notifications",
    icon: Bell,
    label: "Notifications",
    description: "Used for the optional daily egg-collection reminder and alerts for new activity while the app is open.",
    getStatus: getNotificationStatus,
    openSettings: openNotificationSettings,
  },
  {
    key: "location",
    icon: MapPin,
    label: "Location",
    description: "Used only when a Farm Admin taps \"Use My Current Location\" while setting their farm's location.",
    getStatus: getLocationStatus,
    openSettings: openAppSettings,
  },
  {
    key: "camera",
    icon: Camera,
    label: "Camera",
    description: "Used only when you tap \"Take Photo\" for a profile photo or a mortality record's supporting photo.",
    getStatus: getCameraStatus,
    openSettings: openAppSettings,
  },
];

function statusLabel(status: PermissionStatus): string {
  if (status === "granted") return "Allowed";
  if (status === "prompt") return "Not yet requested";
  return "Not allowed";
}

function StatusPill({ status }: { status: PermissionStatus }) {
  if (status === "granted") {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-[var(--color-primary)]/10 px-2.5 py-1 text-xs font-medium text-[var(--color-primary)]">
        <CheckCircle2 size={13} /> {statusLabel(status)}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-[var(--color-muted-bg)] px-2.5 py-1 text-xs font-medium text-[var(--color-muted)]">
      <XCircle size={13} /> {statusLabel(status)}
    </span>
  );
}

/** Status-only display — every getStatus() call here is a checkPermissions() read, never a request. Nothing on this page can trigger an OS permission dialog; enabling something happens at its actual point of use (the Reminders toggle, the location picker, "Take Photo"). */
export default function AppPermissionsPage() {
  const [statuses, setStatuses] = useState<Record<string, PermissionStatus>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all(ROWS.map((row) => row.getStatus().then((status) => [row.key, status] as const)))
      .then((results) => {
        if (cancelled) return;
        setStatuses(Object.fromEntries(results));
      })
      .catch((err) => console.error("[AppPermissionsPage] failed to load permission statuses:", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <AccountScreenHeader title="App Permissions" subtitle="What PoultryHub can access on this device, and why." />

      <div className="flex flex-col gap-3">
        {ROWS.map((row) => {
          const Icon = row.icon;
          const status = statuses[row.key];
          return (
            <div key={row.key} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                    <Icon size={16} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-foreground)]">{row.label}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-[var(--color-muted)]">{row.description}</p>
                  </div>
                </div>
                {!loading && status && <StatusPill status={status} />}
              </div>

              {!loading && status !== "granted" && (
                <button
                  type="button"
                  onClick={() => void row.openSettings()}
                  className="mt-3 text-xs font-semibold text-[var(--color-primary)] underline underline-offset-2"
                >
                  Open Settings
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

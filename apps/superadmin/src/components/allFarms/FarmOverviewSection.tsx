import { useMemo } from "react";
import { CircleDollarSign, Egg, Receipt, Skull } from "lucide-react";
import { getFarmRecentActivity, type ActivityType, type AllFarmsBulkData } from "@poultryhub/shared/services/farmMonitoringService";

interface FarmOverviewSectionProps {
  data: AllFarmsBulkData;
  farmId: string;
}

const ACTIVITY_ICON: Record<ActivityType, typeof Egg> = {
  production: Egg,
  mortality: Skull,
  sale: CircleDollarSign,
  expense: Receipt,
};

/** "Most important farm statistics" already live in the KPI block above this tab strip — this tab's own job is the recent-activity feed, a single merged timeline across every module for this one farm. */
export default function FarmOverviewSection({ data, farmId }: FarmOverviewSectionProps) {
  const activity = useMemo(() => getFarmRecentActivity(data, farmId), [data, farmId]);

  return (
    <div>
      <h3 className="font-display text-sm font-semibold text-[var(--color-foreground)]">Recent Activity</h3>
      <div className="mt-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
        {activity.length === 0 ? (
          <div className="py-16 text-center text-sm text-[var(--color-muted)]">No activity recorded for this farm yet.</div>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {activity.map((item) => {
              const Icon = ACTIVITY_ICON[item.type];
              return (
                <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                    <Icon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--color-foreground)]">{item.title}</p>
                    <p className="text-xs text-[var(--color-muted)]">{item.detail}</p>
                  </div>
                  <span className="shrink-0 text-xs text-[var(--color-muted)]">
                    {new Date(`${item.date}T00:00:00`).toLocaleDateString()}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

import { useMemo } from "react";
import { UserCheck, UserRound, UserX, UsersRound } from "lucide-react";
import AccountStatusBadge from "@poultryhub/shared/components/users/AccountStatusBadge";
import StatTile from "@poultryhub/shared/components/production/StatTile";
import { getFarmStaffCounts, getFarmStaffRoster, type AllFarmsBulkData } from "@poultryhub/shared/services/farmMonitoringService";

interface FarmStaffSectionProps {
  data: AllFarmsBulkData;
  farmId: string;
}

export default function FarmStaffSection({ data, farmId }: FarmStaffSectionProps) {
  const roster = useMemo(() => getFarmStaffRoster(data, farmId), [data, farmId]);
  const counts = useMemo(() => getFarmStaffCounts(data, farmId), [data, farmId]);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile icon={UsersRound} label="Total Staff" value={counts.total} />
        <StatTile icon={UserCheck} label="Active Staff" value={counts.active} />
        <StatTile icon={UserX} label="Inactive Staff" value={counts.inactive} />
      </div>

      <div>
        <h3 className="font-display text-sm font-semibold text-[var(--color-foreground)]">Farm Admin</h3>
        {roster.admins.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-sm text-[var(--color-muted)]">
            No Farm Admin assigned yet.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {roster.admins.map((admin) => (
              <div key={admin.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                    <UserRound size={16} />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-[var(--color-foreground)]">{admin.name}</p>
                    <p className="text-xs text-[var(--color-muted)]">
                      {admin.role} · {admin.email}
                    </p>
                  </div>
                </div>
                <AccountStatusBadge status={admin.status} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="font-display text-sm font-semibold text-[var(--color-foreground)]">Staff Members</h3>
        <div className="mt-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
          {roster.staff.length === 0 ? (
            <div className="py-16 text-center text-sm text-[var(--color-muted)]">No staff on this farm yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-muted)]">
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.staff.map((member) => (
                    <tr key={member.id} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="px-4 py-3 text-[var(--color-foreground)]">{member.name}</td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{member.email}</td>
                      <td className="px-4 py-3">
                        <AccountStatusBadge status={member.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

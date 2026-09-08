import { useEffect, useMemo, useState } from "react";
import { AlertCircle, HeartPulse, Loader2, Pencil, Plus, ShieldAlert, Stethoscope } from "lucide-react";
import { listHealthRecords } from "@poultryhub/shared/services/healthRecordService";
import HealthRecordFormDrawer from "../components/health/HealthRecordFormDrawer";
import ProductionStatusBadge from "@poultryhub/shared/components/production/ProductionStatusBadge";
import StatTile from "@poultryhub/shared/components/production/StatTile";
import { useAuth } from "@poultryhub/shared/context/AuthContext";
import type { HealthRecord } from "@poultryhub/shared/types/health";

export default function StaffHealthRecordsPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<HealthRecord | null | "new">(null);

  const refresh = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setRecords(await listHealthRecords());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load health records.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.farmId) void refresh();
    else setIsLoading(false);
  }, [user?.farmId]);

  const myRecords = useMemo(() => records.filter((r) => r.recordedById === user?.id), [records, user?.id]);
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = useMemo(() => myRecords.filter((r) => r.recordDate === today).length, [myRecords, today]);
  const pendingCount = useMemo(() => myRecords.filter((r) => r.status === "pending").length, [myRecords]);

  if (!user?.farmId) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-6 py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-warning)]/10 text-[var(--color-warning)]">
          <ShieldAlert size={26} strokeWidth={1.75} />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold text-[var(--color-foreground)]">Not assigned to a farm yet</h2>
          <p className="mt-1.5 max-w-sm text-sm text-[var(--color-muted)]">
            Ask your Super Admin to assign your account to a farm before you can record health observations.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold text-[var(--color-foreground)]">Health Monitoring</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">Record health observations — a Farm Admin reviews each entry before it's official.</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-3.5 py-2 text-sm font-semibold text-white"
        >
          <Plus size={15} /> Record Observation
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatTile icon={HeartPulse} label="Reported Today" value={todayCount} />
        <StatTile icon={Stethoscope} label="Pending Review" value={pendingCount} />
      </div>

      <div>
        <h2 className="font-display text-base font-semibold text-[var(--color-foreground)]">My Records</h2>
        <div className="mt-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-[var(--color-muted)]">
              <Loader2 size={16} className="spinner" /> Loading records…
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <AlertCircle size={20} className="text-[var(--color-danger)]" />
              <p className="text-sm text-[var(--color-foreground)]">{loadError}</p>
            </div>
          ) : myRecords.length === 0 ? (
            <div className="py-16 text-center text-sm text-[var(--color-muted)]">No records yet — record today's observations to get started.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-muted)]">
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">House/Pen</th>
                    <th className="px-4 py-3 font-medium">Disease/Condition</th>
                    <th className="px-4 py-3 font-medium">Affected</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {myRecords.map((record) => (
                    <tr key={record.id} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="px-4 py-3 text-[var(--color-foreground)]">{new Date(`${record.recordDate}T00:00:00`).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{record.housePen}</td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{record.diseaseCondition}</td>
                      <td className="px-4 py-3 text-[var(--color-foreground)]">{record.affectedBirds}</td>
                      <td className="px-4 py-3">
                        <ProductionStatusBadge status={record.status} />
                        {record.status === "rejected" && record.reviewNotes && (
                          <p className="mt-1 max-w-[220px] text-xs text-[var(--color-danger)]">{record.reviewNotes}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {record.status !== "approved" ? (
                          <button
                            type="button"
                            onClick={() => setEditing(record)}
                            title="Edit"
                            className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)] hover:text-[var(--color-foreground)]"
                          >
                            <Pencil size={14} />
                          </button>
                        ) : (
                          <span className="text-xs text-[var(--color-muted)]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {editing !== null && (
        <HealthRecordFormDrawer
          record={editing === "new" ? null : editing}
          fixedFarmId={user.farmId}
          useResubmitFlow={editing !== "new"}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void refresh();
          }}
        />
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bird, Check, Download, HeartPulse, Loader2, Pencil, Plus, ShieldAlert, ShieldCheck, Stethoscope, Trash2, X } from "lucide-react";
import {
  approveHealthRecord,
  deleteHealthRecord,
  listHealthRecords,
  rejectHealthRecord,
  untreatedOpenCases,
  vaccinationFollowUpFarms,
} from "@poultryhub/shared/services/healthRecordService";
import { downloadCsv } from "@poultryhub/shared/lib/exportCsv";
import HealthRecordFormDrawer from "../components/health/HealthRecordFormDrawer";
import PageBackButton from "../components/PageBackButton";
import ProductionStatusBadge from "@poultryhub/shared/components/production/ProductionStatusBadge";
import StatTile from "@poultryhub/shared/components/production/StatTile";
import { useAuth } from "@poultryhub/shared/context/AuthContext";
import { treatmentStatus, vaccinationStatus, type HealthRecord } from "@poultryhub/shared/types/health";

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function FarmHealthRecordsPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
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

  const today = todayIso();
  const approved = useMemo(() => records.filter((r) => r.status === "approved"), [records]);
  const todaysReports = useMemo(() => records.filter((r) => r.recordDate === today).length, [records, today]);
  const sickToday = useMemo(() => approved.filter((r) => r.recordDate === today).reduce((sum, r) => sum + r.affectedBirds, 0), [approved, today]);
  const pendingCount = useMemo(() => records.filter((r) => r.status === "pending").length, [records]);
  const untreated = useMemo(() => untreatedOpenCases(records), [records]);
  const followUp = useMemo(() => vaccinationFollowUpFarms(records), [records]);

  const handleApprove = async (record: HealthRecord) => {
    setBusyId(record.id);
    try {
      await approveHealthRecord(record.id);
      await refresh();
    } catch (err) {
      console.error("[FarmHealthRecordsPage] approve failed:", err);
      alert(err instanceof Error ? err.message : "Couldn't approve that record.");
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (record: HealthRecord) => {
    const comment = window.prompt("Reason for rejecting this record (shown to the staff member who recorded it):");
    if (!comment || !comment.trim()) return;
    setBusyId(record.id);
    try {
      await rejectHealthRecord(record.id, comment.trim());
      await refresh();
    } catch (err) {
      console.error("[FarmHealthRecordsPage] reject failed:", err);
      alert("Couldn't reject that record.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (record: HealthRecord) => {
    if (!window.confirm(`Delete this ${record.diseaseCondition} record for ${record.housePen}?`)) return;
    setBusyId(record.id);
    try {
      await deleteHealthRecord(record.id);
      setRecords((prev) => prev.filter((r) => r.id !== record.id));
    } catch (err) {
      console.error("[FarmHealthRecordsPage] delete failed:", err);
      alert("Couldn't delete this record.");
    } finally {
      setBusyId(null);
    }
  };

  const handleExport = () => {
    downloadCsv(
      `health-records-${today}.csv`,
      records.map((r) => ({
        Date: r.recordDate,
        "House/Pen": r.housePen,
        "Disease/Condition": r.diseaseCondition,
        "Affected Birds": r.affectedBirds,
        "Treatment Status": treatmentStatus(r),
        "Vaccination Status": vaccinationStatus(r),
        "Recorded By": r.recordedByName ?? "",
        Status: r.status,
      }))
    );
  };

  if (!user?.farmId) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-6 py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-warning)]/10 text-[var(--color-warning)]">
          <ShieldAlert size={26} strokeWidth={1.75} />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold text-[var(--color-foreground)]">Not assigned to a farm yet</h2>
          <p className="mt-1.5 max-w-sm text-sm text-[var(--color-muted)]">
            Ask your Super Admin to assign your account to a farm before you can manage health records.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <PageBackButton />
            <h1 className="font-display text-xl font-semibold text-[var(--color-foreground)]">Health Records</h1>
          </div>
          <p className="mt-1 text-sm text-[var(--color-muted)]">Review staff reports and manage health records for your farm.</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-3.5 py-2 text-sm font-semibold text-white"
        >
          <Plus size={15} /> Record Health Observation
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        <StatTile icon={Bird} label="Healthy (Approved)" value={approved.length} />
        <StatTile icon={Stethoscope} label="Sick Today" value={sickToday} />
        <StatTile icon={HeartPulse} label="Today's Reports" value={todaysReports} />
        <StatTile icon={AlertTriangle} label="Pending Review" value={pendingCount} />
        <StatTile icon={ShieldCheck} label="Untreated Open Cases" value={untreated.length} />
      </div>

      {(untreated.length > 0 || followUp.length > 0) && (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <h2 className="font-display text-sm font-semibold text-[var(--color-foreground)]">Alerts</h2>
          <div className="mt-3 flex flex-col divide-y divide-[var(--color-border)]">
            {untreated.slice(0, 5).map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="text-[var(--color-foreground)]">{r.diseaseCondition} · {r.housePen}</span>
                <span className="text-xs text-[var(--color-warning)]">Treatment incomplete</span>
              </div>
            ))}
            {followUp.map((f) => (
              <div key={f.farmId} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="text-[var(--color-foreground)]">Vaccination follow-up needed</span>
                <span className="text-xs text-[var(--color-muted)]">
                  {f.daysSinceLastVaccination === null ? "Never recorded" : `${f.daysSinceLastVaccination} days ago`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-base font-semibold text-[var(--color-foreground)]">Health Records</h2>
          <button type="button" onClick={handleExport} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]">
            <Download size={13} /> Export CSV
          </button>
        </div>

        {isLoading ? (
          <div className="mt-3 flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-16 text-sm text-[var(--color-muted)]">
            <Loader2 size={16} className="spinner" /> Loading…
          </div>
        ) : loadError ? (
          <div className="mt-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-16 text-center text-sm text-[var(--color-danger)]">{loadError}</div>
        ) : (
          <div className="mt-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
            {records.length === 0 ? (
              <div className="py-16 text-center text-sm text-[var(--color-muted)]">No health records yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-muted)]">
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">House/Pen</th>
                      <th className="px-4 py-3 font-medium">Disease/Condition</th>
                      <th className="px-4 py-3 font-medium">Affected</th>
                      <th className="px-4 py-3 font-medium">Treatment</th>
                      <th className="px-4 py-3 font-medium">Vaccination</th>
                      <th className="px-4 py-3 font-medium">Recorded By</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r) => (
                      <tr key={r.id} className="border-b border-[var(--color-border)] last:border-0">
                        <td className="px-4 py-3 text-[var(--color-foreground)]">{new Date(`${r.recordDate}T00:00:00`).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-[var(--color-muted)]">{r.housePen}</td>
                        <td className="px-4 py-3 text-[var(--color-foreground)]">{r.diseaseCondition}</td>
                        <td className="px-4 py-3 text-[var(--color-muted)]">{r.affectedBirds}</td>
                        <td className="px-4 py-3 text-[var(--color-muted)]">{treatmentStatus(r)}</td>
                        <td className="px-4 py-3 text-[var(--color-muted)]">{vaccinationStatus(r)}</td>
                        <td className="px-4 py-3 text-[var(--color-muted)]">{r.recordedByName ?? "—"}</td>
                        <td className="px-4 py-3">
                          <ProductionStatusBadge status={r.status} />
                        </td>
                        <td className="px-4 py-3">
                          {busyId === r.id ? (
                            <Loader2 size={15} className="spinner text-[var(--color-muted)]" />
                          ) : (
                            <div className="flex items-center gap-1">
                              {r.status === "pending" && (
                                <>
                                  <button type="button" onClick={() => void handleApprove(r)} title="Approve" className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-[var(--color-success)] hover:bg-[var(--color-success)]/10">
                                    <Check size={13} /> Approve
                                  </button>
                                  <button type="button" onClick={() => void handleReject(r)} title="Reject" className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10">
                                    <X size={13} /> Reject
                                  </button>
                                </>
                              )}
                              <button type="button" onClick={() => setEditing(r)} title="Edit" className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)] hover:text-[var(--color-foreground)]">
                                <Pencil size={14} />
                              </button>
                              <button type="button" onClick={() => void handleDelete(r)} title="Delete" className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)]">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {editing !== null && user.farmId && (
        <HealthRecordFormDrawer
          record={editing === "new" ? null : editing}
          fixedFarmId={user.farmId}
          preApproved
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

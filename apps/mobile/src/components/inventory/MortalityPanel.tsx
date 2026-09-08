import { useMemo, useState } from "react";
import { AlertTriangle, Check, Loader2, Pencil, Plus, Skull, Trash2, X } from "lucide-react";
import { approveMortalityRecord, deleteMortalityRecord, rejectMortalityRecord } from "@poultryhub/shared/services/mortalityRecordService";
import MortalityRecordFormDrawer from "../health/MortalityRecordFormDrawer";
import ProductionStatusBadge from "@poultryhub/shared/components/production/ProductionStatusBadge";
import StatTile from "@poultryhub/shared/components/production/StatTile";
import type { MortalityRecord } from "@poultryhub/shared/types/mortality";

const todayIso = () => new Date().toISOString().slice(0, 10);

interface MortalityPanelProps {
  farmId: string;
  records: MortalityRecord[];
  refresh: () => Promise<void>;
}

export default function MortalityPanel({ farmId, records, refresh }: MortalityPanelProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<MortalityRecord | null | "new">(null);

  const today = todayIso();
  const approved = useMemo(() => records.filter((r) => r.status === "approved"), [records]);
  const todaysCount = useMemo(() => approved.filter((r) => r.recordDate === today).reduce((sum, r) => sum + r.deadBirds, 0), [approved, today]);
  const pendingCount = useMemo(() => records.filter((r) => r.status === "pending").length, [records]);
  const totalApproved = useMemo(() => approved.reduce((sum, r) => sum + r.deadBirds, 0), [approved]);

  const handleApprove = async (record: MortalityRecord) => {
    setBusyId(record.id);
    try {
      await approveMortalityRecord(record.id);
      await refresh();
    } catch (err) {
      console.error("[MortalityPanel] approve failed:", err);
      alert(err instanceof Error ? err.message : "Couldn't approve that record.");
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (record: MortalityRecord) => {
    const comment = window.prompt("Reason for rejecting this record (shown to the staff member who recorded it):");
    if (!comment || !comment.trim()) return;
    setBusyId(record.id);
    try {
      await rejectMortalityRecord(record.id, comment.trim());
      await refresh();
    } catch (err) {
      console.error("[MortalityPanel] reject failed:", err);
      alert("Couldn't reject that record.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (record: MortalityRecord) => {
    if (!window.confirm(`Delete this mortality record for ${record.housePen}?`)) return;
    setBusyId(record.id);
    try {
      await deleteMortalityRecord(record.id);
      await refresh();
    } catch (err) {
      console.error("[MortalityPanel] delete failed:", err);
      alert("Couldn't delete this record.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-3.5 py-2 text-sm font-semibold text-white"
        >
          <Plus size={15} /> Record Mortality
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile icon={Skull} label="Today's Mortality" value={todaysCount} />
        <StatTile icon={Skull} label="Total Recorded (Approved)" value={totalApproved} />
        <StatTile icon={AlertTriangle} label="Pending Review" value={pendingCount} />
        <StatTile icon={Skull} label="Records Logged" value={records.length} />
      </div>

      <div>
        <h2 className="font-display text-base font-semibold text-[var(--color-foreground)]">Mortality Records</h2>

        <div className="mt-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
          {records.length === 0 ? (
            <div className="py-16 text-center text-sm text-[var(--color-muted)]">No mortality records yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-muted)]">
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">House/Pen</th>
                    <th className="px-4 py-3 font-medium">Poultry Type</th>
                    <th className="px-4 py-3 font-medium">Dead Birds</th>
                    <th className="px-4 py-3 font-medium">Cause of Death</th>
                    <th className="px-4 py-3 font-medium">Disposal</th>
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
                      <td className="px-4 py-3 text-[var(--color-muted)]">{r.birdType ?? "—"}</td>
                      <td className="px-4 py-3 text-[var(--color-foreground)]">{r.deadBirds}</td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{r.causeOfDeath}</td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{r.disposalMethod ?? "—"}</td>
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
      </div>

      {editing !== null && (
        <MortalityRecordFormDrawer
          record={editing === "new" ? null : editing}
          fixedFarmId={farmId}
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

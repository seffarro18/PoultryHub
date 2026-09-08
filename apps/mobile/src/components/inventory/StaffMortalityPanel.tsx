import { useMemo, useState } from "react";
import { Pencil, Plus, Skull } from "lucide-react";
import MortalityRecordFormDrawer from "../health/MortalityRecordFormDrawer";
import ProductionStatusBadge from "@poultryhub/shared/components/production/ProductionStatusBadge";
import StatTile from "@poultryhub/shared/components/production/StatTile";
import type { MortalityRecord } from "@poultryhub/shared/types/mortality";

interface StaffMortalityPanelProps {
  farmId: string;
  userId: string;
  records: MortalityRecord[];
  refresh: () => Promise<void>;
}

export default function StaffMortalityPanel({ farmId, userId, records, refresh }: StaffMortalityPanelProps) {
  const [editing, setEditing] = useState<MortalityRecord | null | "new">(null);

  const myRecords = useMemo(() => records.filter((r) => r.recordedById === userId), [records, userId]);
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = useMemo(() => myRecords.filter((r) => r.recordDate === today).reduce((sum, r) => sum + r.deadBirds, 0), [myRecords, today]);
  const pendingCount = useMemo(() => myRecords.filter((r) => r.status === "pending").length, [myRecords]);

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatTile icon={Skull} label="Reported Today" value={todayCount} />
        <StatTile icon={Skull} label="Pending Review" value={pendingCount} />
      </div>

      <div>
        <h2 className="font-display text-base font-semibold text-[var(--color-foreground)]">My Records</h2>
        <div className="mt-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
          {myRecords.length === 0 ? (
            <div className="py-16 text-center text-sm text-[var(--color-muted)]">No records yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-muted)]">
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">House/Pen</th>
                    <th className="px-4 py-3 font-medium">Poultry Type</th>
                    <th className="px-4 py-3 font-medium">Dead Birds</th>
                    <th className="px-4 py-3 font-medium">Cause of Death</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {myRecords.map((record) => (
                    <tr key={record.id} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="px-4 py-3 text-[var(--color-foreground)]">{new Date(`${record.recordDate}T00:00:00`).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{record.housePen}</td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{record.birdType ?? "—"}</td>
                      <td className="px-4 py-3 text-[var(--color-foreground)]">{record.deadBirds}</td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{record.causeOfDeath}</td>
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
        <MortalityRecordFormDrawer
          record={editing === "new" ? null : editing}
          fixedFarmId={farmId}
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

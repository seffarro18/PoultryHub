import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { CalendarDays, CalendarRange, Egg, Pencil, Plus, ShieldAlert } from "lucide-react";
import { listEggProductionRecords, summarizePeriods } from "@poultryhub/shared/services/eggProductionService";
import EggProductionFormDrawer from "../components/production/EggProductionFormDrawer";
import ProductionStatusBadge from "@poultryhub/shared/components/production/ProductionStatusBadge";
import StatTile from "@poultryhub/shared/components/production/StatTile";
import Button from "@poultryhub/shared/components/ui/Button";
import { SkeletonCard } from "@poultryhub/shared/components/ui/Skeleton";
import EmptyState from "@poultryhub/shared/components/ui/EmptyState";
import ErrorState from "@poultryhub/shared/components/ui/ErrorState";
import { StaggerGroup, StaggerItem } from "@poultryhub/shared/components/motion/Stagger";
import type { EggProductionRecord } from "@poultryhub/shared/types/eggProduction";
import { useAuth } from "@poultryhub/shared/context/AuthContext";

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">{label}</p>
      <p className="text-sm font-semibold text-[var(--color-foreground)]">{value.toLocaleString()}</p>
    </div>
  );
}

export default function StaffEggProductionPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<EggProductionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<EggProductionRecord | null | "new">(null);

  const refresh = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setRecords(await listEggProductionRecords());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Couldn't load your records.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.farmId) void refresh();
    else setIsLoading(false);
  }, [user?.farmId]);

  const myRecords = useMemo(() => records.filter((r) => r.recordedById === user?.id), [records, user?.id]);
  const { dailyTotal, weeklyTotal, monthlyTotal } = summarizePeriods(myRecords);

  if (!user?.farmId) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-6 py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-warning)]/10 text-[var(--color-warning)]">
          <ShieldAlert size={26} strokeWidth={1.75} />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold text-[var(--color-foreground)]">
            Not assigned to a farm yet
          </h2>
          <p className="mt-1.5 max-w-sm text-sm text-[var(--color-muted)]">
            Ask your Super Admin to assign your account to a farm before you can record egg production.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold text-[var(--color-foreground)]">Egg Production</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Record daily egg collection — a Farm Admin reviews each entry before it's official.
          </p>
        </div>
        <Button variant="primary" icon={Plus} onClick={() => setEditingRecord("new")}>
          Record Collection
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile icon={Egg} label="Today" value={dailyTotal} />
        <StatTile icon={CalendarRange} label="This Week" value={weeklyTotal} />
        <StatTile icon={CalendarDays} label="This Month" value={monthlyTotal} />
      </div>

      <div>
        <h2 className="font-display text-base font-semibold text-[var(--color-foreground)]">My Records</h2>

        <div className="mt-3">
          {isLoading ? (
            <div className="flex flex-col gap-3">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : loadError ? (
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
              <ErrorState message={loadError} onRetry={refresh} />
            </div>
          ) : myRecords.length === 0 ? (
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
              <EmptyState
                icon={Egg}
                title="No records yet"
                description="Record today's collection to start tracking your farm's egg production."
                action={{ label: "Record Collection", onClick: () => setEditingRecord("new") }}
              />
            </div>
          ) : (
            <StaggerGroup className="flex flex-col gap-3">
              {myRecords.map((record) => (
                <StaggerItem key={record.id} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--color-foreground)]">
                        {new Date(`${record.productionDate}T00:00:00`).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-[var(--color-muted)]">{record.housePen}</p>
                    </div>
                    <ProductionStatusBadge status={record.status} />
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Stat label="Collected" value={record.eggsCollected} />
                    <Stat label="Good" value={record.goodEggs} />
                    <Stat label="Cracked" value={record.crackedEggs} />
                    <Stat label="Damaged" value={record.damagedEggs} />
                  </div>

                  {record.status === "rejected" && record.reviewNotes && (
                    <p className="mt-3 rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-xs text-[var(--color-danger)]">
                      {record.reviewNotes}
                    </p>
                  )}

                  {record.status !== "approved" && (
                    <div className="mt-3 flex items-center border-t border-[var(--color-border)] pt-3">
                      <Button variant="secondary" size="sm" icon={Pencil} onClick={() => setEditingRecord(record)}>
                        Edit
                      </Button>
                    </div>
                  )}
                </StaggerItem>
              ))}
            </StaggerGroup>
          )}
        </div>
      </div>

      <AnimatePresence>
        {editingRecord !== null && (
          <EggProductionFormDrawer
            record={editingRecord === "new" ? null : editingRecord}
            farms={[]}
            fixedFarmId={user.farmId}
            showSoldField={false}
            useResubmitFlow={editingRecord !== "new"}
            onClose={() => setEditingRecord(null)}
            onSaved={() => {
              setEditingRecord(null);
              void refresh();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

import { useMemo } from "react";
import { Bird, ClipboardList, Egg, Loader2, UsersRound, X } from "lucide-react";
import { currentStockByType } from "@poultryhub/shared/services/poultryInventoryService";
import StatTile from "@poultryhub/shared/components/production/StatTile";
import type { ManagedUser } from "@poultryhub/shared/services/userManagementService";
import type { EggProductionRecord } from "@poultryhub/shared/types/eggProduction";
import type { PoultryEvent } from "@poultryhub/shared/types/poultryInventory";
import type { MortalityRecord } from "@poultryhub/shared/types/mortality";
import type { ManagedFarm } from "@poultryhub/shared/types/farm";

interface FarmStatsDrawerProps {
  farm: ManagedFarm;
  isLoading: boolean;
  users: ManagedUser[];
  productionRecords: EggProductionRecord[];
  inventoryEvents: PoultryEvent[];
  mortalityRecords: MortalityRecord[];
  onClose: () => void;
}

export default function FarmStatsDrawer({
  farm,
  isLoading,
  users,
  productionRecords,
  inventoryEvents,
  mortalityRecords,
  onClose,
}: FarmStatsDrawerProps) {
  const staffCount = useMemo(
    () => users.filter((u) => u.farmId === farm.id && u.role === "Staff").length,
    [users, farm.id]
  );

  const farmProduction = useMemo(() => productionRecords.filter((r) => r.farmId === farm.id), [productionRecords, farm.id]);
  const approvedTotal = useMemo(
    () => farmProduction.filter((r) => r.status === "approved").reduce((sum, r) => sum + r.eggsCollected, 0),
    [farmProduction]
  );
  const pendingCount = useMemo(() => farmProduction.filter((r) => r.status === "pending").length, [farmProduction]);

  const farmEvents = useMemo(() => inventoryEvents.filter((e) => e.farmId === farm.id), [inventoryEvents, farm.id]);
  const farmMortalityRecords = useMemo(() => mortalityRecords.filter((r) => r.farmId === farm.id), [mortalityRecords, farm.id]);
  const totalStock = useMemo(() => {
    const byType = currentStockByType(farmEvents, farmMortalityRecords);
    return Object.values(byType).reduce((sum, v) => sum + v, 0);
  }, [farmEvents, farmMortalityRecords]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <div>
            <h2 className="font-display text-base font-semibold text-[var(--color-foreground)]">Farm Statistics</h2>
            <p className="mt-0.5 text-xs text-[var(--color-muted)]">{farm.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)]"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-[var(--color-muted)]">
              <Loader2 size={16} className="spinner" /> Loading statistics…
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <StatTile icon={UsersRound} label="Total Staff" value={staffCount} />
              <StatTile icon={Bird} label="Current Poultry Stock" value={totalStock} />
              <StatTile icon={Egg} label="Total Egg Production" value={approvedTotal} />
              <StatTile icon={ClipboardList} label="Pending Reviews" value={pendingCount} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

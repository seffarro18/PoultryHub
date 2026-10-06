import { useMemo } from "react";
import { AlertTriangle, Bird, Egg, Pill, Skull, Wheat } from "lucide-react";
import PoultryStockBreakdownChart from "@poultryhub/shared/components/inventory/PoultryStockBreakdownChart";
import ProductionStatusBadge from "@poultryhub/shared/components/production/ProductionStatusBadge";
import StatTile from "@poultryhub/shared/components/production/StatTile";
import FarmMortalityTrendChart from "./FarmMortalityTrendChart";
import {
  getFarmFeedBreakdown,
  getFarmLowStockCounts,
  getFarmMortalityCounts,
  getFarmMortalityTrend,
  getFarmPoultryStock,
  getFarmRecentMortality,
  getFarmVitaminBreakdown,
  type AllFarmsBulkData,
} from "@poultryhub/shared/services/farmMonitoringService";

interface FarmPoultryInventorySectionProps {
  data: AllFarmsBulkData;
  farmId: string;
}

export default function FarmPoultryInventorySection({ data, farmId }: FarmPoultryInventorySectionProps) {
  const farmEvents = useMemo(() => data.events.filter((e) => e.farmId === farmId), [data.events, farmId]);
  const farmMortality = useMemo(() => data.mortalityRecords.filter((r) => r.farmId === farmId), [data.mortalityRecords, farmId]);
  const poultryStock = useMemo(() => getFarmPoultryStock(data, farmId), [data, farmId]);
  const feedBreakdown = useMemo(() => getFarmFeedBreakdown(data, farmId), [data, farmId]);
  const vitaminBreakdown = useMemo(() => getFarmVitaminBreakdown(data, farmId), [data, farmId]);
  const lowStock = useMemo(() => getFarmLowStockCounts(data, farmId), [data, farmId]);
  const mortalityTrend = useMemo(() => getFarmMortalityTrend(data, farmId), [data, farmId]);
  const mortalityCounts = useMemo(() => getFarmMortalityCounts(data, farmId), [data, farmId]);
  const recentMortality = useMemo(() => getFarmRecentMortality(data, farmId), [data, farmId]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="font-display text-sm font-semibold text-[var(--color-foreground)]">Poultry Stock</h3>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatTile icon={Bird} label="Total Chickens" value={poultryStock.totalChickens} />
          <StatTile icon={Egg} label="Layers" value={poultryStock.layers} />
          <StatTile icon={Bird} label="Chicks" value={poultryStock.chicks} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-foreground)]">
            <Wheat size={16} className="text-[var(--color-primary)]" /> Feed Stock
          </div>
          {feedBreakdown.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-muted)]">No feed batches recorded for this farm yet.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-1.5 text-sm">
              {feedBreakdown.map((item) => (
                <li key={item.name} className="flex items-center justify-between gap-3">
                  <span className="text-[var(--color-muted)]">{item.name}</span>
                  <span className="font-medium text-[var(--color-foreground)]">{item.summary}</span>
                </li>
              ))}
            </ul>
          )}
          {lowStock.feed > 0 && (
            <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-[var(--color-warning)]">
              <AlertTriangle size={13} /> {lowStock.feed} item{lowStock.feed === 1 ? "" : "s"} at or below minimum stock level
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-foreground)]">
            <Pill size={16} className="text-[var(--color-primary)]" /> Vitamin Stock
          </div>
          {vitaminBreakdown.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-muted)]">No vitamin batches recorded for this farm yet.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-1.5 text-sm">
              {vitaminBreakdown.map((item) => (
                <li key={item.name} className="flex items-center justify-between gap-3">
                  <span className="text-[var(--color-muted)]">{item.name}</span>
                  <span className="font-medium text-[var(--color-foreground)]">{item.summary}</span>
                </li>
              ))}
            </ul>
          )}
          {lowStock.vitamin > 0 && (
            <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-[var(--color-warning)]">
              <AlertTriangle size={13} /> {lowStock.vitamin} item{lowStock.vitamin === 1 ? "" : "s"} at or below minimum stock level
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PoultryStockBreakdownChart events={farmEvents} mortalityRecords={farmMortality} />
        <FarmMortalityTrendChart data={mortalityTrend} />
      </div>

      <div>
        <h3 className="font-display text-sm font-semibold text-[var(--color-foreground)]">Mortality</h3>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatTile icon={Skull} label="Today's Mortality" value={mortalityCounts.today} />
          <StatTile icon={Skull} label="Mortality (7d)" value={mortalityCounts.last7d} />
          <StatTile icon={Skull} label="Mortality (30d)" value={mortalityCounts.last30d} />
        </div>
      </div>

      <div>
        <h3 className="font-display text-sm font-semibold text-[var(--color-foreground)]">Recent Mortality</h3>
        <div className="mt-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
          {recentMortality.length === 0 ? (
            <div className="py-16 text-center text-sm text-[var(--color-muted)]">No mortality records for this farm yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-muted)]">
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">House/Pen</th>
                    <th className="px-4 py-3 font-medium">Deaths</th>
                    <th className="px-4 py-3 font-medium">Cause of Death</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentMortality.map((r) => (
                    <tr key={r.id} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="px-4 py-3 text-[var(--color-muted)]">{r.recordDate}</td>
                      <td className="px-4 py-3 text-[var(--color-foreground)]">{r.housePen}</td>
                      <td className="px-4 py-3 text-[var(--color-foreground)]">{r.deadBirds}</td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{r.causeOfDeath ?? "—"}</td>
                      <td className="px-4 py-3">
                        <ProductionStatusBadge status={r.status} />
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

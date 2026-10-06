import { useMemo } from "react";
import { CircleCheck, ClipboardCheck, Egg, TriangleAlert } from "lucide-react";
import StatTile from "@poultryhub/shared/components/production/StatTile";
import ProductionStatusBadge from "@poultryhub/shared/components/production/ProductionStatusBadge";
import FarmEggProductionTrendChart from "./FarmEggProductionTrendChart";
import {
  getFarmEggProductionTrend,
  getFarmEggQuality,
  getFarmProductionByHousePen,
  getFarmProductionRecords,
  getFarmProductionTotals,
  type AllFarmsBulkData,
} from "@poultryhub/shared/services/farmMonitoringService";

interface FarmProductionSectionProps {
  data: AllFarmsBulkData;
  farmId: string;
}

export default function FarmProductionSection({ data, farmId }: FarmProductionSectionProps) {
  const dailyData = useMemo(() => getFarmEggProductionTrend(data, farmId, "daily"), [data, farmId]);
  const weeklyData = useMemo(() => getFarmEggProductionTrend(data, farmId, "weekly"), [data, farmId]);
  const monthlyData = useMemo(() => getFarmEggProductionTrend(data, farmId, "monthly"), [data, farmId]);
  const quality = useMemo(() => getFarmEggQuality(data, farmId), [data, farmId]);
  const totals = useMemo(() => getFarmProductionTotals(data, farmId), [data, farmId]);
  const byHousePen = useMemo(() => getFarmProductionByHousePen(data, farmId), [data, farmId]);
  const records = useMemo(() => getFarmProductionRecords(data, farmId), [data, farmId]);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={Egg} label="Total Eggs (All-Time, Approved)" value={totals.totalEggsAllTime} />
        <StatTile icon={ClipboardCheck} label="Approved Production Records" value={totals.approvedRecordCount} />
        <StatTile icon={CircleCheck} label="Good Eggs (Approved)" value={quality.goodEggs} />
        <StatTile icon={TriangleAlert} label="Damaged/Cracked (Approved)" value={quality.damagedCrackedEggs} />
      </div>

      <FarmEggProductionTrendChart dailyData={dailyData} weeklyData={weeklyData} monthlyData={monthlyData} />

      <div>
        <h3 className="font-display text-sm font-semibold text-[var(--color-foreground)]">Production by House/Pen</h3>
        <div className="mt-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
          {byHousePen.length === 0 ? (
            <div className="py-16 text-center text-sm text-[var(--color-muted)]">No approved production yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-muted)]">
                    <th className="px-4 py-3 font-medium">House/Pen</th>
                    <th className="px-4 py-3 font-medium">Total Eggs (Approved)</th>
                  </tr>
                </thead>
                <tbody>
                  {byHousePen.map((row) => (
                    <tr key={row.housePen} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="px-4 py-3 text-[var(--color-foreground)]">{row.housePen}</td>
                      <td className="px-4 py-3 text-[var(--color-foreground)]">{row.totalEggs.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div>
        <h3 className="font-display text-sm font-semibold text-[var(--color-foreground)]">Production Records</h3>
        <div className="mt-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
          {records.length === 0 ? (
            <div className="py-16 text-center text-sm text-[var(--color-muted)]">No egg production records for this farm yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-muted)]">
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">House/Pen</th>
                    <th className="px-4 py-3 font-medium">Collected</th>
                    <th className="px-4 py-3 font-medium">Good</th>
                    <th className="px-4 py-3 font-medium">Damaged/Cracked</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="px-4 py-3 text-[var(--color-muted)]">
                        {new Date(`${r.productionDate}T00:00:00`).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-foreground)]">{r.housePen}</td>
                      <td className="px-4 py-3 text-[var(--color-foreground)]">{r.eggsCollected.toLocaleString()}</td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{r.goodEggs.toLocaleString()}</td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{r.damagedCrackedEggs.toLocaleString()}</td>
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

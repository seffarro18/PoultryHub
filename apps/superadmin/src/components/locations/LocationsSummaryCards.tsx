import { useMemo } from "react";
import { Archive, Building2, CircleAlert, CircleCheck, Tractor } from "lucide-react";
import StatTile from "@poultryhub/shared/components/production/StatTile";
import type { ManagedFarm } from "@poultryhub/shared/types/farm";

/**
 * Always computed from every registered farm, not the currently-filtered set — these are platform-wide totals, not a filtered count.
 * Region/Province aren't shown here — PoultryHub only operates in Aurora, so both would always read "1". Municipalities Covered (out of Aurora's 8) is the meaningful geographic figure instead.
 */
export default function LocationsSummaryCards({ farms }: { farms: ManagedFarm[] }) {
  const stats = useMemo(() => {
    const municipalities = new Set(farms.map((f) => f.city).filter((c): c is string => Boolean(c))).size;
    return {
      total: farms.length,
      active: farms.filter((f) => f.status === "active").length,
      inactive: farms.filter((f) => f.status === "inactive").length,
      archived: farms.filter((f) => f.status === "archived").length,
      municipalities,
    };
  }, [farms]);

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      <StatTile icon={Tractor} label="Total Farms" value={stats.total} />
      <StatTile icon={CircleCheck} label="Active" value={stats.active} />
      <StatTile icon={CircleAlert} label="Inactive" value={stats.inactive} />
      <StatTile icon={Archive} label="Archived" value={stats.archived} />
      <StatTile icon={Building2} label="Municipalities Covered" value={stats.municipalities} />
    </div>
  );
}

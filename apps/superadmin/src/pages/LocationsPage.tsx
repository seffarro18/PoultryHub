import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Loader2, MapPinOff, Monitor } from "lucide-react";
import { listManagedFarms } from "@poultryhub/shared/services/farmService";
import { currentStockByType, listInventoryEvents } from "@poultryhub/shared/services/poultryInventoryService";
import { listMortalityRecords } from "@poultryhub/shared/services/mortalityRecordService";
import { FARMS_PATH } from "../config/navigation";
import { useBreakpoint } from "@poultryhub/shared/hooks/useBreakpoint";
import FarmMap from "../components/locations/FarmMap";
import MapLegend from "../components/locations/MapLegend";
import LocationsSummaryCards from "../components/locations/LocationsSummaryCards";
import LocationSearchBar from "../components/locations/LocationSearchBar";
import LocationFiltersPanel, {
  DEFAULT_LOCATION_FILTERS,
  applyLocationFilters,
  type LocationFilters,
} from "../components/locations/LocationFiltersPanel";
import SelectedFarmPanel from "../components/locations/SelectedFarmPanel";
import LocationsAnalytics from "../components/locations/LocationsAnalytics";
import type { PoultryEvent } from "@poultryhub/shared/types/poultryInventory";
import type { MortalityRecord } from "@poultryhub/shared/types/mortality";
import type { ManagedFarm } from "@poultryhub/shared/types/farm";

export default function LocationsPage() {
  const navigate = useNavigate();
  const breakpoint = useBreakpoint();

  const [farms, setFarms] = useState<ManagedFarm[]>([]);
  const [inventoryEvents, setInventoryEvents] = useState<PoultryEvent[]>([]);
  const [mortalityRecords, setMortalityRecords] = useState<MortalityRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [filters, setFilters] = useState<LocationFilters>(DEFAULT_LOCATION_FILTERS);
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);
  const [focusToken, setFocusToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listManagedFarms(), listInventoryEvents(), listMortalityRecords()])
      .then(([farmRows, eventRows, mortalityRows]) => {
        if (cancelled) return;
        setFarms(farmRows);
        setInventoryEvents(eventRows);
        setMortalityRecords(mortalityRows);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load farm locations.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const populationByFarm = useMemo(() => {
    const eventsByFarm = new Map<string, PoultryEvent[]>();
    for (const e of inventoryEvents) {
      const list = eventsByFarm.get(e.farmId) ?? [];
      list.push(e);
      eventsByFarm.set(e.farmId, list);
    }
    const mortalityByFarm = new Map<string, MortalityRecord[]>();
    for (const r of mortalityRecords) {
      const list = mortalityByFarm.get(r.farmId) ?? [];
      list.push(r);
      mortalityByFarm.set(r.farmId, list);
    }
    const result = new Map<string, number>();
    for (const [farmId, events] of eventsByFarm) {
      const byType = currentStockByType(events, mortalityByFarm.get(farmId) ?? []);
      result.set(farmId, Object.values(byType).reduce((sum, v) => sum + v, 0));
    }
    return result;
  }, [inventoryEvents, mortalityRecords]);

  const filteredFarms = useMemo(() => applyLocationFilters(farms, filters), [farms, filters]);
  const mappableCount = useMemo(
    () => filteredFarms.filter((f) => f.latitude !== null && f.longitude !== null).length,
    [filteredFarms]
  );
  const selectedFarm = farms.find((f) => f.id === selectedFarmId) ?? null;

  const handleSelectFarm = (farm: ManagedFarm) => {
    setSelectedFarmId(farm.id);
    setFocusToken((t) => t + 1);
  };

  const handleViewDetails = (farm: ManagedFarm) => {
    navigate(`${FARMS_PATH}?search=${encodeURIComponent(farm.name)}`);
  };

  if (breakpoint !== "desktop") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-6 py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
          <Monitor size={26} strokeWidth={1.75} />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold text-[var(--color-foreground)]">Best viewed on a larger screen</h2>
          <p className="mt-1.5 max-w-sm text-sm text-[var(--color-muted)]">
            The Locations map is designed for desktop. Please switch to a larger screen to monitor farm distribution.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-24 text-sm text-[var(--color-muted)]">
        <Loader2 size={16} className="spinner" /> Loading farm locations…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-24 text-center">
        <AlertCircle size={20} className="text-[var(--color-danger)]" />
        <p className="text-sm text-[var(--color-foreground)]">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-xl font-semibold text-[var(--color-foreground)]">Locations</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Geographic overview of every registered farm — monitor distribution, search by location, and jump to Farm details.
        </p>
      </div>

      <LocationsSummaryCards farms={farms} />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="lg:max-w-sm lg:flex-1">
          <LocationSearchBar farms={farms} onSelect={handleSelectFarm} />
        </div>
        <LocationFiltersPanel farms={farms} value={filters} onChange={setFilters} />
      </div>

      {farms.length > 0 && mappableCount === 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-warning)]/10 px-4 py-3 text-sm text-[var(--color-foreground)]">
          <MapPinOff size={16} className="shrink-0 text-[var(--color-warning)]" />
          No farms matching these filters have coordinates set yet — add latitude/longitude from the Farms page to see them here.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div className="relative h-[560px]">
          <FarmMap
            farms={filteredFarms}
            populationByFarm={populationByFarm}
            selectedFarmId={selectedFarmId}
            focusToken={focusToken}
            onSelectFarm={handleSelectFarm}
            onViewDetails={handleViewDetails}
          />
          <MapLegend />
        </div>
        <div className="h-[560px]">
          <SelectedFarmPanel
            farm={selectedFarm}
            population={selectedFarm ? populationByFarm.get(selectedFarm.id) ?? 0 : 0}
            onClose={() => setSelectedFarmId(null)}
            onViewDetails={handleViewDetails}
          />
        </div>
      </div>

      <LocationsAnalytics farms={farms} />
    </div>
  );
}

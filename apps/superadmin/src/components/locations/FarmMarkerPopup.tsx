import { ExternalLink, MapPinned } from "lucide-react";
import FarmStatusBadge from "@poultryhub/shared/components/farms/FarmStatusBadge";
import { formatAdmins, formatFullAddress, googleMapsUrl } from "../../lib/farmDisplay";
import type { ManagedFarm } from "@poultryhub/shared/types/farm";

interface FarmMarkerPopupProps {
  farm: ManagedFarm & { latitude: number; longitude: number };
  population: number;
  onViewDetails: () => void;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="text-[var(--color-muted)]">{label}</span>
      <span className="text-right font-medium text-[var(--color-foreground)]">{value}</span>
    </div>
  );
}

/** Rendered inside a Leaflet Popup — plain divs, no card chrome (Leaflet supplies its own bubble). */
export default function FarmMarkerPopup({ farm, population, onViewDetails }: FarmMarkerPopupProps) {
  return (
    <div className="flex flex-col gap-2 text-[var(--color-foreground)]" style={{ minWidth: 220 }}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-sm font-semibold">{farm.name}</p>
          {farm.farmCode && <p className="text-xs text-[var(--color-muted)]">{farm.farmCode}</p>}
        </div>
        <FarmStatusBadge status={farm.status} />
      </div>

      <div className="flex flex-col gap-1 border-t border-[var(--color-border)] pt-2">
        <Row label="Owner" value={farm.owner ?? "—"} />
        <Row label="Farm Admin" value={formatAdmins(farm)} />
        <Row label="Province" value={farm.province ?? "—"} />
        <Row label="Municipality" value={farm.city ?? "—"} />
        <Row label="Address" value={formatFullAddress(farm)} />
        <Row label="Population" value={population.toLocaleString()} />
        <Row label="Capacity" value={farm.capacity?.toLocaleString() ?? "—"} />
      </div>

      <div className="flex flex-col gap-1.5 border-t border-[var(--color-border)] pt-2">
        <button
          type="button"
          onClick={onViewDetails}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white"
        >
          View Farm Details
        </button>
        <a
          href={googleMapsUrl(farm.latitude, farm.longitude)}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]"
        >
          <MapPinned size={12} /> Open in Google Maps <ExternalLink size={11} />
        </a>
      </div>
    </div>
  );
}

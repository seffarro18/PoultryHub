import { ExternalLink, MapPin, MapPinned, X } from "lucide-react";
import FarmStatusBadge from "@poultryhub/shared/components/farms/FarmStatusBadge";
import { formatAdmins, formatFullAddress, googleMapsUrl } from "../../lib/farmDisplay";
import type { ManagedFarm } from "@poultryhub/shared/types/farm";

interface DetailRowProps {
  label: string;
  value: string;
}

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs text-[var(--color-muted)]">{label}</p>
      <p className="text-sm text-[var(--color-foreground)]">{value}</p>
    </div>
  );
}

interface SelectedFarmPanelProps {
  farm: ManagedFarm | null;
  population: number;
  onClose: () => void;
  onViewDetails: (farm: ManagedFarm) => void;
}

export default function SelectedFarmPanel({ farm, population, onClose, onViewDetails }: SelectedFarmPanelProps) {
  if (!farm) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 text-center">
        <MapPin size={22} className="text-[var(--color-muted)]" strokeWidth={1.75} />
        <p className="text-sm text-[var(--color-muted)]">Select a farm marker or search result to see its details here.</p>
      </div>
    );
  }

  const hasCoords = farm.latitude !== null && farm.longitude !== null;

  return (
    <div className="flex h-full flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="flex items-start justify-between gap-2 border-b border-[var(--color-border)] px-4 py-3.5">
        <div>
          <h3 className="font-display text-sm font-semibold text-[var(--color-foreground)]">Farm Information</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)]"
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-display text-base font-semibold text-[var(--color-foreground)]">{farm.name}</p>
            {farm.farmCode && <p className="text-xs text-[var(--color-muted)]">{farm.farmCode}</p>}
          </div>
          <FarmStatusBadge status={farm.status} />
        </div>

        <DetailRow label="Owner" value={farm.owner ?? "—"} />
        <DetailRow label="Assigned Farm Admin" value={formatAdmins(farm)} />
        <DetailRow label="Complete Address" value={formatFullAddress(farm)} />
        <DetailRow label="Coordinates" value={hasCoords ? `${farm.latitude}, ${farm.longitude}` : "Not set"} />
        <DetailRow label="Current Poultry Population" value={population.toLocaleString()} />
        <DetailRow label="Maximum Capacity" value={farm.capacity?.toLocaleString() ?? "—"} />
        <DetailRow label="Date Registered" value={new Date(farm.createdAt).toLocaleDateString()} />
      </div>

      <div className="flex flex-col gap-2 border-t border-[var(--color-border)] px-4 py-3.5">
        <button
          type="button"
          onClick={() => onViewDetails(farm)}
          className="flex items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-3.5 py-2 text-sm font-semibold text-white"
        >
          View Farm
        </button>
        {hasCoords && (
          <a
            href={googleMapsUrl(farm.latitude as number, farm.longitude as number)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] px-3.5 py-2 text-sm font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]"
          >
            <MapPinned size={14} /> Open Google Maps <ExternalLink size={12} />
          </a>
        )}
      </div>
    </div>
  );
}

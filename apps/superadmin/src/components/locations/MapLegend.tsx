import { MARKER_LEGEND } from "../../lib/leafletIcons";

export default function MapLegend() {
  return (
    <div className="absolute bottom-4 left-4 z-[1000] rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]/95 px-3 py-2.5 shadow-md backdrop-blur-sm">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">Legend</p>
      <div className="flex flex-col gap-1">
        {MARKER_LEGEND.map((entry) => (
          <div key={entry.status} className="flex items-center gap-2 text-xs text-[var(--color-foreground)]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
            {entry.label}
          </div>
        ))}
      </div>
    </div>
  );
}

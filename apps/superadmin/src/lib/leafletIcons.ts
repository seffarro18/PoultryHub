import L from "leaflet";
import type { FarmStatus } from "@poultryhub/shared/types/farm";

// Leaflet's default marker images famously 404 under bundlers unless you
// manually rewire their asset paths — a divIcon with inline SVG sidesteps
// that whole class of problem, and lets the pin match this app's own
// palette instead of generic Leaflet blue.
const MARKER_COLORS: Record<FarmStatus, string> = {
  active: "var(--color-success)",
  inactive: "var(--color-danger)",
  archived: "var(--color-muted)",
};

function pinSvg(color: string, selected: boolean): string {
  const scale = selected ? 1.25 : 1;
  return `
    <svg width="${28 * scale}" height="${38 * scale}" viewBox="0 0 28 38" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 24 14 24s14-13.5 14-24C28 6.27 21.73 0 14 0z"
        style="fill:${color}; stroke:var(--color-card); stroke-width:1.5"
      />
      <circle cx="14" cy="14" r="5.5" style="fill:var(--color-card)" />
    </svg>
  `;
}

export function createFarmMarkerIcon(status: FarmStatus, selected = false): L.DivIcon {
  const scale = selected ? 1.25 : 1;
  const width = 28 * scale;
  const height = 38 * scale;
  return L.divIcon({
    className: "farm-marker-icon",
    html: pinSvg(MARKER_COLORS[status], selected),
    iconSize: [width, height],
    iconAnchor: [width / 2, height],
    popupAnchor: [0, -height + 4],
  });
}

export const MARKER_LEGEND: { status: FarmStatus; label: string; color: string }[] = [
  { status: "active", label: "Active Farm", color: MARKER_COLORS.active },
  { status: "inactive", label: "Inactive Farm", color: MARKER_COLORS.inactive },
  { status: "archived", label: "Archived Farm", color: MARKER_COLORS.archived },
];

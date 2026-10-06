import type { EggColor } from "../../types/layerBreed";

const COLOR_STYLE: Record<EggColor, { label: string; color: string } | null> = {
  White: { label: "White Egg", color: "var(--color-muted)" },
  Brown: { label: "Brown Egg", color: "var(--chart-series-2)" },
  // "Other" strains (or a farm's custom entry left unspecified) show no badge at all — nothing meaningful to label.
  Other: null,
};

/** Minimal pill, same recipe as every other status badge in this app — shown next to a Layer Breed/Strain selection. */
export default function EggColorBadge({ eggColor }: { eggColor: EggColor }) {
  const style = COLOR_STYLE[eggColor];
  if (!style) return null;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ color: style.color, backgroundColor: `color-mix(in srgb, ${style.color} 14%, transparent)` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: style.color }} />
      {style.label}
    </span>
  );
}

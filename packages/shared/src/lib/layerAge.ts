/**
 * Layer production-stage reference bands, 1-100 weeks. Informational only —
 * never used to auto-set Status, Event Type, Quantity, Breed, House/Pen, or
 * any production rate. Actual egg production always comes from recorded Egg
 * Production data, never inferred from age. Boundaries are management
 * reference points (Hy-Line's commercial-layer guidance), not a universal
 * biological rule — different breeds/conditions can shift them.
 */
export interface LayerAgeStage {
  label: string;
  minWeeks: number;
  maxWeeks: number;
}

export const LAYER_AGE_STAGES: LayerAgeStage[] = [
  { label: "Growing", minWeeks: 1, maxWeeks: 14 },
  { label: "Pre-Lay", minWeeks: 15, maxWeeks: 17 },
  { label: "Early Lay", minWeeks: 18, maxWeeks: 25 },
  { label: "Peak / Established Lay", minWeeks: 26, maxWeeks: 60 },
  { label: "Later Lay", minWeeks: 61, maxWeeks: 80 },
  { label: "Extended Lay", minWeeks: 81, maxWeeks: 100 },
];

export const LAYER_AGE_MIN_WEEKS = 1;
export const LAYER_AGE_MAX_WEEKS = 100;

/** Returns the reference stage label for a given age, or null outside 1-100 weeks. */
export function getLayerAgeStage(ageWeeks: number): string | null {
  return LAYER_AGE_STAGES.find((stage) => ageWeeks >= stage.minWeeks && ageWeeks <= stage.maxWeeks)?.label ?? null;
}

/** Each stage's full list of week numbers, for rendering a grouped <optgroup> dropdown. */
export function getLayerAgeWeekGroups(): { label: string; weeks: number[] }[] {
  return LAYER_AGE_STAGES.map((stage) => ({
    label: stage.label,
    weeks: Array.from({ length: stage.maxWeeks - stage.minWeeks + 1 }, (_, i) => stage.minWeeks + i),
  }));
}

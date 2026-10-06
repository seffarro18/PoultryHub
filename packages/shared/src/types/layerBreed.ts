export const EGG_COLORS = ["White", "Brown", "Other"] as const;
export type EggColor = (typeof EGG_COLORS)[number];

/** farm_id null = a system default (one of the 11 seeded commercial strains), visible read-only to every farm. farm_id set = that farm's own custom strain, managed by its Farm Admin/Manager. */
export interface LayerBreed {
  id: string;
  farmId: string | null;
  name: string;
  eggColor: EggColor;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LayerBreedInput {
  name: string;
  eggColor: EggColor;
  isActive: boolean;
}

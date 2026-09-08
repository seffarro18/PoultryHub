import { Activity, Egg, OctagonAlert, Pill, Stethoscope, TriangleAlert, UsersRound, Wheat, Info, type LucideIcon } from "lucide-react";
import type { AttentionModule, AttentionPriority } from "../../../types/attention";

/** Icon + text label for every priority — never color alone, per the accessibility requirement this was built against. */
export const PRIORITY_META: Record<AttentionPriority, { label: string; icon: LucideIcon; color: string }> = {
  high: { label: "High", icon: OctagonAlert, color: "var(--color-danger)" },
  medium: { label: "Medium", icon: TriangleAlert, color: "var(--color-warning)" },
  low: { label: "Low", icon: Info, color: "var(--color-muted)" },
};

export const MODULE_META: Record<AttentionModule, { icon: LucideIcon; label: string }> = {
  egg_production: { icon: Egg, label: "Egg Production" },
  feed_inventory: { icon: Wheat, label: "Feed" },
  vitamin_inventory: { icon: Pill, label: "Vitamins" },
  health_records: { icon: Stethoscope, label: "Health" },
  mortality_records: { icon: Activity, label: "Mortality" },
  staff_management: { icon: UsersRound, label: "Staff" },
};

/** Fixed Cause of Mortality options — shared by the record form (dropdown + "Other" specify field) and the Mortality Records page's cause filter, so they never drift apart. */
export const MORTALITY_CAUSES = ["Disease", "Injury", "Predation", "Heat Stress", "Cold Stress", "Weak/Undetermined", "Other"] as const;

export const OTHER_MORTALITY_CAUSE = "Other";

/** Own alias, not cross-imported from types/feedVitamin.ts — same shape, independent domain. */
export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface HealthRecord {
  id: string;
  farmId: string;
  farmName: string;
  housePen: string;
  recordDate: string;
  diseaseCondition: string;
  symptoms: string | null;
  affectedBirds: number;
  medication: string | null;
  treatment: string | null;
  vaccination: string | null;
  veterinarian: string | null;
  recordedById: string | null;
  recordedByName: string | null;
  status: ApprovalStatus;
  reviewNotes: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  remarks: string | null;
  createdAt: string;
}

export interface HealthRecordInput {
  farmId: string;
  housePen: string;
  recordDate: string;
  diseaseCondition: string;
  symptoms: string | null;
  affectedBirds: number;
  medication: string | null;
  treatment: string | null;
  vaccination: string | null;
  veterinarian: string | null;
  remarks: string | null;
}

/** Derived, not stored — "Treated" if a treatment was administered, else "Pending Treatment". No separate treatment-status column exists. */
export function treatmentStatus(record: Pick<HealthRecord, "treatment">): "Treated" | "Pending Treatment" {
  return record.treatment && record.treatment.trim() ? "Treated" : "Pending Treatment";
}

/** Derived, not stored — non-empty `vaccination` field means a vaccination was recorded for this case. */
export function vaccinationStatus(record: Pick<HealthRecord, "vaccination">): "Vaccinated" | "Not Vaccinated" {
  return record.vaccination && record.vaccination.trim() ? "Vaccinated" : "Not Vaccinated";
}

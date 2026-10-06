import { supabase } from "@poultryhub/shared/services/supabaseClient";
import type { IntegrityCheckResult } from "../types/systemIntegrity";

interface IntegrityCheckRow {
  check_name: string;
  status: IntegrityCheckResult["status"];
  detail: string;
  affected_count: number;
}

/** Runs every check server-side (security-definer RPC, Super-Admin-only — see migration 0039) and returns one result per check. A thrown error here is a real connection/permission failure, never silently swallowed into an empty/all-clear result. */
export async function runSystemIntegrityCheck(): Promise<IntegrityCheckResult[]> {
  const { data, error } = await supabase.rpc("run_system_integrity_check");
  if (error) throw error;
  return ((data ?? []) as IntegrityCheckRow[]).map((row) => ({
    checkName: row.check_name,
    status: row.status,
    detail: row.detail,
    affectedCount: row.affected_count,
  }));
}

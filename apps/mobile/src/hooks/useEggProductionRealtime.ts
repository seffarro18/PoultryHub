import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@poultryhub/shared/services/supabaseClient";

const REFRESH_DEBOUNCE_MS = 300;

/**
 * Keeps the Farm Admin Egg Production records list current the moment Staff
 * submits, edits, approves, or rejects a record — one farm_id-scoped
 * Postgres Changes subscription on egg_production, debounced into a single
 * refetch. Same channel/cleanup/debounce shape as useFarmDashboardRealtime.
 */
export function useEggProductionRealtime(farmId: string | null | undefined, onChange: () => void): void {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!farmId) return;

    const refreshTimerRef = { current: null as ReturnType<typeof setTimeout> | null };
    const debouncedChange = () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => onChangeRef.current(), REFRESH_DEBOUNCE_MS);
    };

    let channel: RealtimeChannel | null = supabase
      .channel(`egg-production:${farmId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "egg_production", filter: `farm_id=eq.${farmId}` },
        debouncedChange
      )
      .subscribe();

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      if (channel) {
        void supabase.removeChannel(channel);
        channel = null;
      }
    };
  }, [farmId]);
}

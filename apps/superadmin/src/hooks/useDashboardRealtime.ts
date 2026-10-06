import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@poultryhub/shared/services/supabaseClient";

const REFRESH_DEBOUNCE_MS = 300;

/**
 * Every table the Super Admin Dashboard reads from. Unlike the Farm Admin
 * dashboard's realtime hook, this deliberately has no farm_id filter —
 * Super Admin is authorized across every farm, and Postgres Changes
 * authorization is enforced by each table's own "Super Admin can view all…"
 * RLS policy, not by the `filter` option (that's just a narrowing, not a
 * security boundary) — an unfiltered subscription here is still governed by
 * exactly the same RLS the REST queries already go through.
 */
const WATCHED_TABLES = [
  "farms",
  "profiles",
  "egg_production",
  "sales",
  "expenses",
  "feeds",
  "mortality_records",
  "poultry_inventory_events",
  "feed_distribution",
  "notifications",
] as const;

/** Keeps the Super Admin Dashboard's KPI cards, charts, and farm breakdown current without a manual reload — one Realtime channel, multiple Postgres Changes bindings, funnelled into a single debounced refetch. Mirrors the Farm Admin dashboard's own realtime hook. */
export function useDashboardRealtime(enabled: boolean, onChange: () => void): void {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!enabled) return;

    const refreshTimerRef = { current: null as ReturnType<typeof setTimeout> | null };
    const debouncedChange = () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => onChangeRef.current(), REFRESH_DEBOUNCE_MS);
    };

    let channel: RealtimeChannel | null = supabase.channel("superadmin-dashboard");
    for (const table of WATCHED_TABLES) {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, debouncedChange);
    }
    channel = channel.subscribe();

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      if (channel) {
        void supabase.removeChannel(channel);
        channel = null;
      }
    };
  }, [enabled]);
}

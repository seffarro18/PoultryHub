import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@poultryhub/shared/services/supabaseClient";

const REFRESH_DEBOUNCE_MS = 300;

/** Every table a Farm Dashboard card or chart reads from — farm_id-scoped Postgres Changes, same authorization the farm's own RLS policies already grant (a subscriber can't receive rows it couldn't SELECT anyway). notifications is scoped by recipient_id instead, matching NotificationCountContext's own subscription for the same table. */
const FARM_SCOPED_TABLES = [
  "egg_production",
  "tasks",
  "sales",
  "expenses",
  "feeds",
  "vitamins",
  "mortality_records",
  "poultry_inventory_events",
  "feed_distribution",
] as const;

/** Staff's dashboard never reads sales/expenses (no RLS access, no UI for them either) — subscribing to those tables would just be a no-op channel binding, so they're left out entirely rather than relying on RLS to silently drop the payload. */
export const STAFF_SCOPED_TABLES = FARM_SCOPED_TABLES.filter((t) => t !== "sales" && t !== "expenses");

/**
 * Keeps the Farm Dashboard's cards/charts current without a manual reload —
 * one Realtime channel, multiple Postgres Changes bindings (cheaper than a
 * channel per table), all funnelled into a single debounced refetch so a
 * burst of related writes (e.g. an approval trigger touching more than one
 * row) doesn't refetch the whole dashboard several times in a row. Mirrors
 * the same channel/cleanup/debounce shape NotificationCountContext and
 * TaskDetailPage already use elsewhere in this app.
 */
export function useFarmDashboardRealtime(
  farmId: string | null | undefined,
  userId: string | undefined,
  onChange: () => void,
  tables: readonly string[] = FARM_SCOPED_TABLES
): void {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!farmId || !userId) return;

    const refreshTimerRef = { current: null as ReturnType<typeof setTimeout> | null };
    const debouncedChange = () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => onChangeRef.current(), REFRESH_DEBOUNCE_MS);
    };

    let channel: RealtimeChannel | null = supabase.channel(`farm-dashboard:${farmId}`);
    for (const table of tables) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `farm_id=eq.${farmId}` },
        debouncedChange
      );
    }
    channel = channel
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${userId}` },
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
  }, [farmId, userId]);
}

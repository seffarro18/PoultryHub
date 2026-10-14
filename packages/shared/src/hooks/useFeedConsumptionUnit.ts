import { useCallback, useEffect, useState } from "react";
import { supabase } from "../services/supabaseClient";
import { getProductionSettings } from "../services/eggPricingService";
import { getErrorMessage } from "../lib/errorMessage";
import type { FeedConsumptionUnit } from "../types/feedVitamin";

/** Fired in this tab right after the Farm Admin saves the setting, so every mounted screen switches instantly (Realtime covers other sessions/devices). */
export const FEED_UNIT_CHANGED_EVENT = "poultryhub:feed-consumption-unit-changed";

export function announceFeedConsumptionUnit(unit: FeedConsumptionUnit): void {
  window.dispatchEvent(new CustomEvent<FeedConsumptionUnit>(FEED_UNIT_CHANGED_EVENT, { detail: unit }));
}

export interface FeedConsumptionUnitState {
  /** null while loading or after a failed load — never silently assumed. */
  unit: FeedConsumptionUnit | null;
  error: string | null;
  reload: () => void;
}

/**
 * The farm-wide Feed Consumption Unit (production_settings.feed_consumption_unit)
 * — the one setting every Staff/Farm Admin screen displays feed in. Read from
 * Supabase (RLS: the caller's own farm), kept live by a Realtime subscription
 * on that farm's production_settings row, plus an in-tab event on save.
 */
export function useFeedConsumptionUnit(farmId: string | null | undefined): FeedConsumptionUnitState {
  const [unit, setUnit] = useState<FeedConsumptionUnit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadKey, setLoadKey] = useState(0);
  const reload = useCallback(() => setLoadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    getProductionSettings()
      .then((settings) => {
        // Every farm gets a production_settings row when it's created (0021); the column defaults to 'sack' (0052).
        if (!cancelled) setUnit(settings?.feedConsumptionUnit ?? "sack");
      })
      .catch((err) => {
        console.error("[useFeedConsumptionUnit] load failed:", err);
        if (!cancelled) {
          setUnit(null);
          setError(getErrorMessage(err, "Couldn't load the farm's feed consumption unit."));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [loadKey]);

  useEffect(() => {
    const onLocal = (e: Event) => {
      const next = (e as CustomEvent<FeedConsumptionUnit>).detail;
      if (next === "kg" || next === "sack") setUnit(next);
    };
    window.addEventListener(FEED_UNIT_CHANGED_EVENT, onLocal);
    return () => window.removeEventListener(FEED_UNIT_CHANGED_EVENT, onLocal);
  }, []);

  useEffect(() => {
    if (!farmId) return;
    const channel = supabase
      .channel(`feed-unit:${farmId}:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "production_settings", filter: `farm_id=eq.${farmId}` }, (payload) => {
        const next = (payload.new as { feed_consumption_unit?: string }).feed_consumption_unit;
        if (next === "kg" || next === "sack") setUnit(next);
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [farmId]);

  return { unit, error, reload };
}

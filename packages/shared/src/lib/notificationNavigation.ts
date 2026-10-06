export type NotificationLinkResolution = { kind: "navigate"; path: string } | { kind: "denied" } | { kind: "none" };

/**
 * Every notify_*() trigger already stores a real, currently-mounted route in
 * `link` (verified against every trigger in supabase/migrations) — this just
 * decides what a tap should do with it. "denied" is defensive: a link whose
 * prefix doesn't match the app you're standing in shouldn't silently bounce
 * through the catch-all route with no explanation.
 */
export function resolveNotificationLink(link: string | null, appPrefix: "/dashboard" | "/farm"): NotificationLinkResolution {
  if (!link) return { kind: "none" };
  if (!link.startsWith(appPrefix)) return { kind: "denied" };
  return { kind: "navigate", path: link };
}

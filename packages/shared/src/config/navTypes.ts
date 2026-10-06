import type { LucideIcon } from "lucide-react";

export interface NavLink {
  type: "link";
  label: string;
  path: string;
  icon: LucideIcon;
  /** Extra path prefixes that should also count as this link being "active" — e.g. the mobile bottom nav's Inventory tab also covers the separate /farm/feed, /farm/vitamins, /farm/mortality alias routes, which don't share its own `path` as a literal prefix. Defaults to [path] when omitted. */
  matchPaths?: string[];
}

export interface NavGroup {
  type: "group";
  label: string;
  icon: LucideIcon;
  children: NavLink[];
}

export type NavEntry = NavLink | NavGroup;

/** Every navigable leaf, including nested group children — used to generate placeholder routes. */
export function flattenNavLinks(entries: NavEntry[]): NavLink[] {
  return entries.flatMap((entry) => (entry.type === "group" ? entry.children : [entry]));
}

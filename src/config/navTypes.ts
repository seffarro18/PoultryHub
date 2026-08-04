import type { LucideIcon } from "lucide-react";

export interface NavLink {
  type: "link";
  label: string;
  path: string;
  icon: LucideIcon;
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

export interface PoultryHouse {
  id: string;
  farmId: string;
  name: string;
}

/**
 * Comparison-only key for "is this the same house/pen name, cosmetically
 * typed differently?" — collapses underscores/hyphens/repeated whitespace
 * down to single spaces before lowercasing, so "House 1", "House_1",
 * "House-1", and "house   1" all normalize identically. Never used for
 * storage or display — the original, as-typed name is always what's saved
 * and shown; this only prevents a near-duplicate row from being created in
 * the first place (PoultryHouseSelect's handleCreate).
 */
export function normalizeHouseName(name: string): string {
  return name.trim().toLowerCase().replace(/[\s_-]+/g, " ");
}

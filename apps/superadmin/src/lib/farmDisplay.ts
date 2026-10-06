import type { ManagedFarm } from "@poultryhub/shared/types/farm";

/** "Street/barangay detail, City, Province, Region" — skips whichever parts are missing. */
export function formatFullAddress(farm: ManagedFarm): string {
  return [farm.address, farm.city, farm.province, farm.region].filter(Boolean).join(", ") || "Not set";
}

export function formatAdmins(farm: ManagedFarm): string {
  return farm.admins.length > 0 ? farm.admins.map((a) => a.name).join(", ") : "Unassigned";
}

export function googleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

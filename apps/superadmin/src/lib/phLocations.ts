import phLocations from "ph-locations";

// The official PSGC (Philippine Standard Geographic Code) dataset, bundled
// with the `ph-locations` package — no API key, no runtime network calls,
// works offline. Names (not codes) are what get stored on a farm; codes are
// only used here, client-side, to drive the cascading Region -> Province ->
// City/Municipality selects.
const { regions: rawRegions, provinces: rawProvinces, citiesMunicipalities: rawCities } = phLocations.psgc;

export interface PhRegion {
  code: string;
  name: string;
}

export interface PhProvince {
  code: string;
  name: string;
  region: string;
}

export interface PhCity {
  code: string;
  name: string;
  province: string;
}

export const PH_REGIONS: PhRegion[] = [...rawRegions].sort((a, b) => a.name.localeCompare(b.name));

export function getProvincesForRegion(regionCode: string): PhProvince[] {
  return rawProvinces.filter((p) => p.region === regionCode).sort((a, b) => a.name.localeCompare(b.name));
}

export function getCitiesForProvince(provinceCode: string): PhCity[] {
  return rawCities.filter((c) => c.province === provinceCode).sort((a, b) => a.name.localeCompare(b.name));
}

export function findRegionByName(name: string): PhRegion | undefined {
  return rawRegions.find((r) => r.name === name);
}

export function findProvinceByName(regionCode: string, name: string): PhProvince | undefined {
  return rawProvinces.find((p) => p.region === regionCode && p.name === name);
}

export function findCityByName(provinceCode: string, name: string): PhCity | undefined {
  return rawCities.find((c) => c.province === provinceCode && c.name === name);
}

// PoultryHub only operates in Aurora province (Region III / Central Luzon) —
// farm registration is locked to it, so region/province are fixed constants
// rather than user-selectable, and only the 8 municipalities within Aurora
// are offered.
const AURORA_PROVINCE_RAW = rawProvinces.find((p) => p.name === "Aurora");
if (!AURORA_PROVINCE_RAW) {
  throw new Error("Aurora province not found in the PSGC dataset — ph-locations data may have changed shape.");
}

export const AURORA_PROVINCE: PhProvince = AURORA_PROVINCE_RAW;
export const AURORA_REGION: PhRegion = rawRegions.find((r) => r.code === AURORA_PROVINCE.region)!;
export const AURORA_MUNICIPALITIES: PhCity[] = getCitiesForProvince(AURORA_PROVINCE.code);

/** Roughly centered on Baler (the capital), zoomed to frame the whole province — Aurora runs a long stretch of coastline from Dingalan up to Casiguran/Dilasag. */
export const AURORA_MAP_CENTER: [number, number] = [15.9, 121.6];
export const AURORA_MAP_ZOOM = 9;

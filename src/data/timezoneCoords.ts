// A rough "where is this visitor" guess from the browser's IANA time zone, so
// the sky view has a plausible sky to draw before anyone grants location
// access. Nothing leaves the device: the zone name comes from Intl, and a
// place ~100 km wrong is fine for a sky that spans the whole horizon.
//
// Deliberately a short table of population centres rather than the whole tz
// database. Zones not listed fall back through their continent prefix.

export const TIMEZONE_COORDS: Record<string, [lat: number, lon: number]> = {
  'America/New_York': [40.7, -74.0],
  'America/Detroit': [42.3, -83.0],
  'America/Toronto': [43.7, -79.4],
  'America/Chicago': [41.9, -87.6],
  'America/Denver': [39.7, -105.0],
  'America/Phoenix': [33.4, -112.1],
  'America/Los_Angeles': [34.1, -118.2],
  'America/Vancouver': [49.3, -123.1],
  'America/Anchorage': [61.2, -149.9],
  'America/Halifax': [44.6, -63.6],
  'America/Mexico_City': [19.4, -99.1],
  'America/Bogota': [4.7, -74.1],
  'America/Lima': [-12.0, -77.0],
  'America/Sao_Paulo': [-23.6, -46.6],
  'America/Argentina/Buenos_Aires': [-34.6, -58.4],
  'America/Santiago': [-33.4, -70.7],
  'Pacific/Honolulu': [21.3, -157.9],
  'Europe/London': [51.5, -0.1],
  'Europe/Dublin': [53.3, -6.3],
  'Europe/Lisbon': [38.7, -9.1],
  'Europe/Paris': [48.9, 2.4],
  'Europe/Madrid': [40.4, -3.7],
  'Europe/Berlin': [52.5, 13.4],
  'Europe/Amsterdam': [52.4, 4.9],
  'Europe/Rome': [41.9, 12.5],
  'Europe/Stockholm': [59.3, 18.1],
  'Europe/Warsaw': [52.2, 21.0],
  'Europe/Athens': [37.98, 23.7],
  'Europe/Helsinki': [60.2, 24.9],
  'Europe/Istanbul': [41.0, 29.0],
  'Europe/Moscow': [55.8, 37.6],
  'Africa/Cairo': [30.0, 31.2],
  'Africa/Lagos': [6.5, 3.4],
  'Africa/Nairobi': [-1.3, 36.8],
  'Africa/Johannesburg': [-26.2, 28.0],
  'Asia/Dubai': [25.2, 55.3],
  'Asia/Tehran': [35.7, 51.4],
  'Asia/Karachi': [24.9, 67.0],
  'Asia/Kolkata': [19.1, 72.9],
  'Asia/Dhaka': [23.8, 90.4],
  'Asia/Bangkok': [13.8, 100.5],
  'Asia/Singapore': [1.35, 103.8],
  'Asia/Jakarta': [-6.2, 106.8],
  'Asia/Shanghai': [31.2, 121.5],
  'Asia/Hong_Kong': [22.3, 114.2],
  'Asia/Seoul': [37.6, 127.0],
  'Asia/Tokyo': [35.7, 139.7],
  'Australia/Perth': [-31.95, 115.9],
  'Australia/Sydney': [-33.9, 151.2],
  'Australia/Melbourne': [-37.8, 145.0],
  'Pacific/Auckland': [-36.85, 174.8],
};

// Continent-level fallback for zones missing above
const CONTINENT_COORDS: Record<string, [number, number]> = {
  America: [39.0, -96.0],
  Europe: [50.0, 10.0],
  Africa: [5.0, 20.0],
  Asia: [30.0, 90.0],
  Australia: [-25.0, 134.0],
  Pacific: [-15.0, -170.0],
  Atlantic: [30.0, -40.0],
  Indian: [-20.0, 75.0],
};

/** The Space Coast: where most launches are, and a sensible answer to "don't know". */
export const DEFAULT_COORDS: [number, number] = [28.6, -80.8];

/** Best guess for a zone name, or null if there is nothing to go on. */
export function coordsForTimeZone(zone: string | null | undefined): [number, number] | null {
  if (!zone) return null;
  return TIMEZONE_COORDS[zone] ?? CONTINENT_COORDS[zone.split('/')[0]] ?? null;
}

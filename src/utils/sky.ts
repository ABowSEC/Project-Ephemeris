// Observer-centred sky geometry for the sky view: where the Sun is, where a
// launch pad lies from a viewer, and whether a rising rocket is in line of
// sight.
//
// This is pure TypeScript on purpose. crates/orbital does the authoritative
// solar maths, but it is an optional build artifact (no Rust toolchain, no
// module) and the sky view has to render on every build. The Sun algorithm is
// the same low-precision Astronomical Almanac form the crate uses (Meeus,
// ch. 25, good to about 0.01 degrees), so the two agree to well under a pixel.
//
// Angles are degrees at every boundary and radians only inside trigonometry.
// Dependency-free and DOM-free, like launchFields.ts.

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

/** Mean Earth radius in km. */
export const EARTH_RADIUS_KM = 6371;

const MS_PER_DAY = 86_400_000;
const UNIX_EPOCH_JD = 2_440_587.5;
const J2000 = 2_451_545.0;

const normalize = (degrees: number) => ((degrees % 360) + 360) % 360;

/** Wrap to [-180, 180). */
export const wrap180 = (degrees: number) => normalize(degrees + 180) - 180;

const daysSinceJ2000 = (unixMs: number) => unixMs / MS_PER_DAY + UNIX_EPOCH_JD - J2000;

// ── The Sun ─────────────────────────────────────────────────────────────────

interface Equatorial {
  /** Right ascension, degrees. */
  ra: number;
  /** Declination, degrees. */
  dec: number;
}

function sunEquatorial(unixMs: number): Equatorial {
  const n = daysSinceJ2000(unixMs);
  const meanLongitude = normalize(280.46 + 0.9856474 * n);
  const meanAnomaly = normalize(357.528 + 0.9856003 * n) * RAD;
  const eclipticLongitude =
    (meanLongitude + 1.915 * Math.sin(meanAnomaly) + 0.02 * Math.sin(2 * meanAnomaly)) * RAD;
  const obliquity = (23.439 - 0.0000004 * n) * RAD;

  return {
    ra: normalize(
      Math.atan2(Math.cos(obliquity) * Math.sin(eclipticLongitude), Math.cos(eclipticLongitude)) * DEG
    ),
    dec: Math.asin(Math.sin(obliquity) * Math.sin(eclipticLongitude)) * DEG,
  };
}

/** Greenwich Mean Sidereal Time, degrees. */
function gmst(unixMs: number): number {
  return normalize(280.46061837 + 360.98564736629 * daysSinceJ2000(unixMs));
}

/** The point on Earth with the Sun directly overhead. */
export function subsolarPoint(unixMs: number): { lat: number; lon: number } {
  const { ra, dec } = sunEquatorial(unixMs);
  return { lat: dec, lon: wrap180(ra - gmst(unixMs)) };
}

export interface Horizontal {
  /** Degrees above the horizon; negative is below. */
  altitude: number;
  /** Compass bearing, degrees clockwise from true north. */
  azimuth: number;
}

/** The Sun as seen from a place on the ground. */
export function sunHorizontal(lat: number, lon: number, unixMs: number): Horizontal {
  const { ra, dec } = sunEquatorial(unixMs);
  const hourAngle = (gmst(unixMs) + lon - ra) * RAD;
  const phi = lat * RAD;
  const delta = dec * RAD;

  const altitude = Math.asin(
    Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.cos(hourAngle)
  );
  const azimuth = Math.atan2(
    -Math.cos(delta) * Math.sin(hourAngle),
    Math.sin(delta) * Math.cos(phi) - Math.cos(delta) * Math.sin(phi) * Math.cos(hourAngle)
  );
  return { altitude: altitude * DEG, azimuth: normalize(azimuth * DEG) };
}

export type SkyPhase = 'day' | 'civil' | 'nautical' | 'astronomical' | 'night';

/** Twilight band for a solar altitude, by the standard civil/nautical/astronomical limits. */
export function skyPhase(sunAltitude: number): SkyPhase {
  if (sunAltitude >= 0) return 'day';
  if (sunAltitude >= -6) return 'civil';
  if (sunAltitude >= -12) return 'nautical';
  if (sunAltitude >= -18) return 'astronomical';
  return 'night';
}

// ── Great-circle geometry ───────────────────────────────────────────────────

const COMPASS_POINTS = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
];

/** "SE" for a bearing of 147 degrees. */
export function compass(azimuth: number): string {
  return COMPASS_POINTS[Math.round(normalize(azimuth) / 22.5) % 16];
}

/** Central angle between two places, degrees. */
export function angularDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const p1 = lat1 * RAD;
  const p2 = lat2 * RAD;
  const dLon = (lon2 - lon1) * RAD;
  // Haversine: stable for the short distances that matter here
  const a =
    Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLon / 2) ** 2;
  return 2 * Math.asin(Math.min(1, Math.sqrt(a))) * DEG;
}

/** Initial compass bearing from the first place to the second, degrees clockwise from north. */
export function bearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const p1 = lat1 * RAD;
  const p2 = lat2 * RAD;
  const dLon = (lon2 - lon1) * RAD;
  const y = Math.sin(dLon) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dLon);
  return normalize(Math.atan2(y, x) * DEG);
}

/** Where you end up travelling `distance` degrees of arc from a place on a bearing. */
export function destination(
  lat: number,
  lon: number,
  bearingDeg: number,
  distanceDeg: number
): { lat: number; lon: number } {
  const p1 = lat * RAD;
  const d = distanceDeg * RAD;
  const b = bearingDeg * RAD;
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
  const dLon = Math.atan2(
    Math.sin(b) * Math.sin(d) * Math.cos(p1),
    Math.cos(d) - Math.sin(p1) * Math.sin(p2)
  );
  return { lat: p2 * DEG, lon: wrap180(lon + dLon * DEG) };
}

// ── Seeing a rocket ─────────────────────────────────────────────────────────

/**
 * Whether the Sun's altitude at a pad favours a visible exhaust plume: ground
 * dark, vehicle climbing into sunlight. Mirrors `is_twilight_launch` in
 * crates/orbital (-18 to -3 degrees) on purpose, so the launch page and the
 * sky view never give different answers about the same launch.
 */
export function isTwilightLaunch(padSunAltitude: number): boolean {
  return padSunAltitude >= -18 && padSunAltitude <= -3;
}

/** Altitude a climbing vehicle typically reaches while still worth looking at. */
export const PLUME_ALTITUDE_KM = 100;

/**
 * Elevation angle, from the ground, of a point `heightKm` up and
 * `centralAngleDeg` of arc away. Negative means it is below the horizon.
 */
export function elevationOf(centralAngleDeg: number, heightKm: number): number {
  const theta = centralAngleDeg * RAD;
  const r = EARTH_RADIUS_KM + heightKm;
  return Math.atan2(r * Math.cos(theta) - EARTH_RADIUS_KM, r * Math.sin(theta)) * DEG;
}

/** How far below the horizontal the horizon lies from height `heightKm` (the "dip"), degrees. */
export function horizonDip(heightKm: number): number {
  return Math.acos(EARTH_RADIUS_KM / (EARTH_RADIUS_KM + heightKm)) * DEG;
}

export type Visibility =
  /** Line of sight, dark ground below, rocket in sunlight: the jellyfish. */
  | 'plume'
  /** Line of sight in full darkness: a moving flame. */
  | 'night'
  /** Line of sight in daylight: a faint contrail at best. */
  | 'day'
  /** Over the horizon from here. */
  | 'below';

export interface SkyPosition {
  azimuth: number;
  distanceKm: number;
  /** Elevation of a vehicle at PLUME_ALTITUDE_KM above the pad. Negative: over the horizon. */
  elevation: number;
  visibility: Visibility;
  /** Sun altitude at the viewer. */
  viewerSunAltitude: number;
}

/**
 * Where a launch appears from a viewer at a given moment, and whether it can
 * be seen.
 *
 * Line of sight is geometry: a vehicle at 100 km is over the horizon beyond
 * roughly 1,100 km, which is why a Florida launch is visible from Georgia and
 * not from Ohio. Whether it is worth looking for is about light: the plume
 * blooms when the ground is dark but the vehicle is still sunlit: the pad in
 * its twilight band (see isTwilightLaunch) and the viewer's own Sun below
 * about -3 degrees, so the sky is dark enough to show it.
 */
export function skyPosition(
  viewer: { lat: number; lon: number },
  pad: { lat: number; lon: number },
  unixMs: number
): SkyPosition {
  const central = angularDistance(viewer.lat, viewer.lon, pad.lat, pad.lon);
  const elevation = elevationOf(central, PLUME_ALTITUDE_KM);
  const viewerSun = sunHorizontal(viewer.lat, viewer.lon, unixMs).altitude;
  const padSun = sunHorizontal(pad.lat, pad.lon, unixMs).altitude;

  let visibility: Visibility;
  if (elevation <= 0) {
    visibility = 'below';
  } else if (viewerSun >= -3) {
    visibility = 'day';
  } else if (isTwilightLaunch(padSun)) {
    visibility = 'plume';
  } else {
    visibility = 'night';
  }

  return {
    azimuth: bearing(viewer.lat, viewer.lon, pad.lat, pad.lon),
    distanceKm: central * RAD * EARTH_RADIUS_KM,
    elevation,
    visibility,
    viewerSunAltitude: viewerSun,
  };
}

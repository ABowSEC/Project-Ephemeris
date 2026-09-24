// The slice of a launch the sky view needs, and the grouping both views share.

import type { AnyLaunch } from '../../types/launchLibrary';
import {
  hasPreciseTime,
  launchDate,
  padCoordinates,
  providerName,
  rocketName,
} from '../../utils/launchFields';
import { hasFlown } from '../../data/launchStatus';
import type { Visibility } from '../../utils/sky';

export interface SkyLaunch {
  id: string;
  slug: string;
  name: string;
  rocket: string | null;
  provider: string | null;
  padName: string;
  lat: number;
  lon: number;
  /** T-0, ms since the epoch. */
  t: number;
  statusAbbrev: string;
}

/** A pad and every launch scheduled from it. Views draw one mark per pad. */
export interface PadGroup {
  key: string;
  name: string;
  lat: number;
  lon: number;
  /** Sorted by T-0. */
  launches: SkyLaunch[];
}

/**
 * Launches the sky view can honestly place: not yet flown, with a T-0 firm to
 * the hour and real pad coordinates.
 *
 * Both conditions are accuracy, not tidiness. Whether a launch is in daylight,
 * twilight or darkness turns on the hour, so a launch pinned only to a day,
 * month or quarter has no meaningful verdict; upstream still supplies a full
 * timestamp for those, which would otherwise be treated as real. And an
 * unknown pad is sometimes filed at 0,0 (open ocean off Africa), which would
 * plot a launch where no launch site is.
 */
export function toSkyLaunches(launches: AnyLaunch[]): SkyLaunch[] {
  const out: SkyLaunch[] = [];
  for (const launch of launches) {
    if (hasFlown(launch.status)) continue;
    if (!hasPreciseTime(launch)) continue;
    const date = launchDate(launch);
    const coordinates = padCoordinates(launch);
    if (!date || !coordinates) continue;
    if (coordinates.lat === 0 && coordinates.lon === 0) continue;
    out.push({
      id: launch.id,
      slug: launch.slug,
      name: launch.name,
      rocket: rocketName(launch),
      provider: providerName(launch),
      padName: launch.pad?.name ?? 'Unknown pad',
      lat: coordinates.lat,
      lon: coordinates.lon,
      t: date.getTime(),
      statusAbbrev: launch.status?.abbrev ?? '',
    });
  }
  return out.sort((a, b) => a.t - b.t);
}

export function groupByPad(launches: SkyLaunch[]): PadGroup[] {
  const groups = new Map<string, PadGroup>();
  for (const launch of launches) {
    // Two decimals is ~1 km: pads sharing a complex collapse, distinct sites do not
    const key = `${launch.lat.toFixed(2)},${launch.lon.toFixed(2)}`;
    const group = groups.get(key);
    if (group) group.launches.push(launch);
    else
      groups.set(key, {
        key,
        name: launch.padName,
        lat: launch.lat,
        lon: launch.lon,
        launches: [launch],
      });
  }
  return [...groups.values()];
}

/** How fast the clock runs while playing, in minutes of scrubbed time per real second. */
export const SPEEDS = [
  { label: '10m/s', minutesPerSecond: 10 },
  { label: '1h/s', minutesPerSecond: 60 },
  { label: '6h/s', minutesPerSecond: 360 },
];

/** Time, in minutes, over which a launch reads as "happening" while scrubbing. */
const GLOW_MINUTES = 90;

/**
 * 0 to 1: how strongly a pad should light up at scrub time `t`, from its
 * nearest launch. A smooth bell rather than a hard window, so marks fade in
 * and out as the scrubber passes instead of popping.
 */
export function padGlow(group: PadGroup, t: number): number {
  let best = 0;
  for (const launch of group.launches) {
    const minutes = (launch.t - t) / 60_000;
    best = Math.max(best, Math.exp(-((minutes / GLOW_MINUTES) ** 2)));
  }
  return best;
}

/** The launch at a pad closest to `t`, preferring one still ahead of it. */
export function nearestLaunch(group: PadGroup, t: number): SkyLaunch {
  const upcoming = group.launches.find((l) => l.t >= t - 30 * 60_000);
  return upcoming ?? group.launches[group.launches.length - 1];
}

export interface VisibilityStyle {
  label: string;
  /** Chakra colour token, for text and badges. */
  token: string;
  /** Hex for SVG and canvas, which cannot resolve tokens. */
  hex: string;
  detail: string;
}

export const VISIBILITY: Record<Visibility, VisibilityStyle> = {
  plume: {
    label: 'Plume window',
    token: 'orange.300',
    hex: '#F6AD55',
    detail: 'Dark where you are, sunlit up high: the jellyfish plume can bloom.',
  },
  night: {
    label: 'Night launch',
    token: 'blue.300',
    hex: '#63B3ED',
    detail: 'In sight in the dark, as a moving flame.',
  },
  day: {
    label: 'Daytime',
    token: 'yellow.400',
    hex: '#ECC94B',
    detail: 'In sight, but a bright sky washes out all but the vehicle and its trail.',
  },
  below: {
    label: 'Over the horizon',
    token: 'text.secondary',
    hex: '#7A93B8',
    detail: 'Too far to see from here: the curve of the Earth is in the way.',
  },
};

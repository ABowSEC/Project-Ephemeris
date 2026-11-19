import { launchDate, padCoordinates, padCountryCode } from './launchFields';
import type { LaunchListItem } from '../types/launchLibrary';

export interface LaunchSite {
  key: string;
  name: string;
  countryCode: string | null;
  lat: number;
  lng: number;
  /** Upcoming launches from this site, soonest first. */
  launches: LaunchListItem[];
}

/** Timeframe filter for the map: hours ahead, or everything in the feed. */
export type MapWindow = '24h' | '7d' | '30d' | 'all';

export const MAP_WINDOWS: { value: MapWindow; label: string }[] = [
  { value: '24h', label: 'Next 24 hours' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: 'all', label: 'All upcoming' },
];

const WINDOW_MS: Record<MapWindow, number> = {
  '24h': 24 * 3_600_000,
  '7d': 7 * 86_400_000,
  '30d': 30 * 86_400_000,
  all: Infinity,
};

/** Launches whose T-0 falls within the window (or is unknown, for "all"). */
export function launchesInWindow(launches: LaunchListItem[], window: MapWindow, now = Date.now()) {
  const limit = now + WINDOW_MS[window];
  return launches.filter((launch) => {
    const date = launchDate(launch);
    if (!date) return window === 'all';
    return date.getTime() <= limit;
  });
}

/**
 * Group launches by launch-site location so one marker stands for a
 * spaceport (which can have several pads). Sites sort by their next launch.
 */
export function groupBySite(launches: LaunchListItem[]): LaunchSite[] {
  const sites = new Map<string, LaunchSite>();
  for (const launch of launches) {
    const coordinates = padCoordinates(launch);
    if (!coordinates) continue;
    const key = launch.pad?.location?.name ?? `${coordinates.lat.toFixed(1)},${coordinates.lon.toFixed(1)}`;
    let site = sites.get(key);
    if (!site) {
      site = {
        key,
        name: launch.pad?.location?.name ?? 'Unknown site',
        countryCode: padCountryCode(launch),
        lat: coordinates.lat,
        lng: coordinates.lon,
        launches: [],
      };
      sites.set(key, site);
    }
    site.launches.push(launch);
  }

  const time = (launch: LaunchListItem) => launchDate(launch)?.getTime() ?? Infinity;
  const list = [...sites.values()];
  for (const site of list) site.launches.sort((a, b) => time(a) - time(b));
  return list.sort((a, b) => time(a.launches[0]) - time(b.launches[0]));
}

/** "Vandenberg SFB" from "Vandenberg SFB, CA, USA". */
export function shortSiteName(site: LaunchSite): string {
  return site.name.split(',')[0].trim();
}

/** "CA, USA" or "People's Republic of China": what follows the short name. */
export function siteRegion(site: LaunchSite): string | null {
  const rest = site.name.split(',').slice(1).join(',').trim();
  return rest || null;
}

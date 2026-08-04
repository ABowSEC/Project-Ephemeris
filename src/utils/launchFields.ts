// Normalizers over the Launch Library payload.
//
// Two response modes with different field names, several fields that are
// strings where you'd expect numbers, and a T-0 whose precision varies from
// "to the second" to "sometime this quarter". Every component that reads a
// launch used to handle those quirks itself — inconsistently. They are handled
// here instead, once.

import type { AnyLaunch, LaunchDetailed, VideoUrl } from '../types/launchLibrary';

/**
 * The moment to count down to.
 *
 * The app used to disagree with itself: countdowns keyed off `window_start`
 * while alerts, calendar export, and the map sort used `net`. For a launch
 * with a four-hour window those are four hours apart, so the nav countdown and
 * the notification could differ by most of an afternoon. `net` is the target
 * T-0 and is what everything should use.
 */
export function launchTime(launch: AnyLaunch | null | undefined): string | null {
  return launch?.net ?? launch?.window_start ?? null;
}

export function launchDate(launch: AnyLaunch | null | undefined): Date | null {
  const iso = launchTime(launch);
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Permanent URL for a launch. The slug comes from upstream and is stable. */
export function launchPath(launch: Pick<AnyLaunch, 'slug'> | null | undefined): string {
  return launch?.slug ? `/launches/${launch.slug}` : '/launches';
}

// ── T-0 precision ───────────────────────────────────────────────────────────

const PRECISION_FORMATS: Record<string, Intl.DateTimeFormatOptions> = {
  SEC: { dateStyle: 'full', timeStyle: 'medium' },
  MIN: { dateStyle: 'full', timeStyle: 'short' },
  HOUR: { dateStyle: 'full', hour: 'numeric' },
  DAY: { dateStyle: 'full' },
  MONTH: { year: 'numeric', month: 'long' },
  QUARTER: { year: 'numeric' },
  YEAR: { year: 'numeric' },
};

/**
 * Format the T-0 at the precision upstream actually claims.
 *
 * Rendering "August 14, 2026 at 3:42:07 PM" for a launch only pinned to the
 * month is a lie the data does not support, and it is the kind of lie a
 * launch tracker gets judged on. Vague targets get the "NET" (no earlier than)
 * prefix that the industry uses for exactly this.
 */
export function formatNet(launch: AnyLaunch | null | undefined): string {
  const date = launchDate(launch);
  if (!date) return 'Date to be announced';

  const abbrev = launch?.net_precision?.abbrev ?? 'MIN';
  const format = PRECISION_FORMATS[abbrev] ?? PRECISION_FORMATS.MIN;
  const formatted = date.toLocaleString(undefined, format);

  const vague = abbrev !== 'SEC' && abbrev !== 'MIN';
  if (abbrev === 'QUARTER') {
    return `NET Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`;
  }
  return vague ? `NET ${formatted}` : formatted;
}

/** True when the T-0 is firm enough that a ticking countdown is meaningful. */
export function hasPreciseTime(launch: AnyLaunch | null | undefined): boolean {
  const abbrev = launch?.net_precision?.abbrev;
  // Missing precision means the older feed shape, which was always to the minute
  return !abbrev || abbrev === 'SEC' || abbrev === 'MIN' || abbrev === 'HOUR';
}

// ── Webcasts ────────────────────────────────────────────────────────────────

/**
 * All webcast links, best first.
 *
 * `mode=detailed` calls this `vidURLs` while the feed calls it `vid_urls`.
 * Rather than make every caller remember that, both are read here.
 */
export function webcasts(launch: AnyLaunch | null | undefined): VideoUrl[] {
  if (!launch) return [];
  const detailed = (launch as LaunchDetailed).vidURLs;
  const list = detailed ?? ('vid_urls' in launch ? launch.vid_urls : null) ?? [];
  // Upstream ranks with `priority`, ascending
  return [...list].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
}

/** The primary feed: an official webcast if there is one, else the top-ranked. */
export function officialWebcast(launch: AnyLaunch | null | undefined): VideoUrl | null {
  const all = webcasts(launch);
  return all.find((v) => v.type?.name === 'Official Webcast') ?? all[0] ?? null;
}

export interface EmbeddableVideo {
  provider: 'youtube' | 'vimeo';
  embedUrl: string;
}

/**
 * Whether a webcast URL can be shown inline.
 *
 * This is a hard constraint, not a preference: the CSP in public/_headers
 * allows frames only from YouTube and Vimeo. Webcasts are frequently hosted
 * elsewhere — x.com broadcasts are common for SpaceX — and those must be
 * rendered as outbound links or the iframe is silently blocked in production.
 */
export function embeddableVideo(url: string | null | undefined): EmbeddableVideo | null {
  if (!url) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, '');

  if (host === 'youtube.com' || host === 'm.youtube.com') {
    const id = parsed.searchParams.get('v') ?? parsed.pathname.match(/^\/(?:live|embed)\/([\w-]+)/)?.[1];
    if (id) return { provider: 'youtube', embedUrl: `https://www.youtube-nocookie.com/embed/${id}` };
  }
  if (host === 'youtu.be') {
    const id = parsed.pathname.slice(1);
    if (id) return { provider: 'youtube', embedUrl: `https://www.youtube-nocookie.com/embed/${id}` };
  }
  if (host === 'vimeo.com') {
    const id = parsed.pathname.match(/\/(\d+)/)?.[1];
    if (id) return { provider: 'vimeo', embedUrl: `https://player.vimeo.com/video/${id}` };
  }

  return null;
}

// ── Misc ────────────────────────────────────────────────────────────────────

/** Pad coordinates as numbers. LL2 sends them as strings. */
export function padCoordinates(
  launch: AnyLaunch | null | undefined
): { lat: number; lon: number } | null {
  const lat = Number(launch?.pad?.latitude);
  const lon = Number(launch?.pad?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

/** "Falcon 9 Block 5" — the rocket, however the payload spells it. */
export function rocketName(launch: AnyLaunch | null | undefined): string | null {
  const config = launch?.rocket?.configuration;
  return config?.full_name ?? config?.name ?? null;
}

export function providerName(launch: AnyLaunch | null | undefined): string | null {
  return launch?.launch_service_provider?.name ?? null;
}

/** "Space Launch Complex 40, Cape Canaveral SFS, FL, USA" */
export function padDescription(launch: AnyLaunch | null | undefined): string | null {
  const parts = [launch?.pad?.name, launch?.pad?.location?.name].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

/**
 * Weather probability, or null when not assessed. Upstream uses -1 as well as
 * null for "no forecast yet", and rendering "-1% favorable" would be absurd.
 */
export function weatherProbability(launch: AnyLaunch | null | undefined): number | null {
  const probability = (launch as LaunchDetailed | null | undefined)?.probability;
  if (probability == null || probability < 0) return null;
  return probability;
}

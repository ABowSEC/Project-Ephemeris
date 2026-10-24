// Helpers for reading Launch Library payloads. Handles both API versions
// (v2.2.0 copies linger in caches) and both response modes in one place.
//
// Also imported by functions/launches/[slug].ts, so keep it free of DOM APIs
// and runtime imports.

import type { AnyLaunch, InfoUrl, LaunchDetailed, VideoUrl } from '../types/launchLibrary';

/** The T-0 to count down to. Use this everywhere, not window_start. */
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
 * Format the T-0 only as precisely as upstream knows it. Vague dates get the
 * "NET" (no earlier than) prefix.
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

/** All webcast links, best first. (`vidURLs` in v2.2.0 detailed, else `vid_urls`.) */
export function webcasts(launch: AnyLaunch | null | undefined): VideoUrl[] {
  if (!launch) return [];
  const list = launch.vid_urls ?? (launch as LaunchDetailed).vidURLs ?? [];
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
 * Embed URL for YouTube/Vimeo, else null. The CSP only allows frames from those
 * two, so anything else (e.g. x.com) has to be a plain link.
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

/** "More information" links: `info_urls` in v2.3.0, `infoURLs` in v2.2.0. */
export function infoLinks(launch: AnyLaunch | null | undefined): InfoUrl[] {
  const detailed = launch as LaunchDetailed | null | undefined;
  return detailed?.info_urls ?? detailed?.infoURLs ?? [];
}

/** Pad coordinates as numbers. v2.2.0 sent strings, v2.3.0 sends numbers. */
export function padCoordinates(
  launch: AnyLaunch | null | undefined
): { lat: number; lon: number } | null {
  const lat = Number(launch?.pad?.latitude);
  const lon = Number(launch?.pad?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

/** e.g. "Falcon 9 Block 5" */
export function rocketName(launch: AnyLaunch | null | undefined): string | null {
  const config = launch?.rocket?.configuration;
  return config?.full_name ?? config?.name ?? null;
}

export function providerName(launch: AnyLaunch | null | undefined): string | null {
  return launch?.launch_service_provider?.name ?? null;
}

/** The launch's own image: a bare URL in v2.2.0, an image object in v2.3.0. */
export function launchImageUrl(launch: AnyLaunch | null | undefined): string | null {
  const image = launch?.image;
  if (!image) return null;
  return typeof image === 'string' ? image : image.image_url || null;
}

/** "Falcon": `family` in v2.2.0, the first of `families` in v2.3.0. */
export function rocketFamily(launch: AnyLaunch | null | undefined): string | null {
  const config = launch?.rocket?.configuration;
  return config?.families?.[0]?.name ?? config?.family ?? null;
}

/** Pad country as ISO alpha-3, e.g. "USA". */
export function padCountryCode(launch: AnyLaunch | null | undefined): string | null {
  return launch?.pad?.country?.alpha_3_code ?? launch?.pad?.location?.country_code ?? null;
}

const MINOR_WORDS = new Set(['of', 'and', 'the', 'for', 'de', 'du']);

/**
 * Provider initials: a short parenthesized abbreviation if there is one
 * ("CNES"), else initials of the main words ("MHI"), max four letters.
 */
export function providerInitials(name: string): string {
  const paren = name.match(/\(([A-Za-z]{2,5})\)/);
  if (paren) return paren[1].toUpperCase();
  const words = name
    .replace(/\(.*?\)/g, '')
    .split(/[\s-]+/)
    .filter((w) => w && !MINOR_WORDS.has(w.toLowerCase()));
  return words
    .slice(0, 4)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

/** "Space Launch Complex 40, Cape Canaveral SFS, FL, USA" */
export function padDescription(launch: AnyLaunch | null | undefined): string | null {
  const parts = [launch?.pad?.name, launch?.pad?.location?.name].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

/** Weather probability, or null if not forecast yet (upstream also uses -1). */
export function weatherProbability(launch: AnyLaunch | null | undefined): number | null {
  const probability = (launch as LaunchDetailed | null | undefined)?.probability;
  if (probability == null || probability < 0) return null;
  return probability;
}

// ── SEO text ────────────────────────────────────────────────────────────────
// Shared by the client and the edge function so titles and descriptions match.

const DESCRIPTION_LIMIT = 300;

function truncateWords(text: string, limit: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= limit) return clean;
  // Cut on a word boundary so the ellipsis doesn't land mid-word
  return `${clean.slice(0, clean.lastIndexOf(' ', limit - 1))}...`;
}

function formatLaunchDateUTC(launch: AnyLaunch): string {
  const iso = launchTime(launch);
  if (!iso) return 'a date to be announced';
  // UTC so the edge and the client produce the same text
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** The payload half of "{Rocket} | {Payload}", e.g. "GISAT-1A". */
function missionSideOfName(launch: AnyLaunch): string | null {
  const raw = launch?.name;
  if (!raw) return null;
  const parts = raw.split('|').map((p) => p.trim()).filter(Boolean);
  return parts.length >= 2 ? parts[1] : null;
}

/** Display name: mission name, else the payload half of the name, else the raw name. */
export function missionDisplayName(launch: AnyLaunch | null | undefined): string {
  if (!launch) return 'Launch Details';
  return launch.mission?.name?.trim() || missionSideOfName(launch) || launch.name;
}

/** Page title without the " · Ephemeris" suffix. */
export function buildLaunchTitle(launch: AnyLaunch | null | undefined): string {
  return `${missionDisplayName(launch)} Launch Date & Mission Details`;
}

/** Meta description: the mission description, or one built from provider/rocket/pad/date. */
export function buildLaunchDescription(launch: AnyLaunch | null | undefined): string {
  if (!launch) {
    return 'Live countdown, official webcast, and mission updates for an upcoming rocket launch.';
  }

  const mission = launch.mission?.description?.trim();
  if (mission) return truncateWords(mission, DESCRIPTION_LIMIT);

  const provider = providerName(launch);
  const rocket = rocketName(launch);
  const pad = padDescription(launch);

  const parts = [
    provider ? `${provider} is scheduled to launch` : 'Scheduled launch of',
    rocket ? `a ${rocket}` : 'a rocket',
    pad ? `from ${pad}` : null,
    `on ${formatLaunchDateUTC(launch)}.`,
    'Live countdown, official webcast, and mission updates.',
  ].filter(Boolean);

  return truncateWords(parts.join(' '), DESCRIPTION_LIMIT);
}

/** True once the launch has flown, whatever the outcome. */
function hasFlownName(statusName: string | null | undefined): boolean {
  return statusName === 'Launch Successful' || /failure/i.test(statusName ?? '');
}

/**
 * Mission overview paragraph for the page body. Uses the real description when
 * it's long enough, otherwise builds a short one from the fields we have.
 * Doesn't pad thin launches with filler.
 */
export function buildMissionSummary(launch: AnyLaunch | null | undefined): string {
  if (!launch) return '';

  const description = launch.mission?.description?.trim();
  const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;

  if (description && wordCount(description) >= 40) {
    // About 250 words
    return truncateWords(description, 1600);
  }

  const provider = providerName(launch);
  const rocket = rocketName(launch);
  const pad = padDescription(launch);
  const orbit = launch.mission?.orbit?.name;
  const missionType = launch.mission?.type;
  const subject = missionDisplayName(launch);

  const sentences: string[] = [];

  sentences.push(
    [
      subject,
      provider ? `is a${missionType ? ` ${missionType.toLowerCase()}` : ''} mission from ${provider}` : 'is an upcoming mission',
      rocket ? `launching aboard a ${rocket}` : null,
      pad ? `from ${pad}` : null,
      `, targeted for ${formatLaunchDateUTC(launch)}.`,
    ]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+([,.])/g, '$1')
  );

  if (orbit) {
    sentences.push(`The mission is targeting ${orbit} orbit.`);
  } else if (description) {
    // Too short to stand alone, but still worth including
    sentences.push(description);
  }

  // Detailed payload only
  const program = (launch as LaunchDetailed).program?.[0]?.name;
  if (program) {
    sentences.push(`It is part of the ${program} program.`);
  }

  sentences.push(
    hasFlownName(launch.status?.name)
      ? 'Find full mission details, timeline updates, and launch statistics below.'
      : 'Follow this page for a live countdown, the official webcast, and real-time mission updates as launch approaches.'
  );

  return sentences.join(' ');
}

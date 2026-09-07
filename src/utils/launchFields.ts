// Normalizers over the Launch Library payload.
//
// Two response modes with different field names, several fields that are
// strings where you'd expect numbers, and a T-0 whose precision varies from
// "to the second" to "sometime this quarter". Every component that reads a
// launch used to handle those quirks itself — inconsistently. They are handled
// here instead, once.
//
// This file is imported by a Cloudflare Pages Function (functions/launches/
// [slug].ts) as well as by the browser bundle, so it must stay dependency-free
// and DOM-free — no `window`/`document`/`localStorage`, no imports beyond
// types — the same constraint routeMeta.js documents for the same reason.

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

// ── SEO text ────────────────────────────────────────────────────────────────
//
// The single source of truth for a launch's <title>, meta description, and
// on-page mission summary — used by both the client (LaunchDetailPage's
// usePageMeta override) and the edge (functions/launches/[slug].ts's
// HTMLRewriter), so the two can never drift the way they used to.

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
  // Deliberately UTC: buildLaunchDescription/buildMissionSummary feed both the
  // edge (no meaningful "local" timezone there) and the client, and must agree
  // with each other regardless of which one renders it first.
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * The payload/mission side of an LL2 name, when it has one.
 *
 * LL2 names are conventionally "{Rocket} | {Payload}" (e.g. "GSLV Mk II |
 * GISAT-1A"). Leading with the payload is what a searcher actually typed —
 * nobody googles "GSLV Mk II", they google the satellite or mission name.
 */
function missionSideOfName(launch: AnyLaunch): string | null {
  const raw = launch?.name;
  if (!raw) return null;
  const parts = raw.split('|').map((p) => p.trim()).filter(Boolean);
  return parts.length >= 2 ? parts[1] : null;
}

/**
 * The name to lead with anywhere a launch is identified to a reader or a
 * search engine: the mission's own name when there is one, else the payload
 * side of the LL2 name, else the raw name. Used for the page's H1, its SEO
 * title, breadcrumbs, and Related Launches — one definition of "what this
 * launch is called" instead of each call site picking its own fallback chain.
 */
export function missionDisplayName(launch: AnyLaunch | null | undefined): string {
  if (!launch) return 'Launch Details';
  return launch.mission?.name?.trim() || missionSideOfName(launch) || launch.name;
}

/**
 * SEO title fragment for a launch page — everything before the " · Ephemeris"
 * suffix, which callers (usePageMeta, the edge function) append themselves.
 */
export function buildLaunchTitle(launch: AnyLaunch | null | undefined): string {
  return `${missionDisplayName(launch)} Launch Date & Mission Details`;
}

/**
 * One meta-description-length sentence: the mission's own description when
 * present, otherwise assembled from provider/rocket/pad/date. Shared by the
 * edge (og:description, twitter:description) and the client (usePageMeta) so
 * a link shared before hydration and one shared after never disagree.
 */
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

/** True once the launch has flown, whatever the outcome — string-based so this
 * file doesn't need to import data/launchStatus.ts for one boolean. */
function hasFlownName(statusName: string | null | undefined): boolean {
  return statusName === 'Launch Successful' || /failure/i.test(statusName ?? '');
}

/**
 * A short mission-overview paragraph for the page body (not meta tags).
 *
 * Real `mission.description` is used verbatim when it's already substantial
 * enough to read as a paragraph; otherwise one is synthesized from whatever
 * fields exist, so a launch with almost no editorial content still gets real,
 * non-boilerplate text instead of a thin page. The ~100-250 word target is a
 * ceiling on real descriptions, not a floor to pad thin ones toward — a launch
 * with nothing but a TBD name and no date does not have 100 honest words in
 * it, and filler text would hurt more than a short, accurate paragraph.
 */
export function buildMissionSummary(launch: AnyLaunch | null | undefined): string {
  if (!launch) return '';

  const description = launch.mission?.description?.trim();
  const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;

  if (description && wordCount(description) >= 40) {
    // ~250 words at a rough 6.4 chars/word average; caps an editorial blurb
    // rather than letting a multi-paragraph LL2 description run unbounded.
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
    // A real description exists but was just under the 40-word bar above —
    // fold it in rather than discard it.
    sentences.push(description);
  }

  // `program` only exists on the detailed payload, not the list/feed shape.
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

// Cache options for launch lookups, shared by api/launch/[slug] and
// launches/[slug] so they hit the same cache entries.

import { LL2_BASE, NotFoundError, readCached, type Ll2CacheOptions } from './ll2Cache';

/**
 * Lowercase kebab-case, e.g. "falcon-9-block-5-starlink-group-17-53".
 * Validate before any I/O: the slug ends up in an upstream URL and a KV key.
 */
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,119}$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

/** Statuses that mean the launch has happened and its record will not change. */
const TERMINAL_STATUSES = new Set([
  'Success',
  'Failure',
  'Partial Failure',
  'Launch Successful',
  'Launch Failure',
]);

// 20 min keeps the feed to 3 of our 15 calls/hour, leaving the rest for
// detail lookups. Schedules rarely change faster than that.
const UPCOMING_FRESH_SECONDS = 20 * 60;
const COMPLETED_FRESH_SECONDS = 6 * 60 * 60;

/** Flown launches don't change, so they stay fresh much longer. */
function freshSecondsForBody(body: string): number {
  try {
    const status = (JSON.parse(body) as { status?: { abbrev?: string; name?: string } }).status;
    const terminal =
      (status?.abbrev && TERMINAL_STATUSES.has(status.abbrev)) ||
      (status?.name && TERMINAL_STATUSES.has(status.name));
    return terminal ? COMPLETED_FRESH_SECONDS : UPCOMING_FRESH_SECONDS;
  } catch {
    return UPCOMING_FRESH_SECONDS;
  }
}

/** Cache options for one launch. Validate the slug first. Caches the bare launch, not the page. */
export function launchBySlugOptions(slug: string): Ll2CacheOptions {
  return {
    upstreamUrl: `${LL2_BASE}/launches/?slug=${encodeURIComponent(slug)}&mode=detailed&limit=1`,
    kvKey: `launch:${slug}`,
    freshSeconds: freshSecondsForBody,
    transform(raw) {
      const parsed = JSON.parse(raw) as { results?: unknown[] };
      const launch = parsed.results?.[0];
      if (!launch) throw new NotFoundError(`No launch with slug ${slug}`);
      return JSON.stringify(launch);
    },
    // If upstream fails with nothing cached, use the feed entry. It's missing
    // the detailed fields, but the page handles that.
    async fallback(context) {
      const feed = await readCached<{ results?: { slug?: string }[] }>(
        context,
        upcomingFeedOptions
      );
      const match = feed?.results?.find((launch) => launch.slug === slug);
      return match ? JSON.stringify(match) : null;
    },
  };
}

// The cron refreshes the feed every 15 min. If it's an hour stale, assume the
// cron is broken and let visitors fetch it.
const FEED_VISITOR_FETCH_AFTER_SECONDS = 60 * 60;

export const upcomingFeedOptions: Ll2CacheOptions = {
  upstreamUrl: `${LL2_BASE}/launches/upcoming/?limit=50`,
  kvKey: 'upcoming',
  freshSeconds: UPCOMING_FRESH_SECONDS,
  scheduledRefresh: { visitorFetchAfterSeconds: FEED_VISITOR_FETCH_AFTER_SECONDS },
  // Reject a bad 200 (error page, truncated body) so it can't replace a good copy
  transform(raw) {
    const parsed = JSON.parse(raw) as { results?: unknown };
    if (!Array.isArray(parsed.results)) throw new Error('Upcoming feed has no results array');
    return raw;
  },
};

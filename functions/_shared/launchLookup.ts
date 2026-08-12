// Slug-to-launch resolution, shared by the JSON endpoint (api/launch/[slug])
// and the HTML metadata rewriter (launches/[slug]). Both need identical
// validation and identical cache keys — if they diverged, the rewriter would
// spend a second upstream call to fetch what the API endpoint already cached.

import { LL2_BASE, NotFoundError, readCached, type Ll2CacheOptions } from './ll2Cache';

/**
 * Launch Library slugs are lowercase kebab-case, e.g.
 * "falcon-9-block-5-starlink-group-17-53".
 *
 * This is a security boundary, not a formatting nicety: the slug is
 * interpolated into an upstream query and used as a KV key, both reachable by
 * anyone who can type a URL. Validate before any I/O.
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

// Sized against the upstream budget, not against how fresh we would like the
// data to be. The free tier is 15 requests/hour, and the upcoming feed is
// refetched once per window for the whole site, so the window sets a floor on
// what the feed costs: 5 minutes spent 12 of the 15 on the feed alone and left
// detail-page lookups fighting over the remaining 3, which is what turned a
// cold cache on deploy day into 502s. At 20 minutes the feed costs 3/hour and
// the rest of the budget goes to slugs.
//
// Nothing user-visible regresses at this window: launch schedules move on the
// order of hours or days, the browser still revalidates every 60s
// (browserMaxAge), and the countdown is computed client-side from the launch
// time rather than from how recently we fetched it.
const UPCOMING_FRESH_SECONDS = 20 * 60;
const COMPLETED_FRESH_SECONDS = 6 * 60 * 60;

/**
 * A launch that already flew is effectively immutable, so its record can sit in
 * cache far longer than one that is still slipping. Reading the status off the
 * *stored body* means the TTL adjusts on its own the first time we re-fetch
 * after liftoff — no scheduled invalidation needed.
 */
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

/**
 * Cache options for one launch, by slug. Caller must have validated the slug.
 *
 * The upstream returns a paginated envelope even for a unique slug; the
 * transform unwraps it so every consumer — the browser, the metadata rewriter,
 * the cache itself — holds a plain launch object rather than each digging
 * through `results[0]` independently.
 */
export function launchBySlugOptions(slug: string): Ll2CacheOptions {
  return {
    upstreamUrl: `${LL2_BASE}/launch/?slug=${encodeURIComponent(slug)}&mode=detailed&limit=1`,
    kvKey: `launch:${slug}`,
    freshSeconds: freshSecondsForBody,
    transform(raw) {
      const parsed = JSON.parse(raw) as { results?: unknown[] };
      const launch = parsed.results?.[0];
      if (!launch) throw new NotFoundError(`No launch with slug ${slug}`);
      return JSON.stringify(launch);
    },
    // On the free tier the detailed lookup is the request most likely to be
    // refused, and a slug nobody has visited yet has no stale copy to fall back
    // on — which is exactly how a working site produced a hard 502 on a launch
    // that had just flown. The upcoming feed is a single call the site already
    // makes for everyone, and it carries this launch's name, status, image, and
    // T-0; only the detailed-only fields (updates timeline, webcasts, attempt
    // counts) are missing. A page without those beats no page at all, and the
    // client tolerates their absence already — it paints feed entries this way
    // when you click through from the list.
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

export const upcomingFeedOptions: Ll2CacheOptions = {
  upstreamUrl: `${LL2_BASE}/launch/upcoming/?limit=50`,
  kvKey: 'upcoming',
  freshSeconds: UPCOMING_FRESH_SECONDS,
};

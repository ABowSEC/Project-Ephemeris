// Slug-to-launch resolution, shared by the JSON endpoint (api/launch/[slug])
// and the HTML metadata rewriter (launches/[slug]). Both need identical
// validation and identical cache keys — if they diverged, the rewriter would
// spend a second upstream call to fetch what the API endpoint already cached.

import { LL2_BASE, NotFoundError, type Ll2CacheOptions } from './ll2Cache';

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

const UPCOMING_FRESH_SECONDS = 5 * 60;
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
  };
}

export const upcomingFeedOptions: Ll2CacheOptions = {
  upstreamUrl: `${LL2_BASE}/launch/upcoming/?limit=50`,
  kvKey: 'upcoming',
  freshSeconds: UPCOMING_FRESH_SECONDS,
};

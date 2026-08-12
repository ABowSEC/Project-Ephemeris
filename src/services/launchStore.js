// Shared store for upcoming-launch data.
//
// The Space Devs free tier allows only 15 requests/hour per IP, but several
// parts of the app want the same data (nav countdown, launches page hero,
// launch feed, world map, alert checks). Instead of each making its own
// request, they all read from here: one fetch of the next 50 launches,
// deduped while in flight and cached in localStorage with a freshness TTL.
// Stale cache is served as a fallback when the network or rate limit fails,
// which also gives the PWA offline something to render.

import { ApiError, fetchJson } from '../utils/fetchJson';

// On deployed hosts, launch data comes through our Pages Function proxy
// (functions/api/launches.js), which caches at the edge so Space Devs sees
// a handful of requests per hour no matter the visitor count. Local dev
// and LAN preview have no Functions runtime, so they call the API directly.
const DEPLOYED_HOSTS = /(\.pages\.dev|ephemeris-online\.com)$/;
const USES_PROXY = DEPLOYED_HOSTS.test(window.location.hostname);
const LL2_BASE = 'https://ll.thespacedevs.com/2.2.0';
const API_URL = USES_PROXY ? '/api/launches' : `${LL2_BASE}/launch/upcoming/?limit=50`;
const CACHE_KEY = 'ephemeris.upcomingLaunches.v1';
// Behind the proxy the edge cache absorbs refetches, so clients can ask
// every 5 min and catch scrubs and slips quickly. Direct API calls spend
// the free tier's 15/hour per-IP budget, so the TTL stretches to 15 min:
// an open tab costs 4 requests/hour, leaving room for other devices on
// the same home IP. Countdowns tick locally regardless of data age.
export const FRESH_MS = (USES_PROXY ? 5 : 15) * 60 * 1000;

let inflight = null;

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.data?.results)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), data }));
  } catch {
    // Storage full or unavailable: caching is best-effort
  }
}

/**
 * Synchronously return the last cached API payload (any age), or null.
 * Useful for consumers that must not trigger a network request.
 */
export function getCachedLaunches() {
  return readCache()?.data ?? null;
}

/**
 * Get the upcoming-launches API payload, hitting the network only when the
 * cache is older than FRESH_MS. Concurrent callers share one request.
 *
 * @param {Object}  [options]
 * @param {boolean} [options.force] Bypass the freshness check
 * @returns {Promise<any>} The API payload ({ results: [...] })
 */
export async function getUpcomingLaunches({ force = false } = {}) {
  const cached = readCache();
  if (!force && cached && Date.now() - cached.fetchedAt < FRESH_MS) {
    return cached.data;
  }

  if (!inflight) {
    inflight = fetchJson(API_URL, { timeoutMs: 12000 })
      .then((data) => {
        writeCache(data);
        return data;
      })
      .catch((err) => {
        // Serve stale data rather than an error whenever we have any
        if (cached) return cached.data;
        throw err;
      })
      .finally(() => {
        inflight = null;
      });
  }

  return inflight;
}

// ── Single launch, by slug ───────────────────────────────────────────────────
//
// The detail pages (/launches/<slug>) need the `mode=detailed` payload, which
// carries the updates timeline, webcast list, hold/fail reasons, and attempt
// statistics that the 50-launch feed omits. Same shape of caching as above,
// but keyed per launch and with a per-slug in-flight map instead of the single
// shared promise.

const LAUNCH_KEY_PREFIX = 'ephemeris.launch.';
const LAUNCH_KEY_SUFFIX = '.v1';

// A launch that has flown is a historical record and will not change again, so
// it can sit in cache for hours; one that is still upcoming can slip at any
// time. These mirror the TTLs the edge function uses.
const DETAIL_FRESH_MS = 5 * 60 * 1000;
const DETAIL_FLOWN_FRESH_MS = 6 * 60 * 60 * 1000;
// Entries this old are dropped on the next write, so browsing a lot of
// launches can't slowly fill localStorage.
const DETAIL_KEEP_MS = 7 * 24 * 60 * 60 * 1000;

const TERMINAL_STATUSES = new Set(['Success', 'Failure', 'Partial Failure']);

const detailInflight = new Map();

const detailKey = (slug) => `${LAUNCH_KEY_PREFIX}${slug}${LAUNCH_KEY_SUFFIX}`;

function detailFreshMs(launch) {
  return TERMINAL_STATUSES.has(launch?.status?.abbrev) ? DETAIL_FLOWN_FRESH_MS : DETAIL_FRESH_MS;
}

function readDetailCache(slug) {
  try {
    const raw = localStorage.getItem(detailKey(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.data?.id ? parsed : null;
  } catch {
    return null;
  }
}

function writeDetailCache(slug, data) {
  try {
    localStorage.setItem(detailKey(slug), JSON.stringify({ fetchedAt: Date.now(), data }));
    pruneDetailCache();
  } catch {
    // Storage full or unavailable: caching is best-effort
  }
}

// Drop long-untouched detail entries. Cheap enough to run on write, and it
// keeps the number of keys bounded without needing a separate index.
function pruneDetailCache() {
  const cutoff = Date.now() - DETAIL_KEEP_MS;
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (!key?.startsWith(LAUNCH_KEY_PREFIX)) continue;
    try {
      const { fetchedAt } = JSON.parse(localStorage.getItem(key)) ?? {};
      if (!fetchedAt || fetchedAt < cutoff) localStorage.removeItem(key);
    } catch {
      localStorage.removeItem(key);
    }
  }
}

/**
 * Synchronously return whatever we already know about a launch, or null.
 *
 * Falls back to the entry in the upcoming feed when there is no detailed copy
 * yet. That entry lacks the detailed-only fields, but it has the name, image,
 * provider, and T-0 — enough for the detail page to paint immediately when the
 * user clicks through from the list, instead of showing a spinner for data
 * that is already in memory.
 *
 * @param {string} slug
 * @returns {any | null}
 */
export function getCachedLaunchBySlug(slug) {
  const cached = readDetailCache(slug);
  if (cached) return cached.data;
  return getCachedLaunches()?.results?.find((launch) => launch.slug === slug) ?? null;
}

/**
 * Get one launch by its Launch Library slug, hitting the network only when the
 * cached copy is stale. Concurrent callers for the same slug share a request.
 *
 * @param {string}  slug
 * @param {Object}  [options]
 * @param {boolean} [options.force] Bypass the freshness check
 * @returns {Promise<any>} The launch object (not the paginated envelope)
 */
export async function getLaunchBySlug(slug, { force = false } = {}) {
  const cached = readDetailCache(slug);
  if (!force && cached && Date.now() - cached.fetchedAt < detailFreshMs(cached.data)) {
    return cached.data;
  }

  if (!detailInflight.has(slug)) {
    // The proxy unwraps the envelope for us; a direct call in local dev does
    // not, so the two paths converge here rather than at every call site.
    const url = USES_PROXY
      ? `/api/launch/${encodeURIComponent(slug)}`
      : `${LL2_BASE}/launch/?slug=${encodeURIComponent(slug)}&mode=detailed&limit=1`;

    const request = fetchJson(url, { timeoutMs: 12000 })
      .then((payload) => {
        const launch = USES_PROXY ? payload : payload?.results?.[0];
        if (!launch?.id) throw new ApiError('That launch could not be found.', 404);
        writeDetailCache(slug, launch);
        return launch;
      })
      .catch((err) => {
        // Stale data beats an error page, but a 404 is a real answer: the slug
        // does not exist, and retrying or showing an old copy would both be wrong.
        if (err?.status === 404) throw err;
        if (cached) return cached.data;
        // Never fetched this launch before and the endpoint is down. The feed
        // is a separate request that may well have succeeded, and it carries
        // this launch — the same lesser copy getCachedLaunchBySlug already
        // hands the page on a cold click-through. Prefer it to an error page.
        const fromFeed = getCachedLaunches()?.results?.find((launch) => launch.slug === slug);
        if (fromFeed) return fromFeed;
        throw err;
      })
      .finally(() => {
        detailInflight.delete(slug);
      });

    detailInflight.set(slug, request);
  }

  return detailInflight.get(slug);
}

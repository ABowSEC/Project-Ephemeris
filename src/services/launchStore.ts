// Shared store for upcoming-launch data.
//
// The Space Devs free tier allows only 15 requests/hour per IP, but several
// parts of the app want the same data (nav countdown, launches page hero,
// launch feed, world map, alert checks). Instead of each making its own
// request, they all read from here: one fetch of the next 50 launches,
// deduped while in flight and cached in localStorage with a freshness TTL.
// Stale cache is served as a fallback when the network or rate limit fails,
// which also gives the PWA offline something to render.

import { ApiError, fetchJson, fetchJsonWithHeaders } from '../utils/fetchJson';
import type {
  AnyLaunch,
  LaunchDetailed,
  Paginated,
  UpcomingLaunchesResponse,
} from '../types/launchLibrary';

// On deployed hosts, launch data comes through our Pages Function proxy
// (functions/api/launches.ts), which caches at the edge so Space Devs sees
// a handful of requests per hour no matter the visitor count. Local dev
// and LAN preview have no Functions runtime, so they call the API directly.
const DEPLOYED_HOSTS = /(\.pages\.dev|ephemeris-online\.com)$/;
const USES_PROXY = DEPLOYED_HOSTS.test(window.location.hostname);
const LL2_BASE = 'https://ll.thespacedevs.com/2.3.0';
const API_URL = USES_PROXY ? '/api/launches' : `${LL2_BASE}/launches/upcoming/?limit=50`;
// Still v1 after the v2.3.0 switch, on purpose: a visitor's last good copy is
// worth keeping through the migration, and launchFields reads both shapes.
const CACHE_KEY = 'ephemeris.upcomingLaunches.v1';
// Behind the proxy the edge cache absorbs refetches, so clients can ask
// every 5 min and catch scrubs and slips quickly. Direct API calls spend
// the free tier's 15/hour per-IP budget, so the TTL stretches to 15 min:
// an open tab costs 4 requests/hour, leaving room for other devices on
// the same home IP. Countdowns tick locally regardless of data age.
export const FRESH_MS = (USES_PROXY ? 5 : 15) * 60 * 1000;

export interface CacheEntry<T> {
  /** When upstream produced the data: what "how old is this" is judged by. */
  fetchedAt: number;
  /**
   * When this browser last got an answer. Freshness (whether to ask again) is
   * judged by this, not fetchedAt: the edge serves copies up to ~20 min old by
   * design, and judging by their upstream age would make every check refetch.
   * Absent on entries written before it existed.
   */
  checkedAt?: number;
  data: T;
}

const lastChecked = (entry: CacheEntry<unknown>) => entry.checkedAt ?? entry.fetchedAt;

let inflight: Promise<UpcomingLaunchesResponse> | null = null;

// ── Subscriptions ────────────────────────────────────────────────────────────
//
// Every component showing launches (nav countdown, hero, feed, map, strip)
// used to hold its own copy in useApi state, so a refresh one of them made
// reached the others only on their own next timer tick, and a returning
// visitor could see two different "next launches" at once. They now read one
// snapshot through useSyncExternalStore, and every write notifies them all,
// including writes from other tabs via the storage event.

type Listener = () => void;
const listeners = new Set<Listener>();
// undefined = not read yet; null = read, nothing cached
let snapshot: CacheEntry<UpcomingLaunchesResponse> | null | undefined;

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeUpcomingLaunches(listener: Listener): () => void {
  if (listeners.size === 0) window.addEventListener('storage', onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('storage', onStorage);
  };
}

function onStorage(event: StorageEvent): void {
  if (event.key !== CACHE_KEY) return;
  snapshot = readCache();
  notify();
}

/** Stable between writes, as useSyncExternalStore requires. */
export function getUpcomingLaunchesSnapshot(): CacheEntry<UpcomingLaunchesResponse> | null {
  if (snapshot === undefined) snapshot = readCache();
  return snapshot;
}

/**
 * When upstream actually produced this data. The proxy says so in
 * x-fetched-at, which matters when it is serving a stale copy through an
 * upstream outage: stamping that with the time it reached the browser would
 * present hours- or days-old data as current. Direct API calls have no such
 * header, and their data is as fresh as the response.
 */
function fetchedAtFrom(headers: Headers): number {
  const fetchedAt = Number(headers.get('x-fetched-at'));
  return fetchedAt > 0 ? fetchedAt : Date.now();
}

function readCache(): CacheEntry<UpcomingLaunchesResponse> | null {
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

function writeCache(data: UpcomingLaunchesResponse, fetchedAt: number): void {
  const entry = { fetchedAt, checkedAt: Date.now(), data };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Storage full or unavailable: caching is best-effort
  }
  // Subscribers get the new data even when storage refused it
  snapshot = entry;
  notify();
}

/**
 * Synchronously return the last cached API payload (any age), or null.
 * Useful for consumers that must not trigger a network request.
 */
export function getCachedLaunches(): UpcomingLaunchesResponse | null {
  return getUpcomingLaunchesSnapshot()?.data ?? null;
}

/**
 * When the cached upcoming-launches payload was actually fetched, or null if
 * there is no cache yet. Distinct from "is it fresh" (FRESH_MS governs that
 * for deciding whether to refetch) — this is for telling a visitor their data
 * might be old, which matters most when repeated refetches keep failing (see
 * the stale-on-error fallback in getUpcomingLaunches) and nothing else would
 * otherwise reveal that to them.
 */
export function getUpcomingLaunchesFetchedAt(): number | null {
  return getUpcomingLaunchesSnapshot()?.fetchedAt ?? null;
}

/**
 * Get the upcoming-launches API payload, hitting the network only when this
 * browser last checked more than FRESH_MS ago. Concurrent callers share one
 * request. `force` also bypasses the browser's HTTP cache, so a manual refresh
 * really reaches the proxy.
 */
export async function getUpcomingLaunches({ force = false }: { force?: boolean } = {}): Promise<UpcomingLaunchesResponse> {
  const cached = getUpcomingLaunchesSnapshot();
  if (!force && cached && Date.now() - lastChecked(cached) < FRESH_MS) {
    return cached.data;
  }

  if (!inflight) {
    inflight = fetchFeed(force, cached).finally(() => {
      inflight = null;
    });
  }

  return inflight;
}

// ── Direct fallback ──────────────────────────────────────────────────────────
//
// The feed's fallbacks are layered, each used only when the one before it is
// rate limited:
//   1. scripts/refresh-launches.ts (GitHub Actions) and the
//      workers/ll2-refresh cron Worker each write the feed to KV every 15
//      minutes, and the proxy serves that copy.
//   2. Once the copy is over an hour old, the proxy asks Space Devs itself
//      (functions/_shared/ll2Cache.ts). Its calls come from Cloudflare IPs
//      that other sites share, so they can draw 429s too.
//   3. When the proxy says that ask was refused with a 429 (the
//      x-upstream-rate-limited header, on a stale copy or on a 503), this
//      browser asks Space Devs directly, spending the visitor's own 15
//      calls/hour. The result stays in this browser: it is never written
//      back to KV, which can't trust a copy a client sends.

const DIRECT_URL = `${LL2_BASE}/launches/upcoming/?limit=50`;
const RATE_LIMITED_HEADER = 'x-upstream-rate-limited';

// At most one direct call per window, shared by every tab through
// localStorage: 4 an hour, well inside the visitor's 15. A manual refresh
// skips the wait.
const DIRECT_MIN_INTERVAL_MS = 15 * 60 * 1000;
const DIRECT_ATTEMPT_KEY = 'ephemeris.directFeedAttemptAt';

function claimDirectAttempt(force: boolean): boolean {
  try {
    const last = Number(localStorage.getItem(DIRECT_ATTEMPT_KEY)) || 0;
    if (!force && Date.now() - last < DIRECT_MIN_INTERVAL_MS) return false;
    localStorage.setItem(DIRECT_ATTEMPT_KEY, String(Date.now()));
  } catch {
    // Without storage there is no cross-tab throttle; FRESH_MS still spaces
    // this tab's checks, so allow it.
  }
  return true;
}

async function fetchDirect(): Promise<UpcomingLaunchesResponse | null> {
  try {
    const data = await fetchJson<UpcomingLaunchesResponse>(DIRECT_URL, { timeoutMs: 12000, cache: 'no-store' });
    return Array.isArray(data?.results) ? data : null;
  } catch {
    return null;
  }
}

async function fetchFeed(
  force: boolean,
  cached: CacheEntry<UpcomingLaunchesResponse> | null
): Promise<UpcomingLaunchesResponse> {
  let proxied: CacheEntry<UpcomingLaunchesResponse> | null = null;
  let proxyError: unknown = null;
  let rateLimited = false;
  try {
    const { data, headers } = await fetchJsonWithHeaders<UpcomingLaunchesResponse>(API_URL, {
      timeoutMs: 12000,
      cache: force ? 'no-store' : 'default',
    });
    proxied = { data, fetchedAt: fetchedAtFrom(headers) };
    rateLimited = headers.get(RATE_LIMITED_HEADER) === '1';
  } catch (err) {
    proxyError = err;
    rateLimited = err instanceof ApiError && err.headers?.get(RATE_LIMITED_HEADER) === '1';
  }

  if (USES_PROXY && rateLimited && claimDirectAttempt(force)) {
    const direct = await fetchDirect();
    if (direct) {
      writeCache(direct, Date.now());
      return direct;
    }
  }

  // Keep whichever copy is newer: a direct fetch from earlier can be fresher
  // than what the rate-limited proxy is still serving. Rewriting the kept
  // copy also records this check, so the next one waits out FRESH_MS.
  const newest = proxied && (!cached || proxied.fetchedAt >= cached.fetchedAt) ? proxied : cached;
  if (newest) {
    writeCache(newest.data, newest.fetchedAt);
    return newest.data;
  }
  throw proxyError;
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
// time. The flown TTL mirrors the edge's; the upcoming one is shorter than the
// edge's 20 min on purpose, so a scrub the edge has already picked up reaches
// an open detail page within minutes rather than after a second 20 min wait.
const DETAIL_FRESH_MS = 5 * 60 * 1000;
const DETAIL_FLOWN_FRESH_MS = 6 * 60 * 60 * 1000;
// Entries this old are dropped on the next write, so browsing a lot of
// launches can't slowly fill localStorage.
const DETAIL_KEEP_MS = 7 * 24 * 60 * 60 * 1000;

// Same set as functions/_shared/launchLookup.ts, which also matches on name
const TERMINAL_STATUSES = new Set([
  'Success',
  'Failure',
  'Partial Failure',
  'Launch Successful',
  'Launch Failure',
]);

const detailInflight = new Map<string, Promise<AnyLaunch>>();

const detailKey = (slug: string) => `${LAUNCH_KEY_PREFIX}${slug}${LAUNCH_KEY_SUFFIX}`;

function detailFreshMs(launch: AnyLaunch): number {
  const terminal =
    TERMINAL_STATUSES.has(launch?.status?.abbrev) || TERMINAL_STATUSES.has(launch?.status?.name);
  return terminal ? DETAIL_FLOWN_FRESH_MS : DETAIL_FRESH_MS;
}

function readDetailCache(slug: string): CacheEntry<LaunchDetailed> | null {
  try {
    const raw = localStorage.getItem(detailKey(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.data?.id ? parsed : null;
  } catch {
    return null;
  }
}

function writeDetailCache(slug: string, data: LaunchDetailed, fetchedAt: number): void {
  try {
    localStorage.setItem(detailKey(slug), JSON.stringify({ fetchedAt, checkedAt: Date.now(), data }));
    pruneDetailCache();
  } catch {
    // Storage full or unavailable: caching is best-effort
  }
}

// Drop long-untouched detail entries. Cheap enough to run on write, and it
// keeps the number of keys bounded without needing a separate index.
function pruneDetailCache(): void {
  const cutoff = Date.now() - DETAIL_KEEP_MS;
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (!key?.startsWith(LAUNCH_KEY_PREFIX)) continue;
    try {
      const { fetchedAt } = JSON.parse(localStorage.getItem(key) ?? 'null') ?? {};
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
 */
export function getCachedLaunchBySlug(slug: string): AnyLaunch | null {
  const cached = readDetailCache(slug);
  if (cached) return cached.data;
  return getCachedLaunches()?.results?.find((launch) => launch.slug === slug) ?? null;
}

// The detail pages get the same last-resort fallback as the feed (see
// "Direct fallback" above): only when /api/launch/<slug> says its upstream
// ask was refused with a 429 does the browser look the launch up on Space
// Devs itself, and the copy stays in this browser. These calls share the
// visitor's 15/hour with the feed's (at most 4), so they are capped at
// DIRECT_DETAIL_PER_HOUR across all tabs, a manual refresh included.
const DIRECT_DETAIL_PER_HOUR = 6;
const DIRECT_DETAIL_ATTEMPTS_KEY = 'ephemeris.directDetailAttempts';
const HOUR_MS = 60 * 60 * 1000;

function claimDirectDetailAttempt(): boolean {
  try {
    const now = Date.now();
    const parsed: unknown = JSON.parse(localStorage.getItem(DIRECT_DETAIL_ATTEMPTS_KEY) ?? '[]');
    const recent = (Array.isArray(parsed) ? parsed : []).filter(
      (at): at is number => typeof at === 'number' && now - at < HOUR_MS
    );
    if (recent.length >= DIRECT_DETAIL_PER_HOUR) return false;
    localStorage.setItem(DIRECT_DETAIL_ATTEMPTS_KEY, JSON.stringify([...recent, now]));
  } catch {
    // Without storage there is no shared cap; each lookup is still spaced by
    // the detail cache's freshness window, so allow it.
  }
  return true;
}

const directDetailUrl = (slug: string) =>
  `${LL2_BASE}/launches/?slug=${encodeURIComponent(slug)}&mode=detailed&limit=1`;

async function fetchDetailDirect(slug: string): Promise<LaunchDetailed | null> {
  try {
    const page = await fetchJson<Paginated<LaunchDetailed>>(directDetailUrl(slug), {
      timeoutMs: 12000,
      cache: 'no-store',
    });
    const launch = page?.results?.[0];
    return launch?.id ? launch : null;
  } catch {
    return null;
  }
}

async function fetchDetail(
  slug: string,
  force: boolean,
  cached: CacheEntry<LaunchDetailed> | null
): Promise<AnyLaunch> {
  // The proxy unwraps the envelope for us; a direct call in local dev does
  // not, so the two paths converge here rather than at every call site.
  const url = USES_PROXY ? `/api/launch/${encodeURIComponent(slug)}` : directDetailUrl(slug);

  let proxied: CacheEntry<LaunchDetailed> | null = null;
  // The proxy's lesser stand-in: the launch's entry from the feed, without
  // the detailed-only fields. Never preferred over a cached detailed copy.
  let proxiedIsFeedEntry = false;
  let proxyError: unknown = null;
  let rateLimited = false;
  try {
    const { data: payload, headers } = await fetchJsonWithHeaders<LaunchDetailed | Paginated<LaunchDetailed>>(url, {
      timeoutMs: 12000,
      cache: force ? 'no-store' : 'default',
    });
    const launch = USES_PROXY
      ? (payload as LaunchDetailed)
      : (payload as Paginated<LaunchDetailed>)?.results?.[0];
    if (!launch?.id) throw new ApiError('That launch could not be found.', 404);
    proxied = { data: launch, fetchedAt: fetchedAtFrom(headers) };
    proxiedIsFeedEntry = headers.get('x-proxy-cache') === 'FALLBACK';
    rateLimited = headers.get(RATE_LIMITED_HEADER) === '1';
  } catch (err) {
    // A 404 is a real answer: the slug does not exist, and retrying, going
    // direct, or showing an old copy would all be wrong.
    if ((err as ApiError)?.status === 404) throw err;
    proxyError = err;
    rateLimited = err instanceof ApiError && err.headers?.get(RATE_LIMITED_HEADER) === '1';
  }

  if (USES_PROXY && rateLimited && claimDirectDetailAttempt()) {
    const direct = await fetchDetailDirect(slug);
    if (direct) {
      writeDetailCache(slug, direct, Date.now());
      return direct as AnyLaunch;
    }
  }

  if (proxied && proxiedIsFeedEntry) {
    // Shown, never cached: it carries no x-fetched-at, so it would be stamped
    // as brand new and could outrank a real detailed copy later.
    return (cached?.data ?? proxied.data) as AnyLaunch;
  }
  if (proxied) {
    // A rate-limited proxy is serving its last stale copy, and an earlier
    // direct lookup in this browser can be newer: keep whichever is.
    const newest = rateLimited && cached && cached.fetchedAt > proxied.fetchedAt ? cached : proxied;
    writeDetailCache(slug, newest.data, newest.fetchedAt);
    return newest.data as AnyLaunch;
  }
  // Stale data beats an error page.
  if (cached) return cached.data;
  // Never fetched this launch before and the endpoint is down. The feed is a
  // separate request that may well have succeeded, and it carries this
  // launch: the same lesser copy getCachedLaunchBySlug already hands the page
  // on a cold click-through. Prefer it to an error page.
  const fromFeed = getCachedLaunches()?.results?.find((launch) => launch.slug === slug);
  if (fromFeed) return fromFeed;
  throw proxyError;
}

/**
 * Get one launch by its Launch Library slug, hitting the network only when the
 * cached copy is stale. Concurrent callers for the same slug share a request.
 * Resolves to the launch object (not the paginated envelope).
 */
export async function getLaunchBySlug(slug: string, { force = false }: { force?: boolean } = {}): Promise<AnyLaunch> {
  const cached = readDetailCache(slug);
  if (!force && cached && Date.now() - lastChecked(cached) < detailFreshMs(cached.data)) {
    return cached.data;
  }

  if (!detailInflight.has(slug)) {
    const request = fetchDetail(slug, force, cached).finally(() => {
      detailInflight.delete(slug);
    });
    detailInflight.set(slug, request);
  }

  return detailInflight.get(slug)!;
}

// Shared store for upcoming-launch data.
//
// The Space Devs free tier allows only 15 requests/hour per IP, but several
// parts of the app want the same data (nav countdown, launches page hero,
// launch feed, world map, alert checks). Instead of each making its own
// request, they all read from here: one fetch of the next 50 launches,
// deduped while in flight and cached in localStorage with a freshness TTL.
// Stale cache is served as a fallback when the network or rate limit fails,
// which also gives the PWA offline something to render.

import { ApiError, fetchJsonWithHeaders } from '../utils/fetchJson';
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
    inflight = fetchJsonWithHeaders<UpcomingLaunchesResponse>(API_URL, {
      timeoutMs: 12000,
      cache: force ? 'no-store' : 'default',
    })
      .then(({ data, headers }) => {
        writeCache(data, fetchedAtFrom(headers));
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
    // The proxy unwraps the envelope for us; a direct call in local dev does
    // not, so the two paths converge here rather than at every call site.
    const url = USES_PROXY
      ? `/api/launch/${encodeURIComponent(slug)}`
      : `${LL2_BASE}/launches/?slug=${encodeURIComponent(slug)}&mode=detailed&limit=1`;

    const request = fetchJsonWithHeaders<LaunchDetailed | Paginated<LaunchDetailed>>(url, {
      timeoutMs: 12000,
      cache: force ? 'no-store' : 'default',
    })
      .then(({ data: payload, headers }) => {
        const launch = USES_PROXY
          ? (payload as LaunchDetailed)
          : (payload as Paginated<LaunchDetailed>)?.results?.[0];
        if (!launch?.id) throw new ApiError('That launch could not be found.', 404);
        writeDetailCache(slug, launch, fetchedAtFrom(headers));
        return launch as AnyLaunch;
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

  return detailInflight.get(slug)!;
}

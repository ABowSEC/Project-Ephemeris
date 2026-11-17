// Shared launch data store. Every component reads the same cached fetch so
// we stay under the API's 15 requests/hour. Stale cache is served when the
// network fails, which also covers offline use.

import { ApiError, fetchJsonWithHeaders } from '../utils/fetchJson';
import type {
  AnyLaunch,
  LaunchDetailed,
  Paginated,
  UpcomingLaunchesResponse,
} from '../types/launchLibrary';

// Deployed sites use our edge proxy (functions/api/). Local dev has no
// Functions runtime, so it calls the API directly.
const DEPLOYED_HOSTS = /(\.pages\.dev|ephemeris-online\.com)$/;
const USES_PROXY = DEPLOYED_HOSTS.test(window.location.hostname);
const LL2_BASE = 'https://ll.thespacedevs.com/2.3.0';
const API_URL = USES_PROXY ? '/api/launches' : `${LL2_BASE}/launches/upcoming/?limit=50`;
// Still v1 on purpose: launchFields reads both API versions
const CACHE_KEY = 'ephemeris.upcomingLaunches.v1';
// 5 min behind the proxy. Direct API calls use 15 min to save rate limit.
export const FRESH_MS = (USES_PROXY ? 5 : 15) * 60 * 1000;

export interface CacheEntry<T> {
  /** When upstream produced the data. Used to show data age. */
  fetchedAt: number;
  /**
   * When this browser last fetched. Used to decide when to refetch, since the
   * edge may hand us a copy that's already a few minutes old.
   */
  checkedAt?: number;
  data: T;
}

const lastChecked = (entry: CacheEntry<unknown>) => entry.checkedAt ?? entry.fetchedAt;

let inflight: Promise<UpcomingLaunchesResponse> | null = null;

// ── Subscriptions ────────────────────────────────────────────────────────────
// Components read one snapshot via useSyncExternalStore, so they all update
// together (including from other tabs via the storage event).

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

/** When upstream produced the data. The proxy sends x-fetched-at; direct calls are fresh. */
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

/** Last cached payload (any age), or null. Never hits the network. */
export function getCachedLaunches(): UpcomingLaunchesResponse | null {
  return getUpcomingLaunchesSnapshot()?.data ?? null;
}

/** When the cached data was produced, for showing visitors how old it is. */
export function getUpcomingLaunchesFetchedAt(): number | null {
  return getUpcomingLaunchesSnapshot()?.fetchedAt ?? null;
}

/**
 * Upcoming launches, fetched at most every FRESH_MS. Concurrent callers share
 * one request. `force` also skips the browser HTTP cache.
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
// Detail pages need the `mode=detailed` payload. Same caching as above, per slug.

const LAUNCH_KEY_PREFIX = 'ephemeris.launch.';
const LAUNCH_KEY_SUFFIX = '.v1';

// Flown launches don't change, so cache them much longer
const DETAIL_FRESH_MS = 5 * 60 * 1000;
const DETAIL_FLOWN_FRESH_MS = 6 * 60 * 60 * 1000;
// Older entries get pruned so localStorage doesn't fill up
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
 * Whatever we already have for a launch, or null. Falls back to the feed entry
 * so the detail page can render right away on click-through.
 */
export function getCachedLaunchBySlug(slug: string): AnyLaunch | null {
  const cached = readDetailCache(slug);
  if (cached) return cached.data;
  return getCachedLaunches()?.results?.find((launch) => launch.slug === slug) ?? null;
}

/** One launch by slug, fetched only when stale. Concurrent callers share a request. */
export async function getLaunchBySlug(slug: string, { force = false }: { force?: boolean } = {}): Promise<AnyLaunch> {
  const cached = readDetailCache(slug);
  if (!force && cached && Date.now() - lastChecked(cached) < detailFreshMs(cached.data)) {
    return cached.data;
  }

  if (!detailInflight.has(slug)) {
    // The proxy returns the bare launch; the direct API returns a page of results
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
        // A 404 means the launch doesn't exist; don't fall back
        if (err?.status === 404) throw err;
        if (cached) return cached.data;
        // No detailed copy yet: the feed entry beats an error page
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

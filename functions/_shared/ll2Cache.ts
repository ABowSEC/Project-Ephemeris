// Edge cache for the Space Devs (Launch Library 2) API.
//
// The free tier allows 15 requests/hour per IP. Proxying through here means
// Cloudflare spends that budget once, not every visitor.
//
// Two tiers:
//   L1  caches.default  - per-PoP, fast
//   L2  LAUNCHES_CACHE  - global Workers KV, so a cold PoP still has a stale
//                         copy to fall back on when upstream fails
//
// Optional bindings (Pages project settings): LAUNCHES_CACHE (without it we
// run on L1 + upstream) and LL2_TOKEN for a paid key (server-side only).

export const LL2_BASE = 'https://ll.thespacedevs.com/2.3.0';

// How long to keep a copy for stale-on-error, not how long it's fresh.
// A month-old schedule beats an error page during a long rate limit.
const DEFAULT_KEEP_SECONDS = 30 * 24 * 60 * 60;
const DEFAULT_BROWSER_MAX_AGE = 60;

// Retry transient failures (timeouts, 5xx) a couple of times before giving up.
const UPSTREAM_ATTEMPTS = 3;
const RETRY_BASE_MS = 400;
const UPSTREAM_TIMEOUT_MS = 8000;

// Don't retry 429s: they'll fail again and each attempt costs budget.
function isRetryableStatus(status: number): boolean {
  return status >= 500 || status === 408;
}

// After a 429, stop calling upstream until the limit resets. Shared across
// endpoints and PoPs via KV, with an in-memory copy to skip the KV read.
const COOLDOWN_KV_KEY = 'll2:cooldown';
const COOLDOWN_DEFAULT_SECONDS = 15 * 60;
const COOLDOWN_MIN_SECONDS = 60;
const COOLDOWN_MAX_SECONDS = 60 * 60;

let isolateCooldownUntil = 0;

/** Upstream answered with a status we can't use. */
export class UpstreamError extends Error {
  constructor(
    readonly status: number,
    readonly retryAfterSeconds: number | null = null
  ) {
    super(`upstream status ${status}`);
    this.name = 'UpstreamError';
  }
}

/** Our own visitor cap was hit. Treated like a 429, but doesn't start the cooldown. */
export class VisitorBudgetError extends UpstreamError {
  constructor(retryAfterSeconds: number) {
    super(429, retryAfterSeconds);
    this.name = 'VisitorBudgetError';
  }
}

/** Retry-After is either delta-seconds or an HTTP date. */
function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds);
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, (date - Date.now()) / 1000);
}

export async function readCooldown(kv: KVNamespace | undefined): Promise<number> {
  if (isolateCooldownUntil > Date.now()) return isolateCooldownUntil;
  if (!kv) return 0;
  try {
    const until = Number(await kv.get(COOLDOWN_KV_KEY)) || 0;
    if (until > Date.now()) isolateCooldownUntil = until;
    return until;
  } catch {
    return 0;
  }
}

function startCooldown(runtime: Ll2Runtime, retryAfterSeconds: number | null): number {
  const seconds = Math.min(
    COOLDOWN_MAX_SECONDS,
    Math.max(COOLDOWN_MIN_SECONDS, retryAfterSeconds ?? COOLDOWN_DEFAULT_SECONDS)
  );
  const until = Date.now() + seconds * 1000;
  isolateCooldownUntil = until;
  const kv = runtime.env.LAUNCHES_CACHE;
  if (kv) {
    runtime.waitUntil(
      kv.put(COOLDOWN_KV_KEY, String(until), { expirationTtl: Math.ceil(seconds) }).catch(() => {})
    );
  }
  return until;
}

// A real upstream 429 starts the cooldown. The returned error carries the
// cooldown length so the 503 can send Retry-After.
function noteRejection(runtime: Ll2Runtime, err: unknown): unknown {
  if (
    err instanceof UpstreamError &&
    !(err instanceof VisitorBudgetError) &&
    err.status === 429 &&
    isolateCooldownUntil <= Date.now()
  ) {
    const until = startCooldown(runtime, err.retryAfterSeconds);
    console.error(`LL2 rate limited; cooldown until ${new Date(until).toISOString()}`);
    return new UpstreamError(429, (until - Date.now()) / 1000);
  }
  return err;
}

// Cap visitor-triggered calls so crawlers can't starve the scheduled feed
// refresh (workers/ll2-refresh). The KV counter is approximate, which is fine.
const VISITOR_CALLS_PER_HOUR = 8;
const VISITOR_BUDGET_KEY_PREFIX = 'll2:visitor-calls:';

async function spendVisitorBudget(runtime: Ll2Runtime): Promise<void> {
  const kv = runtime.env.LAUNCHES_CACHE;
  if (!kv) return;
  const hour = Math.floor(Date.now() / 3_600_000);
  const key = `${VISITOR_BUDGET_KEY_PREFIX}${hour}`;
  let used = 0;
  try {
    used = Number(await kv.get(key)) || 0;
  } catch {
    // Unreadable counter: let the call through rather than lock visitors out
  }
  if (used >= VISITOR_CALLS_PER_HOUR) {
    throw new VisitorBudgetError((hour + 1) * 3600 - Date.now() / 1000);
  }
  runtime.waitUntil(kv.put(key, String(used + 1), { expirationTtl: 2 * 3600 }).catch(() => {}));
}

// Cached "not found" result, so made-up slugs don't burn upstream budget.
const NOT_FOUND_MARKER = '\0not-found';

export type CacheStatus = 'HIT' | 'KV-HIT' | 'MISS' | 'STALE' | 'KV-STALE' | 'FALLBACK';

/** Thrown by a transform to mean "upstream answered, but there is no such thing". */
export class NotFoundError extends Error {
  constructor(message = 'Not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export interface Ll2CacheOptions {
  /** Absolute upstream URL. Doubles as the L1 cache key, so it must be stable. */
  upstreamUrl: string;
  /** KV key. Build it from validated input only. */
  kvKey: string;
  /** How long a copy is fresh. Can depend on the body (finished launches never change). */
  freshSeconds: number | ((body: string) => number);
  /** How long a copy is kept for stale-on-error. */
  keepSeconds?: number;
  /** max-age sent to the browser. */
  browserMaxAge?: number;
  /** Reshape the body before caching. Throw NotFoundError to cache a miss. */
  transform?: (rawBody: string) => string;
  /** TTL for cached misses. Short, since new launches get announced. */
  notFoundSeconds?: number;
  /**
   * Last resort when every tier and upstream fail. Must not call upstream for
   * this resource. The result isn't cached, so the real answer can still land.
   */
  fallback?: (context: Ll2Context) => Promise<string | null>;
  /**
   * For resources the cron keeps current. Visitors serve the KV copy even when
   * stale, and only fetch upstream once it's older than this (cron is down).
   */
  scheduledRefresh?: { visitorFetchAfterSeconds: number };
}

interface Cached {
  body: string;
  fetchedAt: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchUpstream(url: string, headers: Record<string, string>): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt < UPSTREAM_ATTEMPTS; attempt++) {
    if (attempt > 0) await sleep(RETRY_BASE_MS * 2 ** (attempt - 1));
    try {
      const upstream = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      if (upstream.ok) return await upstream.text();
      lastError = new UpstreamError(
        upstream.status,
        parseRetryAfter(upstream.headers.get('retry-after'))
      );
      if (!isRetryableStatus(upstream.status)) break;
    } catch (err) {
      // Network error or timeout: retry
      lastError = err;
    }
  }
  // Logged for debugging; the client only sees a generic error
  console.error(`fetchUpstream failed for ${url}:`, lastError);
  throw lastError;
}

// ── L2: global Workers KV (best-effort, null on any miss) ────────────────────
async function kvRead(kv: KVNamespace | undefined, key: string): Promise<Cached | null> {
  if (!kv) return null;
  try {
    const { value, metadata } = await kv.getWithMetadata<{ fetchedAt?: number }>(key);
    if (value == null) return null;
    return { body: value, fetchedAt: Number(metadata?.fetchedAt) || 0 };
  } catch {
    return null;
  }
}

function kvWrite(
  runtime: Ll2Runtime,
  key: string,
  body: string,
  ttlSeconds: number,
  fetchedAt: number
): void {
  const kv = runtime.env.LAUNCHES_CACHE;
  if (!kv) return;
  // KV rejects TTLs under 60s
  runtime.waitUntil(
    kv.put(key, body, {
      metadata: { fetchedAt },
      expirationTtl: Math.max(60, ttlSeconds),
    })
  );
}

// Fetch, transform, and write to KV. Shared by visitors and the cron so both
// store the same shape.
async function fetchAndStore(
  runtime: Ll2Runtime,
  options: Ll2CacheOptions
): Promise<{ body: string; fetchedAt: number; ttl: number }> {
  const {
    upstreamUrl,
    kvKey,
    keepSeconds = DEFAULT_KEEP_SECONDS,
    transform,
    notFoundSeconds = 120,
  } = options;

  const headers: Record<string, string> = { accept: 'application/json' };
  if (runtime.env.LL2_TOKEN) headers.authorization = `Token ${runtime.env.LL2_TOKEN}`;

  const raw = await fetchUpstream(upstreamUrl, headers);
  const fetchedAt = Date.now();

  let body: string;
  let ttl = keepSeconds;
  try {
    body = transform ? transform(raw) : raw;
  } catch (err) {
    if (!(err instanceof NotFoundError)) throw err;
    body = NOT_FOUND_MARKER;
    ttl = notFoundSeconds;
  }

  kvWrite(runtime, kvKey, body, ttl, fetchedAt);
  return { body, fetchedAt, ttl };
}

// max-age only controls retention; x-fetched-at decides freshness.
function storeResponse(body: string, fetchedAt: number, keepSeconds: number): Response {
  return new Response(body, {
    headers: {
      'content-type': 'application/json',
      'cache-control': `public, max-age=${keepSeconds}`,
      'x-fetched-at': String(fetchedAt),
    },
  });
}

function isFresh(cached: Cached, freshSeconds: Ll2CacheOptions['freshSeconds']): boolean {
  const limit = typeof freshSeconds === 'function' ? freshSeconds(cached.body) : freshSeconds;
  return isYoungerThan(cached, limit);
}

function isYoungerThan(cached: Cached, seconds: number): boolean {
  return (Date.now() - cached.fetchedAt) / 1000 < seconds;
}

// For cron-refreshed resources, keep L1 short so PoPs pick up new data quickly.
const SCHEDULED_L1_SECONDS = 120;

/** The bindings the cache needs: shared by Pages Functions and the cron Worker. */
export interface Ll2Bindings {
  LAUNCHES_CACHE?: KVNamespace;
  LL2_TOKEN?: string;
}

export interface Ll2Env extends Ll2Bindings {
  ASSETS: Fetcher;
}

export type Ll2Context = EventContext<Ll2Env, string, unknown>;

/** What fetching needs. Satisfied by a Pages context or a cron's { env, waitUntil }. */
export interface Ll2Runtime {
  env: Ll2Bindings;
  waitUntil(promise: Promise<unknown>): void;
}

/**
 * Read through L1, then KV, then upstream. Throws NotFoundError for known
 * misses, and the upstream error only when there's no stale copy anywhere.
 */
export async function resolveCached(
  context: Ll2Context,
  options: Ll2CacheOptions
): Promise<{ body: string; status: CacheStatus; fetchedAt: number | null }> {
  const {
    upstreamUrl,
    kvKey,
    freshSeconds,
    keepSeconds = DEFAULT_KEEP_SECONDS,
    fallback,
    scheduledRefresh,
  } = options;

  const cache = caches.default;
  // Fixed cache key: client query strings must not fragment the cache
  const cacheKey = new Request(upstreamUrl);
  const l1Seconds = scheduledRefresh ? SCHEDULED_L1_SECONDS : keepSeconds;
  // Cron-refreshed copies are served even when stale; the cron will replace them
  const servable = (cached: Cached) =>
    scheduledRefresh != null && isYoungerThan(cached, scheduledRefresh.visitorFetchAfterSeconds);

  const check = (body: string) => {
    if (body === NOT_FOUND_MARKER) throw new NotFoundError();
    return body;
  };

  // L1
  const l1Response = await cache.match(cacheKey);
  const l1: Cached | null = l1Response
    ? { body: await l1Response.text(), fetchedAt: Number(l1Response.headers.get('x-fetched-at')) || 0 }
    : null;
  if (l1 && isFresh(l1, freshSeconds)) {
    return { body: check(l1.body), status: 'HIT', fetchedAt: l1.fetchedAt };
  }
  if (l1 && servable(l1)) {
    return { body: check(l1.body), status: 'STALE', fetchedAt: l1.fetchedAt };
  }

  // L2: another PoP or the cron may have refreshed it. Serve it and warm L1.
  const kvCopy = await kvRead(context.env.LAUNCHES_CACHE, kvKey);
  if (kvCopy && (isFresh(kvCopy, freshSeconds) || servable(kvCopy))) {
    context.waitUntil(
      cache.put(cacheKey, storeResponse(kvCopy.body, kvCopy.fetchedAt, l1Seconds))
    );
    const status = isFresh(kvCopy, freshSeconds) ? 'KV-HIT' : 'KV-STALE';
    return { body: check(kvCopy.body), status, fetchedAt: kvCopy.fetchedAt };
  }

  try {
    const cooldownUntil = await readCooldown(context.env.LAUNCHES_CACHE);
    if (cooldownUntil > Date.now()) {
      throw new UpstreamError(429, (cooldownUntil - Date.now()) / 1000);
    }
    await spendVisitorBudget(context);

    const { body, fetchedAt, ttl } = await fetchAndStore(context, options);
    context.waitUntil(
      cache.put(cacheKey, storeResponse(body, fetchedAt, Math.min(ttl, l1Seconds)))
    );
    return { body: check(body), status: 'MISS', fetchedAt };
  } catch (caught) {
    if (caught instanceof NotFoundError) throw caught;
    const err = noteRejection(context, caught);
    // Stale-on-error: L1, then KV, then the fallback
    if (l1) return { body: check(l1.body), status: 'STALE', fetchedAt: l1.fetchedAt };
    if (kvCopy) return { body: check(kvCopy.body), status: 'KV-STALE', fetchedAt: kvCopy.fetchedAt };
    if (fallback) {
      const body = await fallback(context);
      if (body) return { body, status: 'FALLBACK', fetchedAt: null };
    }
    throw err;
  }
}

/** Cached JSON for internal callers (metadata, sitemap). Null on any failure. */
export async function readCached<T>(
  context: Ll2Context,
  options: Ll2CacheOptions
): Promise<T | null> {
  try {
    const { body } = await resolveCached(context, options);
    return JSON.parse(body) as T;
  } catch {
    return null;
  }
}

/** resolveCached wrapped as a public API response. x-proxy-cache shows which tier answered. */
export async function serveCached(
  context: Ll2Context,
  options: Ll2CacheOptions
): Promise<Response> {
  try {
    const { body, status, fetchedAt } = await resolveCached(context, options);
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'cache-control': `public, max-age=${options.browserMaxAge ?? DEFAULT_BROWSER_MAX_AGE}`,
      'x-proxy-cache': status,
    };
    // Lets the app show stale data as stale
    if (fetchedAt) headers['x-fetched-at'] = String(fetchedAt);
    return new Response(body, { headers });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return Response.json(
        { error: 'Not found' },
        { status: 404, headers: { 'cache-control': 'public, max-age=60' } }
      );
    }
    // 503 + Retry-After: upstream is usually just rate limiting us
    const headers: Record<string, string> = { 'cache-control': 'no-store' };
    if (err instanceof UpstreamError && err.retryAfterSeconds != null) {
      headers['retry-after'] = String(Math.ceil(err.retryAfterSeconds));
    }
    return Response.json(
      { error: 'Launch data is temporarily unavailable' },
      { status: 503, headers }
    );
  }
}

// ── Scheduled refresh ────────────────────────────────────────────────────────
// workers/ll2-refresh calls refreshToKv on a cron. The result is saved under
// STATUS_KV_KEY and shown at /api/status.

const STATUS_KV_KEY = 'll2:status';

export interface RefreshStatus {
  lastAttemptAt: number;
  lastSuccessAt: number | null;
  /** 'ok', 'skipped', or the upstream status / error name that failed it. */
  lastResult: string;
  lastError: string | null;
  /** Upstream's Retry-After from the last refusal; the cron waits it out. */
  retryAt: number | null;
}

export async function readRefreshStatus(kv: KVNamespace | undefined): Promise<RefreshStatus | null> {
  if (!kv) return null;
  try {
    return await kv.get<RefreshStatus>(STATUS_KV_KEY, 'json');
  } catch {
    return null;
  }
}

/**
 * Refresh one resource into KV from the cron.
 *
 * Ignores the shared cooldown on purpose: visitor 429s could otherwise keep
 * it alive forever and freeze the feed. Only skips for its own Retry-After or
 * when the stored copy is still fresh.
 */
export async function refreshToKv(
  runtime: Ll2Runtime,
  options: Ll2CacheOptions,
  { skipIfYoungerThanSeconds = 0 }: { skipIfYoungerThanSeconds?: number } = {}
): Promise<RefreshStatus> {
  const kv = runtime.env.LAUNCHES_CACHE;
  const previous = await readRefreshStatus(kv);
  const now = Date.now();
  const status: RefreshStatus = {
    lastAttemptAt: now,
    lastSuccessAt: previous?.lastSuccessAt ?? null,
    lastResult: 'skipped',
    lastError: null,
    retryAt: previous?.retryAt ?? null,
  };

  const existing = await kvRead(kv, options.kvKey);
  if (status.retryAt && status.retryAt > now) {
    status.lastError = `waiting out Retry-After until ${new Date(status.retryAt).toISOString()}`;
  } else if (existing && isYoungerThan(existing, skipIfYoungerThanSeconds)) {
    status.lastError = 'stored copy is still fresh';
  } else {
    try {
      const { fetchedAt } = await fetchAndStore(runtime, options);
      status.lastResult = 'ok';
      status.lastSuccessAt = fetchedAt;
      status.retryAt = null;
    } catch (err) {
      const upstreamStatus = err instanceof UpstreamError ? err.status : null;
      status.lastResult = upstreamStatus ? String(upstreamStatus) : (err as Error)?.name || 'error';
      status.lastError = (err as Error)?.message ?? String(err);
      if (err instanceof UpstreamError && err.status === 429) {
        // Pause visitor calls too
        const until = startCooldown(runtime, err.retryAfterSeconds);
        status.retryAt = err.retryAfterSeconds != null ? until : null;
      }
    }
  }

  // Awaited so the next run sees it
  if (kv) await kv.put(STATUS_KV_KEY, JSON.stringify(status)).catch(() => {});
  return status;
}

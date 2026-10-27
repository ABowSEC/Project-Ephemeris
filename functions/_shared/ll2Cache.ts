// Shared edge cache for the Space Devs (Launch Library 2) API.
//
// The free tier allows 15 requests/hour per IP, counted against whoever makes
// the call. Browsers hitting the API directly means every visitor spends that
// budget; routing through these functions means Cloudflare makes roughly one
// upstream call per freshSeconds, however many visitors there are, and the
// browser never talks to Space Devs.
//
// Two cache tiers back this up:
//   L1  caches.default  — per-PoP, fast, no cross-region latency
//   L2  LAUNCHES_CACHE  — a global Workers KV namespace
// L1 alone had a blind spot: its cache lives in one edge location, so a cold
// PoP (say Paris on a visitor's first hit) has no stale copy, and one
// transient upstream blip there becomes a hard 502 for that whole region
// while a warm PoP elsewhere serves fine. KV is global, so once any edge
// fetches successfully every edge — cold ones included — can fall back to
// that copy. L1 stays in front purely for latency.
//
// If a paid Space Devs key is added later, set it as the LL2_TOKEN secret in
// the Pages project settings; it is attached here, server-side only, and never
// reaches the browser.
//
// The KV namespace is bound as LAUNCHES_CACHE in the Pages project's Functions
// settings. The code treats it as optional: with no binding it degrades to
// L1 + upstream, so the site keeps working before it is wired.
//
// This module was extracted from functions/api/launches.js so the launch
// detail, HTML metadata, and sitemap endpoints share one implementation
// instead of each growing its own half of it.

export const LL2_BASE = 'https://ll.thespacedevs.com/2.3.0';

// How long a copy survives as stale-on-error stock, not how long it is fresh
// (freshSeconds decides that). This used to be 24 hours, which meant a rate
// limit that outlasted a day left both tiers empty and the site serving 502s
// for data it had fetched successfully the day before. A month-old schedule
// with an honest "last updated" notice beats an error page.
const DEFAULT_KEEP_SECONDS = 30 * 24 * 60 * 60;
const DEFAULT_BROWSER_MAX_AGE = 60;

// A cold edge with no stale fallback turns a single transient upstream blip
// — a 429 from the 15/hour free tier, a timeout — into a hard failure.
// Retrying a couple of times with a short backoff absorbs those blips before
// we give up, which is what a warm cache would have masked anyway.
const UPSTREAM_ATTEMPTS = 3;
const RETRY_BASE_MS = 400;
const UPSTREAM_TIMEOUT_MS = 8000;

// ...but only for failures a retry can actually fix. Upstream rejecting the
// request — 429 above all, which is what the 15/hour cap returns — will reject
// it again a few hundred milliseconds later, and each attempt spends allowance
// we cannot spare. Retrying those turned one unaffordable request into three.
function isRetryableStatus(status: number): boolean {
  return status >= 500 || status === 408;
}

// Once upstream has said 429, every request until the limit resets is another
// refusal that also counts against the limit. The cooldown is shared by every
// endpoint and every PoP, because they all draw on one upstream budget: the
// isolate-level copy saves a KV read on a busy edge, and the KV copy tells the
// rest of the world. Retry-After is honored when sent, within sane bounds.
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

/**
 * Our own cap on visitor-triggered calls was reached. Behaves like a 429 to
 * callers (stale copy, else 503 with Retry-After), but upstream never refused
 * anything, so it must not start the shared cooldown.
 */
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

// A fresh 429 (not one we synthesized from an active cooldown, which carries
// the time remaining) starts the shared cooldown. Returns the error to
// propagate, re-labeled with the cooldown's length so a 503 says when to come
// back even when upstream didn't.
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

// Visitor-triggered upstream calls are capped per hour. Without a cap, a
// crawler walking uncached /launches/<slug> pages spent the whole 15/hour
// budget, and every further call only drew another 429 and prolonged it.
// The counter is approximate — KV is eventually consistent and the
// read-increment races — which is fine for a budget with this much headroom.
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

// Marks a negative cache entry. Stored as a real cache entry so a crawler
// walking made-up slugs is absorbed by the edge instead of draining the
// 15/hour upstream budget.
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
  /** KV key. Must be derived from validated input — it is attacker-reachable. */
  kvKey: string;
  /**
   * How long a stored copy counts as fresh. A function receives the stored
   * body, which lets callers vary the TTL by content — a completed launch
   * never changes again, an upcoming one changes hourly.
   */
  freshSeconds: number | ((body: string) => number);
  /** How long a copy is retained as stale-on-error stock. */
  keepSeconds?: number;
  /** max-age sent to the browser. The app keeps its own localStorage TTL. */
  browserMaxAge?: number;
  /**
   * Reshape the upstream body before storing, so every reader (and the cache
   * itself) sees the final form. Throw NotFoundError to store a negative entry.
   */
  transform?: (rawBody: string) => string;
  /** TTL for negative entries. Short: slugs appear as launches are announced. */
  notFoundSeconds?: number;
  /**
   * Last resort, after every cache tier and upstream have failed and before the
   * error propagates. Resolves to a body to serve, or null if it cannot help.
   *
   * Implementations must not spend a fresh upstream call on *this* resource —
   * the point is to reuse something the site already paid for. The result is
   * deliberately not written to either cache tier: it is a lesser answer served
   * under duress, and caching it would keep the real one from ever landing.
   */
  fallback?: (context: Ll2Context) => Promise<string | null>;
  /**
   * Set when scripts/refresh-launches.ts keeps this resource current on a
   * schedule. Visitors then serve whatever KV holds, however stale past
   * freshSeconds, and only go upstream themselves when the stored copy is
   * older than this — a safety net for a refresher that has stopped landing,
   * not the normal path.
   */
  scheduledRefresh?: { visitorFetchAfterSeconds: number };
}

interface Cached {
  body: string;
  fetchedAt: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Fetch the upstream feed, retrying transient failures. Resolves with the
// response body text; throws only after every attempt is exhausted.
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
      // A rejection is an answer. Give up now rather than spend the remaining
      // attempts re-asking a question upstream has already declined.
      lastError = new UpstreamError(
        upstream.status,
        parseRetryAfter(upstream.headers.get('retry-after'))
      );
      if (!isRetryableStatus(upstream.status)) break;
    } catch (err) {
      // Network failure or timeout — no status to judge, always worth a retry.
      lastError = err;
    }
  }
  // Only surfaces in Cloudflare's Functions logs, never to the client: this is
  // the one place that knows *why* upstream was unusable, and without it a 502
  // here is indistinguishable from a KV misconfiguration or a code bug.
  console.error(`fetchUpstream failed for ${url}:`, lastError);
  throw lastError;
}

// ── L2: global Workers KV ────────────────────────────────────────────────────
// A miss (no binding, or empty namespace) resolves to null so callers can
// treat the global tier as best-effort, exactly like the per-PoP one.
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
  // expirationTtl mirrors L1's KEEP window: stale-on-error stock, then evict.
  // KV rejects TTLs under 60s, so floor it rather than lose the write.
  runtime.waitUntil(
    kv.put(key, body, {
      metadata: { fetchedAt },
      expirationTtl: Math.max(60, ttlSeconds),
    })
  );
}

// Fetch upstream, apply the transform, and write the result to KV, in the
// shape scripts/refresh-launches.ts also writes: body as the value, fetchedAt
// in metadata.
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
    // Store the negative result so repeat lookups of a bad slug never reach
    // upstream again for a while.
    body = NOT_FOUND_MARKER;
    ttl = notFoundSeconds;
  }

  kvWrite(runtime, kvKey, body, ttl, fetchedAt);
  return { body, fetchedAt, ttl };
}

// Build the cacheable Response. Long max-age keeps the entry alive in the edge
// cache as stale-on-error stock; x-fetched-at, not max-age, decides freshness.
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

// With a scheduled refresher, L1 only bridges KV reads for a busy PoP. Kept
// short so every PoP picks up the cron's write within a couple of minutes;
// KV, not L1, holds the stale-on-error stock for these resources.
const SCHEDULED_L1_SECONDS = 120;

/** The bindings fetching and storing need. */
export interface Ll2Bindings {
  LAUNCHES_CACHE?: KVNamespace;
  LL2_TOKEN?: string;
}

export interface Ll2Env extends Ll2Bindings {
  ASSETS: Fetcher;
}

export type Ll2Context = EventContext<Ll2Env, string, unknown>;

/**
 * The part of a Pages EventContext that fetching and storing need, so those
 * helpers don't depend on the request-specific parts of it.
 */
export interface Ll2Runtime {
  env: Ll2Bindings;
  waitUntil(promise: Promise<unknown>): void;
}

/**
 * Resolve a body through both cache tiers, fetching upstream when neither is
 * fresh. Returns the body text plus which tier answered.
 *
 * Throws NotFoundError when the resource is known not to exist (including from
 * a cached negative entry), and rethrows the upstream error only when there is
 * no stale copy anywhere to fall back on.
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
  // A cron-refreshed copy is served past freshSeconds without asking upstream:
  // the cron will replace it, and a visitor asking too would only compete with
  // it for the same budget.
  const servable = (cached: Cached) =>
    scheduledRefresh != null && isYoungerThan(cached, scheduledRefresh.visitorFetchAfterSeconds);

  const check = (body: string) => {
    if (body === NOT_FOUND_MARKER) throw new NotFoundError();
    return body;
  };

  // L1: fresh copy in this PoP is the fast path, no KV read needed
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

  // L2: another PoP (or the cron) may have refreshed the global copy while this
  // one went stale — serve that instead of spending an upstream call, and warm L1.
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
    // Stale-on-error: prefer this PoP's copy, then the global one, then a
    // lesser copy from elsewhere, then fail.
    if (l1) return { body: check(l1.body), status: 'STALE', fetchedAt: l1.fetchedAt };
    if (kvCopy) return { body: check(kvCopy.body), status: 'KV-STALE', fetchedAt: kvCopy.fetchedAt };
    if (fallback) {
      const body = await fallback(context);
      if (body) return { body, status: 'FALLBACK', fetchedAt: null };
    }
    throw err;
  }
}

/**
 * Cache-backed JSON read for other functions in this worker (the HTML metadata
 * rewriter, the sitemap). Goes through the same tiers as the public endpoints
 * without the cost of an HTTP subrequest to ourselves.
 *
 * Returns null on any failure: callers are decorating a page, not serving the
 * data, and a metadata miss must never take the page down with it.
 */
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

/**
 * The public-endpoint form: resolve and wrap in a browser-appropriate Response
 * — short browser cache (the app keeps its own localStorage TTL) and an
 * x-proxy-cache marker for `curl -i` checks.
 */
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
    // When upstream last answered, so a stale copy served under duress is
    // labeled stale in the browser rather than stamped with the time it arrived.
    if (fetchedAt) headers['x-fetched-at'] = String(fetchedAt);
    return new Response(body, { headers });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return Response.json(
        { error: 'Not found' },
        { status: 404, headers: { 'cache-control': 'public, max-age=60' } }
      );
    }
    // 503, not 502: "try later" is the truth when upstream is rate limiting,
    // and Retry-After tells the client when later is.
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
//
// scripts/refresh-launches.ts, run every 15 minutes by a GitHub Actions
// workflow, writes the feed so it no longer waits for a visitor to find it
// stale. It runs outside Cloudflare on purpose: Workers call out from IPs
// shared with every other Worker using the API, and a cron Worker doing this
// job drew a 429 on every run. Its outcome is recorded under STATUS_KV_KEY,
// which /api/status serves: the one place that says whether refreshes are
// landing, without digging through Cloudflare's real-time logs.

const STATUS_KV_KEY = 'll2:status';

export interface RefreshStatus {
  lastAttemptAt: number;
  lastSuccessAt: number | null;
  /** 'ok', 'skipped', or the upstream status / error name that failed it. */
  lastResult: string;
  lastError: string | null;
  /** When the last refusal's Retry-After ends; informational only. */
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

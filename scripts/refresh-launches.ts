// Refresh the upcoming-launches feed in Workers KV, from outside Cloudflare.
//
// Run on a schedule by .github/workflows/refresh-launches.yml. The Space Devs
// free tier limits calls per IP, and Cloudflare Workers call out from IPs
// shared with every other Worker that uses the API: a cron Worker doing this
// job drew a 429 on every run, with no visitor traffic competing for it.
// GitHub's runners call from elsewhere, so this does the fetch and writes the
// result through Cloudflare's REST API, under the same key and in the same
// shape that functions/_shared/ll2Cache.ts reads.
//
// Env: CLOUDFLARE_API_TOKEN (Workers KV Storage: Edit), CLOUDFLARE_ACCOUNT_ID,
// KV_NAMESPACE_ID (the namespace bound as LAUNCHES_CACHE in the Pages project).
//
// Every run attempts the fetch, even after a 429 with a Retry-After. The free
// tier limits per IP, and each run gets a fresh runner VM, usually on a
// different IP, so one run's refusal says little about the next one's chances.
// Exits non-zero on failure so the workflow run shows red.

const FEED_URL = 'https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=50';
// Must match upcomingFeedOptions.kvKey and the status key in ll2Cache.ts
const FEED_KEY = 'upcoming';
const STATUS_KEY = 'll2:status';
// Same stale-on-error window as DEFAULT_KEEP_SECONDS in ll2Cache.ts
const KEEP_SECONDS = 30 * 24 * 60 * 60;
const TIMEOUT_MS = 20_000;

interface RefreshStatus {
  lastAttemptAt: number;
  lastSuccessAt: number | null;
  lastResult: string;
  lastError: string | null;
  retryAt: number | null;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
}

const token = requireEnv('CLOUDFLARE_API_TOKEN');
const kvBase =
  `https://api.cloudflare.com/client/v4/accounts/${requireEnv('CLOUDFLARE_ACCOUNT_ID')}` +
  `/storage/kv/namespaces/${requireEnv('KV_NAMESPACE_ID')}/values/`;
const auth = { authorization: `Bearer ${token}` };

async function kvGetJson<T>(key: string): Promise<T | null> {
  const res = await fetch(kvBase + encodeURIComponent(key), { headers: auth });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`KV read ${key}: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

async function kvPut(
  key: string,
  value: string,
  { metadata, ttlSeconds }: { metadata?: unknown; ttlSeconds?: number } = {}
): Promise<void> {
  const url = new URL(kvBase + encodeURIComponent(key));
  if (ttlSeconds) url.searchParams.set('expiration_ttl', String(ttlSeconds));
  // Multipart is the only form of this endpoint that accepts metadata, and
  // the Functions read fetchedAt from metadata, so it is required here.
  const form = new FormData();
  form.set('value', value);
  if (metadata !== undefined) form.set('metadata', JSON.stringify(metadata));
  const res = await fetch(url, { method: 'PUT', headers: auth, body: form });
  if (!res.ok) throw new Error(`KV write ${key}: ${res.status} ${await res.text()}`);
}

/** Retry-After is either delta-seconds or an HTTP date. */
function retryAfterMs(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds) * 1000;
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}

const previous = await kvGetJson<RefreshStatus>(STATUS_KEY);
const status: RefreshStatus = {
  lastAttemptAt: Date.now(),
  lastSuccessAt: previous?.lastSuccessAt ?? null,
  lastResult: 'ok',
  lastError: null,
  // Informational only (see the header): shown by /api/status, never waited on
  retryAt: null,
};
let failed = false;

try {
  const res = await fetch(FEED_URL, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    const wait = retryAfterMs(res.headers.get('retry-after'));
    status.retryAt = wait != null ? Date.now() + wait : null;
    throw new Error(`upstream status ${res.status}`);
  }
  const body = await res.text();
  // A 200 that isn't the feed must not replace the last good copy
  if (!Array.isArray((JSON.parse(body) as { results?: unknown }).results)) {
    throw new Error('Upcoming feed has no results array');
  }
  const fetchedAt = Date.now();
  await kvPut(FEED_KEY, body, { metadata: { fetchedAt }, ttlSeconds: KEEP_SECONDS });
  status.lastSuccessAt = fetchedAt;
} catch (err) {
  failed = true;
  const message = (err as Error)?.message ?? String(err);
  status.lastResult = message.match(/upstream status (\d+)/)?.[1] ?? (err as Error)?.name ?? 'error';
  status.lastError = message;
}

await kvPut(STATUS_KEY, JSON.stringify(status));
console.log(`refresh-launches: ${status.lastResult}${status.lastError ? ` (${status.lastError})` : ''}`);
if (failed) process.exitCode = 1;

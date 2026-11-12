// Pages Function: health of the scheduled launch-data refresh.
//
// `curl https://ephemeris-online.com/api/status` answers "is the schedule
// updating?" in one request: when each scheduler (the GitHub Actions workflow
// and the cron Worker) last tried, when it last succeeded, what failed it, and
// how old the copy visitors are being served is.

import { CRON_STATUS_KV_KEY, readCooldown, readRefreshStatus, type RefreshStatus, type Ll2Context } from '../_shared/ll2Cache';
import { upcomingFeedOptions } from '../_shared/launchLookup';

export async function onRequestGet(context: Ll2Context): Promise<Response> {
  const kv = context.env.LAUNCHES_CACHE;
  const [refresh, cron] = await Promise.all([readRefreshStatus(kv), readRefreshStatus(kv, CRON_STATUS_KV_KEY)]);

  let feedFetchedAt: number | null = null;
  if (kv) {
    try {
      // getWithMetadata reads the body too; the feed is small enough that a
      // health check paying for it is fine.
      const { metadata } = await kv.getWithMetadata<{ fetchedAt?: number }>(upcomingFeedOptions.kvKey);
      feedFetchedAt = Number(metadata?.fetchedAt) || null;
    } catch {
      // Report what we have; a health check must not fail on its own reads
    }
  }
  const cooldownUntil = (await readCooldown(kv)) || null;

  const iso = (ms: number | null | undefined) => (ms ? new Date(ms).toISOString() : null);
  const describe = (status: RefreshStatus | null) =>
    status && {
      ...status,
      lastAttemptAt: iso(status.lastAttemptAt),
      lastSuccessAt: iso(status.lastSuccessAt),
      retryAt: iso(status.retryAt),
    };

  return Response.json(
    {
      kvBound: Boolean(kv),
      feed: {
        fetchedAt: iso(feedFetchedAt),
        ageMinutes: feedFetchedAt ? Math.round((Date.now() - feedFetchedAt) / 60000) : null,
      },
      cooldownUntil: cooldownUntil && cooldownUntil > Date.now() ? iso(cooldownUntil) : null,
      // GitHub Actions workflow (scripts/refresh-launches.ts)
      scheduledRefresh: describe(refresh),
      // Cron Worker (workers/ll2-refresh)
      cronRefresh: describe(cron),
    },
    { headers: { 'cache-control': 'no-store' } }
  );
}

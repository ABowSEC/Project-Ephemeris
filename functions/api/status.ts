// Pages Function: health of the scheduled launch-data refresh.
//
// `curl https://ephemeris-online.com/api/status` answers "is the schedule
// updating?" in one request: when the cron last tried, when it last succeeded,
// what failed it, and how old the copy visitors are being served is.

import { readCooldown, readRefreshStatus, type Ll2Context } from '../_shared/ll2Cache';
import { upcomingFeedOptions } from '../_shared/launchLookup';

export async function onRequestGet(context: Ll2Context): Promise<Response> {
  const kv = context.env.LAUNCHES_CACHE;
  const refresh = await readRefreshStatus(kv);

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

  return Response.json(
    {
      kvBound: Boolean(kv),
      feed: {
        fetchedAt: iso(feedFetchedAt),
        ageMinutes: feedFetchedAt ? Math.round((Date.now() - feedFetchedAt) / 60000) : null,
      },
      cooldownUntil: cooldownUntil && cooldownUntil > Date.now() ? iso(cooldownUntil) : null,
      scheduledRefresh: refresh && {
        ...refresh,
        lastAttemptAt: iso(refresh.lastAttemptAt),
        lastSuccessAt: iso(refresh.lastSuccessAt),
        retryAt: iso(refresh.retryAt),
      },
    },
    { headers: { 'cache-control': 'no-store' } }
  );
}

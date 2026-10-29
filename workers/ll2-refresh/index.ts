// Scheduled Worker: keeps the upcoming-launches feed in KV current.
//
// Before this, the feed refreshed only when a visitor's request found it stale,
// and that request competed with every detail lookup, metadata rewrite, and
// crawler for the free tier's 15 calls an hour. Under a sustained 429 the
// cooldown kept restarting and the feed never won a call: the site served a
// days-old schedule while reporting STALE on every request.
//
// Now this cron owns the feed. It writes the same KV key, in the same shape,
// that the Pages Functions read (functions/_shared/ll2Cache.ts), so visitors
// are served from KV and never spend upstream calls on the feed. It must be
// bound to the same LAUNCHES_CACHE namespace as the Pages project — see
// wrangler.toml.

import { refreshToKv, type Ll2Bindings } from '../../functions/_shared/ll2Cache';
import { upcomingFeedOptions } from '../../functions/_shared/launchLookup';

// Runs every 15 minutes (wrangler.toml). A copy younger than this was written
// moments ago — by the visitor safety net or an overlapping run — and
// refetching it would spend a call for nothing.
const SKIP_IF_YOUNGER_THAN_SECONDS = 5 * 60;

export default {
  async scheduled(_controller: ScheduledController, env: Ll2Bindings, ctx: ExecutionContext): Promise<void> {
    const status = await refreshToKv(
      { env, waitUntil: (promise) => ctx.waitUntil(promise) },
      upcomingFeedOptions,
      { skipIfYoungerThanSeconds: SKIP_IF_YOUNGER_THAN_SECONDS }
    );
    // One line per run in the Worker's logs, readable at a glance
    const line = `ll2-refresh: ${status.lastResult}${status.lastError ? ` (${status.lastError})` : ''}`;
    if (status.lastResult === 'ok' || status.lastResult === 'skipped') console.log(line);
    else console.error(line);
  },
} satisfies ExportedHandler<Ll2Bindings>;

// Cron Worker that keeps the upcoming-launches feed in KV current, so
// visitors never spend API calls on it. Writes the same key and shape the
// Pages Functions read (functions/_shared/ll2Cache.ts). Must be bound to the
// same LAUNCHES_CACHE namespace as the Pages project (see wrangler.toml).

import { refreshToKv, type Ll2Bindings } from '../../functions/_shared/ll2Cache';
import { upcomingFeedOptions } from '../../functions/_shared/launchLookup';

// Skip if a copy was written in the last few minutes (overlapping run or a
// visitor fetch).
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

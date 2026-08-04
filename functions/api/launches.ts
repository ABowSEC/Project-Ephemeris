// Pages Function: edge proxy for the Space Devs upcoming-launches feed.
//
// All of the caching machinery — two tiers, retry with backoff, stale-on-error
// — lives in _shared/ll2Cache.ts, which was extracted from this file when the
// launch-detail endpoint needed the same behavior. Behavior, headers, TTL, KV
// key, and the x-proxy-cache markers are unchanged from that version.

import { serveCached, type Ll2Context } from '../_shared/ll2Cache';
import { upcomingFeedOptions } from '../_shared/launchLookup';

export async function onRequestGet(context: Ll2Context): Promise<Response> {
  return serveCached(context, upcomingFeedOptions);
}

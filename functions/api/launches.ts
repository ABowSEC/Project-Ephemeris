// GET /api/launches: edge proxy for the upcoming-launches feed. Caching
// lives in _shared/ll2Cache.ts.

import { serveCached, type Ll2Context } from '../_shared/ll2Cache';
import { upcomingFeedOptions } from '../_shared/launchLookup';

export async function onRequestGet(context: Ll2Context): Promise<Response> {
  return serveCached(context, upcomingFeedOptions);
}

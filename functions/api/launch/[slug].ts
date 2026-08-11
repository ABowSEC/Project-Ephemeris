// Pages Function: one launch by its Launch Library slug.
//
// GET /api/launch/falcon-9-block-5-starlink-group-17-53
//
// Returns the launch object itself (not the paginated envelope upstream sends)
// from mode=detailed, which is the only mode carrying the updates timeline,
// webcast list, hold/fail reasons, and launch-attempt statistics the detail
// page renders.

import { serveCached, type Ll2Context } from '../../_shared/ll2Cache';
import { isValidSlug, launchBySlugOptions } from '../../_shared/launchLookup';

export async function onRequestGet(context: Ll2Context): Promise<Response> {
  const slug = String(context.params.slug ?? '');

  // Reject before any I/O: the slug reaches both an upstream query string and
  // a KV key, and a malformed one must cost us nothing.
  if (!isValidSlug(slug)) {
    return Response.json(
      { error: 'Invalid launch slug' },
      { status: 400, headers: { 'cache-control': 'public, max-age=3600' } }
    );
  }

  return serveCached(context, launchBySlugOptions(slug));
}

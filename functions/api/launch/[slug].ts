// GET /api/launch/<slug>: one launch from mode=detailed (the only mode with
// updates, webcasts, and launch stats). Returns the bare launch object.

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

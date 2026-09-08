import { useEffect } from 'react';
import { useApi } from './useApi';
import { getUpcomingLaunches, getUpcomingLaunchesFetchedAt, FRESH_MS } from '../services/launchStore';

// Well beyond the normal refresh cadence (5-15 min, see FRESH_MS), so a
// routine refetch delay never trips this — only a sustained run of failures
// (upstream rate-limited with no stale-on-error copy available, etc.) does.
// Past this age, showing the data as if it's current would be misleading.
const STALE_WARNING_MS = 45 * 60 * 1000;

/**
 * React hook over the shared launch store: returns the upcoming launches
 * and quietly re-checks on an interval aligned with the store's TTL, so
 * however many components mount this, the app still makes at most one
 * network request per freshness window.
 *
 * @returns {{ launches: Array, loading: boolean, error: string|null, refetch: Function, stale: boolean, fetchedAt: number|null }}
 */
export function useUpcomingLaunches() {
  // The store manages its own request lifecycle, so the abort signal from
  // useApi is unused; useApi still guards against state updates after unmount.
  const { data, loading, error, refetch } = useApi(() => getUpcomingLaunches());

  useEffect(() => {
    const id = setInterval(() => refetch({ background: true }), FRESH_MS);
    return () => clearInterval(id);
  }, [refetch]);

  // Read fresh on every render rather than stashing in state: consumers of
  // this hook already re-render on a steady cadence (ticking countdowns), so
  // this stays accurate without its own timer, and it's just a localStorage
  // read — cheap enough to not bother memoizing.
  const fetchedAt = getUpcomingLaunchesFetchedAt();
  const stale = fetchedAt != null && Date.now() - fetchedAt > STALE_WARNING_MS;

  return { launches: data?.results ?? [], loading, error, refetch, stale, fetchedAt };
}

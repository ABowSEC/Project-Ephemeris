import { useCallback, useEffect } from 'react';
import { useApi, type RefetchOptions } from './useApi';
// launchStore is JS; its payload is cast to the typed response shape here
import { getUpcomingLaunches, getUpcomingLaunchesFetchedAt, FRESH_MS } from '../services/launchStore';
import { hasFlown } from '../data/launchStatus';
import type { LaunchListItem, UpcomingLaunchesResponse } from '../types/launchLibrary';

// Well beyond the normal refresh cadence (5-15 min, see FRESH_MS), so a
// routine refetch delay never trips this — only a sustained run of failures
// (upstream rate-limited with no stale-on-error copy available, etc.) does.
// Past this age, showing the data as if it's current would be misleading.
const STALE_WARNING_MS = 45 * 60 * 1000;

export interface UpcomingLaunchesResult {
  launches: LaunchListItem[];
  nextLaunch: LaunchListItem | null;
  loading: boolean;
  error: string | null;
  refetch: (options?: RefetchOptions) => Promise<void>;
  refresh: () => Promise<void>;
  stale: boolean;
  fetchedAt: number | null;
}

/**
 * React hook over the shared launch store: returns the upcoming launches
 * and quietly re-checks on an interval aligned with the store's TTL, so
 * however many components mount this, the app still makes at most one
 * network request per freshness window.
 */
export function useUpcomingLaunches(): UpcomingLaunchesResult {
  // The store manages its own request lifecycle, so the abort signal from
  // useApi is unused; useApi still guards against state updates after unmount.
  const { data, loading, error, refetch } = useApi<UpcomingLaunchesResponse>(
    (_signal, { force } = {}) => getUpcomingLaunches({ force: Boolean(force) })
  );

  const launches = data?.results ?? [];

  // The feed is sorted by T-0 ascending, but its first entry isn't
  // necessarily what should be highlighted as "next": once a launch's
  // status has resolved to a terminal one (Success/Failure/Partial
  // Failure), it has already flown, and the upstream feed can lag behind
  // that for a stretch before dropping the entry. Skip past any already-
  // flown entries so the header/hero always lands on the nearest one still
  // ahead of us.
  const nextLaunch = launches.find((launch) => !hasFlown(launch.status)) ?? null;

  useEffect(() => {
    const id = setInterval(() => refetch({ background: true }), FRESH_MS);
    return () => clearInterval(id);
  }, [refetch]);

  // Read fresh on every render rather than stashing in state: consumers of
  // this hook already re-render on a steady cadence (ticking countdowns), so
  // this stays accurate without its own timer, and it's just a localStorage
  // read — cheap enough to not bother memoizing.
  const fetchedAt: number | null = getUpcomingLaunchesFetchedAt();
  const stale = fetchedAt != null && Date.now() - fetchedAt > STALE_WARNING_MS;

  // For the manual "refresh" action on the stale-data notice: bypasses the
  // freshness check so it actually reaches the proxy instead of replaying
  // the same stale localStorage copy the user is trying to get rid of.
  const refresh = useCallback(() => refetch({ force: true }), [refetch]);

  return { launches, nextLaunch, loading, error, refetch, refresh, stale, fetchedAt };
}

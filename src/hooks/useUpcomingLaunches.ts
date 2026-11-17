import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useApi, type RefetchOptions } from './useApi';
import {
  getUpcomingLaunches,
  getUpcomingLaunchesSnapshot,
  subscribeUpcomingLaunches,
  FRESH_MS,
} from '../services/launchStore';
import { hasFlown } from '../data/launchStatus';
import { launchDate } from '../utils/launchFields';
import type { LaunchListItem } from '../types/launchLibrary';

// Data this old means refreshes have failed for days, so warn outright.
export const STALE_WARNING_MS = 3 * 24 * 60 * 60 * 1000;

// Older than a normal refresh cycle, but nowhere near STALE_WARNING_MS: the
// point past which a launch's status in the feed can't be taken at face value.
const OLD_DATA_MS = 45 * 60 * 1000;

// In stale data, treat a launch still "Go" this long past T-0 as already
// flown or slipped. Fresh data is trusted, since holds past T-0 happen.
const PAST_T0_GRACE_MS = 2 * 60 * 60 * 1000;

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

/** Upcoming launches from the shared store, rechecked on a timer and when the tab regains focus. */
export function useUpcomingLaunches(): UpcomingLaunchesResult {
  // useApi handles loading/error; the data comes from the store snapshot.
  const { loading, error, refetch } = useApi<unknown>(
    (_signal, { force } = {}) => getUpcomingLaunches({ force: Boolean(force) })
  );
  const entry = useSyncExternalStore(subscribeUpcomingLaunches, getUpcomingLaunchesSnapshot);

  const launches = entry?.data.results ?? [];
  const fetchedAt = entry?.fetchedAt ?? null;
  const age = fetchedAt != null ? Date.now() - fetchedAt : 0;
  const stale = age > STALE_WARNING_MS;

  // Skip launches that already flew; the feed can lag before dropping them.
  const nextLaunch =
    launches.find((launch) => {
      if (hasFlown(launch.status)) return false;
      if (age <= OLD_DATA_MS) return true;
      const date = launchDate(launch);
      return !date || date.getTime() > Date.now() - PAST_T0_GRACE_MS;
    }) ?? null;

  useEffect(() => {
    const id = setInterval(() => refetch({ background: true }), FRESH_MS);
    return () => clearInterval(id);
  }, [refetch]);

  // Background tabs throttle timers, so recheck when the page becomes
  // visible. The store skips the request if its data is still fresh.
  useEffect(() => {
    const revalidate = () => {
      if (document.visibilityState === 'visible') refetch({ background: true });
    };
    document.addEventListener('visibilitychange', revalidate);
    window.addEventListener('pageshow', revalidate);
    window.addEventListener('focus', revalidate);
    window.addEventListener('online', revalidate);
    return () => {
      document.removeEventListener('visibilitychange', revalidate);
      window.removeEventListener('pageshow', revalidate);
      window.removeEventListener('focus', revalidate);
      window.removeEventListener('online', revalidate);
    };
  }, [refetch]);

  // Manual refresh: skip the freshness check.
  const refresh = useCallback(() => refetch({ force: true }), [refetch]);

  return {
    launches,
    nextLaunch,
    // Cached data paints at once; the spinner is only for having nothing
    loading: loading && !entry,
    error: entry ? null : error,
    refetch,
    refresh,
    stale,
    fetchedAt,
  };
}

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

// Well beyond the normal refresh cadence (5-15 min, see FRESH_MS), so a
// routine refetch delay never trips this — only a sustained run of failures
// (upstream rate-limited with no stale-on-error copy available, etc.) does.
// Past this age, showing the data as if it's current would be misleading.
const STALE_WARNING_MS = 45 * 60 * 1000;

// In stale data, a launch still marked Go this long after its T-0 almost
// certainly flew or slipped; the feed just hasn't said which yet. Fresh data
// is trusted as-is, since a launch can sit in a hold past T-0 for real.
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

/**
 * React hook over the shared launch store: returns the upcoming launches
 * and quietly re-checks on an interval aligned with the store's TTL, and
 * whenever the visitor comes back to the tab. However many components mount
 * this, they all show one snapshot, and the app still makes at most one
 * network request per freshness window.
 */
export function useUpcomingLaunches(): UpcomingLaunchesResult {
  // useApi drives the request lifecycle (loading, error, refetch); the data
  // itself comes from the store's snapshot, so a fetch any component makes
  // updates every component. The abort signal is unused because the store
  // manages its own request; useApi still guards state after unmount.
  const { loading, error, refetch } = useApi<unknown>(
    (_signal, { force } = {}) => getUpcomingLaunches({ force: Boolean(force) })
  );
  const entry = useSyncExternalStore(subscribeUpcomingLaunches, getUpcomingLaunchesSnapshot);

  const launches = entry?.data.results ?? [];
  const fetchedAt = entry?.fetchedAt ?? null;
  const stale = fetchedAt != null && Date.now() - fetchedAt > STALE_WARNING_MS;

  // The feed is sorted by T-0 ascending, but its first entry isn't
  // necessarily what should be highlighted as "next": once a launch's
  // status has resolved to a terminal one (Success/Failure/Partial
  // Failure), it has already flown, and the upstream feed can lag behind
  // that for a stretch before dropping the entry. Skip past any already-
  // flown entries so the header/hero always lands on the nearest one still
  // ahead of us.
  const nextLaunch =
    launches.find((launch) => {
      if (hasFlown(launch.status)) return false;
      if (!stale) return true;
      const date = launchDate(launch);
      return !date || date.getTime() > Date.now() - PAST_T0_GRACE_MS;
    }) ?? null;

  useEffect(() => {
    const id = setInterval(() => refetch({ background: true }), FRESH_MS);
    return () => clearInterval(id);
  }, [refetch]);

  // Background tabs, sleeping phones, and back/forward restores throttle or
  // freeze the interval above, so a visitor returning after hours used to
  // stare at the old schedule until the next tick happened to fire. Re-check
  // the moment the page is visible again; the store skips the request when
  // this browser checked within FRESH_MS, and dedupes the several events a
  // single return fires (focus + visibilitychange) into one request.
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

  // For the manual "refresh" action on the stale-data notice: bypasses the
  // freshness check so it actually reaches the proxy instead of replaying
  // the same stale localStorage copy the user is trying to get rid of.
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

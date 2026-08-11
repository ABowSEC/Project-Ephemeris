import { useEffect, useMemo, useRef, useState } from 'react';
// launchStore is JS; allowJs infers its shape from the JSDoc there
import { getCachedLaunchBySlug, getLaunchBySlug } from '../services/launchStore';
import { launchDate } from '../utils/launchFields';
import { hasFlown } from '../data/launchStatus';
import type { LaunchDetailed } from '../types/launchLibrary';

/** Quiet refresh cadence, chosen by how close the launch is. */
const IDLE_POLL_MS = 5 * 60 * 1000;
const IMMINENT_POLL_MS = 30 * 1000;
/** Inside this window, a scrub or hold is worth catching within seconds. */
const IMMINENT_WINDOW_MS = 60 * 60 * 1000;

function pollIntervalFor(launch: LaunchDetailed | null): number | null {
  if (!launch) return IDLE_POLL_MS;
  // A launch that has flown is a finished record. Polling it forever would be
  // pure waste, and the tab may well be left open for days.
  if (hasFlown(launch.status)) return null;

  const date = launchDate(launch);
  if (!date) return IDLE_POLL_MS;

  const untilLaunch = date.getTime() - Date.now();
  // Also poll fast just *after* T-0: that is when the status flips to In
  // Flight and then to Success or Failure, which is exactly when someone
  // watching the page cares most.
  return untilLaunch < IMMINENT_WINDOW_MS && untilLaunch > -IMMINENT_WINDOW_MS
    ? IMMINENT_POLL_MS
    : IDLE_POLL_MS;
}

export interface LaunchDetailResult {
  launch: LaunchDetailed | null;
  /** True only when there is nothing at all to show yet. */
  loading: boolean;
  error: string | null;
  /** True when `launch` came from the feed and lacks detailed-only fields. */
  isPartial: boolean;
  notFound: boolean;
  refetch: () => void;
}

/**
 * One launch, by slug.
 *
 * Deliberately not built on useApi: this hook seeds its state synchronously
 * from whatever the store already has, so clicking a launch in the feed paints
 * the detail page immediately rather than flashing a spinner for data that is
 * sitting in localStorage. useApi always starts at `loading: true`, which is
 * right for a cold fetch and wrong here.
 */
export function useLaunchDetail(slug: string | undefined): LaunchDetailResult {
  const seed = useMemo(
    () => (slug ? (getCachedLaunchBySlug(slug) as LaunchDetailed | null) : null),
    [slug]
  );

  const [launch, setLaunch] = useState<LaunchDetailed | null>(seed);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(!seed);
  const [reloadToken, setReloadToken] = useState(0);

  // A feed entry has no `updates` array; a detailed payload always does, even
  // if empty. That is the cheapest reliable signal that we are showing the
  // shallow copy and should keep the detailed fetch going.
  const isPartial = Boolean(launch) && !Array.isArray(launch?.updates);

  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    setLaunch(seed);
    setLoading(!seed);
    setError(null);
    setNotFound(false);

    const load = async (force = false) => {
      try {
        const result = (await getLaunchBySlug(slug, { force })) as LaunchDetailed;
        if (cancelled) return;
        setLaunch(result);
        setError(null);
        setNotFound(false);
      } catch (err) {
        if (cancelled) return;
        const status = (err as { status?: number }).status;
        if (status === 404) setNotFound(true);
        // Keep showing the seeded copy on a transient failure — an error page
        // in place of data we already have would be a downgrade.
        else if (!seed) setError((err as Error).message ?? 'Could not load this launch.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [slug, seed, reloadToken]);

  // Poll on a cadence that tightens as T-0 approaches, and stops once the
  // launch has flown. Re-evaluated whenever the launch object changes, so the
  // interval tightens on its own as the window closes.
  useEffect(() => {
    const interval = pollIntervalFor(launch);
    if (!slug || interval == null) return;

    pollRef.current = window.setInterval(() => {
      getLaunchBySlug(slug)
        .then((result: LaunchDetailed) => setLaunch(result))
        .catch(() => {
          // Background refresh: a failure just means we keep the current copy
        });
    }, interval);

    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [slug, launch]);

  return {
    launch,
    loading,
    error,
    isPartial,
    notFound,
    refetch: () => setReloadToken((n) => n + 1),
  };
}

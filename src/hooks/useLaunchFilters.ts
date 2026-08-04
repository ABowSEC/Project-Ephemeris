import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
// useFavorites is untyped JS; `favorites` is an array of launch-id strings
import { useFavorites } from './useFavorites';
import { launchDate, providerName, rocketName } from '../utils/launchFields';
import type { LaunchListItem } from '../types/launchLibrary';

// The timeframe option list lives with the controls in LaunchFilters.tsx;
// this file only needs to know that `days` is a number of days or 'all'.
const DEFAULTS = { q: '', provider: '', status: '', days: 'all', tracked: '' };
type FilterKey = keyof typeof DEFAULTS;

export interface LaunchFilterState {
  values: Record<FilterKey, string>;
  setFilter: (key: FilterKey, value: string) => void;
  reset: () => void;
  filtered: LaunchListItem[];
  providers: string[];
  trackedCount: number;
  activeCount: number;
  total: number;
}

/**
 * Filter state for the launch list, stored in the URL query string.
 *
 * Query params rather than component state so a filtered view is itself a
 * link — "every Rocket Lab launch in the next 30 days" can be sent to someone
 * — and so the back button steps through filter changes the way people expect.
 *
 * All filtering runs client-side over the 50-launch feed already in memory, so
 * none of this costs a request against the 15/hour upstream budget.
 */
export function useLaunchFilters(launches: LaunchListItem[]): LaunchFilterState {
  const [searchParams, setSearchParams] = useSearchParams();
  const { favorites } = useFavorites();

  const values = useMemo(
    () =>
      Object.fromEntries(
        (Object.keys(DEFAULTS) as FilterKey[]).map((key) => [
          key,
          searchParams.get(key) ?? DEFAULTS[key],
        ])
      ) as Record<FilterKey, string>,
    [searchParams]
  );

  const setFilter = useCallback(
    (key: FilterKey, value: string) => {
      const next = new URLSearchParams(searchParams);
      // Defaults are absent from the URL rather than spelled out, so a clean
      // list has a clean link and `activeCount` below is just the param count.
      if (!value || value === DEFAULTS[key]) next.delete(key);
      else next.set(key, value);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const reset = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    (Object.keys(DEFAULTS) as FilterKey[]).forEach((key) => next.delete(key));
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // Built from the loaded feed rather than a hard-coded list, so a provider's
  // first-ever launch shows up in the dropdown the day it is announced.
  const providers = useMemo(() => {
    const names = new Set<string>();
    launches.forEach((launch) => {
      const name = providerName(launch);
      if (name) names.add(name);
    });
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [launches]);

  const trackedCount = useMemo(
    () => launches.filter((launch) => favorites.includes(launch.id)).length,
    [launches, favorites]
  );

  const filtered = useMemo(() => {
    const query = values.q.trim().toLowerCase();
    const cutoff =
      values.days === 'all' ? null : Date.now() + Number(values.days) * 24 * 60 * 60 * 1000;

    return launches.filter((launch) => {
      if (values.tracked === '1' && !favorites.includes(launch.id)) return false;
      if (values.provider && providerName(launch) !== values.provider) return false;
      if (values.status && launch.status?.abbrev !== values.status) return false;

      if (cutoff !== null) {
        const date = launchDate(launch);
        // A launch with no usable date can't be excluded by a date filter —
        // dropping it would silently hide missions that are merely unscheduled.
        if (date && date.getTime() > cutoff) return false;
      }

      if (query) {
        const haystack = [
          launch.name,
          providerName(launch),
          rocketName(launch),
          launch.mission?.name,
          launch.pad?.location?.name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      return true;
    });
  }, [launches, values, favorites]);

  const activeCount = (Object.keys(DEFAULTS) as FilterKey[]).filter(
    (key) => values[key] !== DEFAULTS[key]
  ).length;

  return {
    values,
    setFilter,
    reset,
    filtered,
    providers,
    trackedCount,
    activeCount,
    total: launches.length,
  };
}


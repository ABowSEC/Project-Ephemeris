import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Data-fetching hook: runs `fetcher` on mount and whenever `deps` change,
 * aborting any in-flight request first so a stale response can never
 * overwrite a newer one.
 *
 * @param {(signal: AbortSignal, options: Object) => Promise<any>} fetcher
 * @param {Array} deps - Values the fetcher closes over (like useEffect deps)
 * @returns {{ data, loading, error, refetch }}
 *   refetch({ background: true }) re-fetches without flipping `loading`,
 *   for silent polling that shouldn't replace content with a spinner.
 *   Any other keys in the options object passed to refetch (e.g. `force`)
 *   are forwarded to `fetcher` as its second argument, so a caller can ask
 *   for a real re-fetch rather than whatever cache the fetcher would
 *   otherwise consult.
 *
 * @example
 * const { data, loading, error, refetch } = useApi(
 *   (signal) => fetchJson(`/api/photos?page=${page}`, { signal }),
 *   [page]
 * );
 */
export function useApi(fetcher, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const controllerRef = useRef(null);

  const refetch = useCallback(async ({ background = false, ...fetcherOptions } = {}) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    if (!background) {
      setLoading(true);
      setError(null);
    }

    try {
      const result = await fetcher(controller.signal, fetcherOptions);
      if (controller.signal.aborted) return;
      setData(result);
      setError(null);
      setLoading(false);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err.message || 'Something went wrong.');
      setLoading(false);
    }
    // The caller's deps array stands in for `fetcher`, exactly like useEffect deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    refetch();
    // refetch assigns its controller synchronously before awaiting, so this
    // captures the controller belonging to THIS effect run. Aborting the
    // shared ref instead would cancel a newer request under StrictMode's
    // mount-unmount-mount cycle.
    const controller = controllerRef.current;
    return () => controller?.abort();
  }, [refetch]);

  return { data, loading, error, refetch };
}

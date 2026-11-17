import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';

/** Options forwarded to the fetcher; `background` is consumed by refetch itself. */
export type FetcherOptions = Record<string, unknown>;

export interface RefetchOptions extends FetcherOptions {
  background?: boolean;
}

export interface ApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: (options?: RefetchOptions) => Promise<void>;
}

/**
 * Runs `fetcher` on mount and when `deps` change, aborting any older request.
 * refetch({ background: true }) skips the loading state; other options (like
 * `force`) are passed through to the fetcher.
 *
 * @example
 * const { data, loading, error, refetch } = useApi(
 *   (signal) => fetchJson(`/api/photos?page=${page}`, { signal }),
 *   [page]
 * );
 */
export function useApi<T>(
  fetcher: (signal: AbortSignal, options: FetcherOptions) => Promise<T>,
  deps: DependencyList = []
): ApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const refetch = useCallback(async ({ background = false, ...fetcherOptions }: RefetchOptions = {}) => {
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
      setError((err instanceof Error && err.message) || 'Something went wrong.');
      setLoading(false);
    }
    // The caller's deps array stands in for `fetcher`, exactly like useEffect deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    refetch();
    // Capture this run's controller. Aborting the shared ref could cancel a
    // newer request under StrictMode's double mount.
    const controller = controllerRef.current;
    return () => controller?.abort();
  }, [refetch]);

  return { data, loading, error, refetch };
}

// Shared fetch wrapper: timeout, abort support, and one place that turns
// HTTP status codes into user-friendly error messages.

export class ApiError extends Error {
  status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function messageForStatus(status: number): string {
  if (status === 403) return 'Access denied. The API key may be invalid or missing.';
  if (status === 404) return 'The requested data was not found.';
  if (status === 429) return 'Rate limit exceeded. Please try again shortly.';
  if (status >= 500) return 'The service is temporarily unavailable.';
  return `Request failed (status ${status}).`;
}

export interface FetchJsonOptions {
  /** Caller abort (e.g. component unmount) */
  signal?: AbortSignal;
  /** Timeout in ms (default 8000) */
  timeoutMs?: number;
  /** HTTP cache mode, e.g. 'no-store' when the user explicitly asks for fresh data */
  cache?: RequestCache;
}

/**
 * fetchJson, plus the response headers — for callers that need metadata the
 * body doesn't carry, like the proxy's x-fetched-at.
 */
export async function fetchJsonWithHeaders<T = unknown>(
  url: string,
  { signal, timeoutMs = 8000, cache }: FetchJsonOptions = {}
): Promise<{ data: T; headers: Headers }> {
  const controller = new AbortController();
  const onCallerAbort = () => controller.abort();
  signal?.addEventListener('abort', onCallerAbort);
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal, cache });
    if (!res.ok) throw new ApiError(messageForStatus(res.status), res.status);
    return { data: (await res.json()) as T, headers: res.headers };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if ((err as Error).name === 'AbortError') {
      // Caller-initiated aborts propagate untouched so callers can ignore
      // them; anything else hitting this path is the timeout firing.
      if (signal?.aborted) throw err;
      throw new ApiError('Request timed out. The service may be experiencing issues.');
    }
    throw new ApiError('Network error. Check your connection.');
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onCallerAbort);
  }
}

/**
 * Fetch a URL and parse it as JSON, throwing ApiError with a readable
 * message on any failure (bad status, timeout, or network error).
 */
export async function fetchJson<T = unknown>(url: string, options?: FetchJsonOptions): Promise<T> {
  return (await fetchJsonWithHeaders<T>(url, options)).data;
}

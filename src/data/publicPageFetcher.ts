import type { PublicPageFetcher } from '../domain/metadata';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type FetchPageFetcherOptions = {
  /** Injected for tests; defaults to the platform `fetch`. */
  fetchImpl?: FetchLike;
  timeoutMs?: number;
};

/**
 * Reads public platform pages over plain HTTP GET. It never sends credentials, cookies,
 * or custom auth headers, so no account state can leak into recognition.
 */
export function createFetchPageFetcher(options: FetchPageFetcherOptions = {}): PublicPageFetcher {
  const fetchImpl: FetchLike = options.fetchImpl ?? ((url, init) => globalThis.fetch(url, init));
  const timeoutMs = options.timeoutMs ?? 8000;

  return {
    async fetchPage(url) {
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        return null;
      }
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;

      try {
        const response = await fetchImpl(url, {
          method: 'GET',
          redirect: 'follow',
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
          headers: { Accept: 'text/html,application/xhtml+xml' },
          signal: AbortSignal.timeout(timeoutMs),
        });
        return {
          finalUrl: response.url === '' ? url : response.url,
          status: response.status,
          body: await response.text(),
        };
      } catch {
        return null;
      }
    },
  };
}

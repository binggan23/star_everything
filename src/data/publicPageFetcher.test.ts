import { describe, expect, it, vi } from 'vitest';

import { createFetchPageFetcher } from './publicPageFetcher';

const BODY = '<html><head><meta property="og:title" content="标题"></head></html>';

function pageResponse(overrides: Partial<Response> = {}): Response {
  return {
    url: 'https://www.bilibili.com/video/BV1?xsec_token=secret',
    status: 200,
    text: async () => BODY,
    ...overrides,
  } as Response;
}

describe('public page fetcher', () => {
  it('reads a page with a credential-free GET that follows public redirects', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => pageResponse());
    const fetcher = createFetchPageFetcher({ fetchImpl, timeoutMs: 1000 });

    await expect(fetcher.fetchPage('https://b23.tv/abc')).resolves.toEqual({
      finalUrl: 'https://www.bilibili.com/video/BV1?xsec_token=secret',
      status: 200,
      body: BODY,
    });

    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe('https://b23.tv/abc');
    expect(init).toMatchObject({
      method: 'GET',
      redirect: 'follow',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
    expect(init?.headers).toEqual({ Accept: 'text/html,application/xhtml+xml' });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('returns null on network failure without writing the request URL to logs', async () => {
    const tokenUrl = 'https://www.bilibili.com/video/BV1?xsec_token=secret';
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit): Promise<Response> => {
      throw new Error(`request failed for ${tokenUrl}`);
    });
    const errorSpy = vi.spyOn(console, 'error');
    const warnSpy = vi.spyOn(console, 'warn');
    const logSpy = vi.spyOn(console, 'log');
    const fetcher = createFetchPageFetcher({ fetchImpl, timeoutMs: 1000 });

    await expect(fetcher.fetchPage(tokenUrl)).resolves.toBeNull();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('refuses a non-http URL without calling fetch', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => pageResponse());
    const fetcher = createFetchPageFetcher({ fetchImpl });

    await expect(fetcher.fetchPage('file:///etc/passwd')).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

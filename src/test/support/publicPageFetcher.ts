import { createMetadataRecognizer } from '../../domain/metadata';
import type { MetadataRecognizer, PublicPage, PublicPageFetcher } from '../../domain/metadata';

export type FixturePageFetcher = PublicPageFetcher & {
  /** URLs requested through the boundary, in call order. */
  requests: string[];
};

/** Serves deterministic fixtures and records requests, so tests never touch the network. */
export function createFixturePageFetcher(
  pages: Readonly<Record<string, PublicPage | null>> = {},
): FixturePageFetcher {
  const requests: string[] = [];

  return {
    requests,
    async fetchPage(url) {
      requests.push(url);
      return pages[url] ?? null;
    },
  };
}

export function createTestRecognizer(pages: Readonly<Record<string, PublicPage | null>> = {}): {
  recognizer: MetadataRecognizer;
  requests: string[];
} {
  const fetcher = createFixturePageFetcher(pages);
  return { recognizer: createMetadataRecognizer(fetcher), requests: fetcher.requests };
}

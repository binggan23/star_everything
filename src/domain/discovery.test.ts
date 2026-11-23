import { describe, expect, it } from 'vitest';

import { matchesDiscovery } from './discovery';
import type { DiscoverableEntry, DiscoveryFilters } from './discovery';

const entry: DiscoverableEntry = {
  title: 'A Quiet Place',
  url: 'https://example.com/video/1',
  author: 'Lin',
  platformLabelId: 'bilibili',
  platformLabelName: 'Bilibili',
  contentLabels: ['Film', 'Family'],
  folderPaths: ['Home / Movies / Favorites'],
};

const noFilters: DiscoveryFilters = {
  search: '',
  platformLabelIds: [],
  contentLabelNames: [],
};

describe('discovery matching', () => {
  it('matches case-insensitive substrings across searchable fields', () => {
    for (const search of [
      'quiet',
      'EXAMPLE.COM',
      'lin',
      'BILIBILI',
      'family',
      '#film',
      'favorites',
    ]) {
      expect(matchesDiscovery(entry, { ...noFilters, search })).toBe(true);
    }
    expect(matchesDiscovery(entry, { ...noFilters, search: 'missing' })).toBe(false);
  });

  it('ignores whitespace-only queries and handles nullable text fields', () => {
    const empty: DiscoverableEntry = {
      title: null,
      url: null,
      author: null,
      platformLabelId: null,
      platformLabelName: null,
      contentLabels: [],
      folderPaths: [],
    };
    expect(matchesDiscovery(empty, noFilters)).toBe(true);
    expect(
      matchesDiscovery({ ...entry, title: null, url: null }, { ...noFilters, search: '  ' }),
    ).toBe(true);
    expect(
      matchesDiscovery({ ...entry, title: null, url: null }, { ...noFilters, search: 'absent' }),
    ).toBe(false);
  });

  it('matches any selected value within each filter dimension', () => {
    expect(
      matchesDiscovery(entry, {
        ...noFilters,
        platformLabelIds: ['douyin', 'bilibili'],
        contentLabelNames: ['travel', 'fIlM'],
      }),
    ).toBe(true);
    expect(
      matchesDiscovery(entry, {
        ...noFilters,
        platformLabelIds: ['douyin', 'xiaohongshu'],
      }),
    ).toBe(false);
    expect(
      matchesDiscovery(entry, {
        ...noFilters,
        contentLabelNames: ['travel', 'cooking'],
      }),
    ).toBe(false);
  });

  it('combines text and filter dimensions with AND', () => {
    expect(
      matchesDiscovery(entry, {
        search: 'quiet',
        platformLabelIds: ['bilibili'],
        contentLabelNames: ['film'],
      }),
    ).toBe(true);
    expect(
      matchesDiscovery(entry, {
        search: 'quiet',
        platformLabelIds: ['douyin'],
        contentLabelNames: ['film'],
      }),
    ).toBe(false);
    expect(
      matchesDiscovery(entry, {
        search: 'not present',
        platformLabelIds: ['bilibili'],
        contentLabelNames: ['film'],
      }),
    ).toBe(false);
  });
});

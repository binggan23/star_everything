export type DiscoverableEntry = {
  title: string | null;
  url: string | null;
  author: string | null;
  platformLabelId: string | null;
  platformLabelName: string | null;
  contentLabels: readonly string[];
  /** Full collection paths the entry belongs to, used by the text search. */
  folderPaths: readonly string[];
};

export type DiscoveryFilters = {
  search: string;
  platformLabelIds: readonly string[];
  contentLabelNames: readonly string[];
};

/** Case-insensitive substring search plus OR within a dimension and AND across dimensions. */
export function matchesDiscovery(entry: DiscoverableEntry, filters: DiscoveryFilters): boolean {
  const query = filters.search.trim().toLowerCase();

  if (query !== '') {
    const fields = [
      entry.title,
      entry.url,
      entry.author,
      entry.platformLabelName,
      ...entry.contentLabels,
      ...entry.contentLabels.map((label) => `#${label}`),
      ...entry.folderPaths,
    ];
    const matches = fields.some((field) => field !== null && field.toLowerCase().includes(query));
    if (!matches) return false;
  }

  if (
    filters.platformLabelIds.length > 0 &&
    (entry.platformLabelId === null || !filters.platformLabelIds.includes(entry.platformLabelId))
  ) {
    return false;
  }

  if (filters.contentLabelNames.length > 0) {
    const labels = entry.contentLabels.map((label) => label.toLowerCase());
    const includesSelected = filters.contentLabelNames.some((selected) =>
      labels.includes(selected.toLowerCase()),
    );
    if (!includesSelected) return false;
  }

  return true;
}

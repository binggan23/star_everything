/** Stable identifiers for values the schema seeds once. */
export const HOME_FOLDER_ID = 'home';
export const HOME_FOLDER_NAME = 'Home';

/** A URL or an author is trimmed; an empty value means "not provided". */
export function normalizeOptional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** The folder fields the hierarchy helpers need; matches `Folder` in the repository. */
export type FolderLike = {
  id: string;
  name: string;
  parentId: string | null;
};

export type FolderNode = {
  folder: FolderLike;
  children: FolderNode[];
};

function folderIndex(folders: readonly FolderLike[]): Map<string, FolderLike> {
  return new Map(folders.map((folder) => [folder.id, folder]));
}

/** The names from the root folder down to `folderId`, joined for display and search. */
export function folderPath(folders: readonly FolderLike[], folderId: string): string {
  const byId = folderIndex(folders);
  const names: string[] = [];
  const seen = new Set<string>();
  let current = byId.get(folderId);

  while (current !== undefined && !seen.has(current.id)) {
    seen.add(current.id);
    names.unshift(current.name);
    current = current.parentId === null ? undefined : byId.get(current.parentId);
  }

  return names.join(' / ');
}

/** `folderId` plus every folder nested beneath it. */
export function collectFolderSubtree(
  folders: readonly FolderLike[],
  folderIds: readonly string[],
): Set<string> {
  const childrenByParent = new Map<string, string[]>();
  for (const folder of folders) {
    if (folder.parentId === null) continue;
    const siblings = childrenByParent.get(folder.parentId) ?? [];
    siblings.push(folder.id);
    childrenByParent.set(folder.parentId, siblings);
  }

  const subtree = new Set<string>();
  const pending = [...folderIds];
  while (pending.length > 0) {
    const id = pending.pop();
    if (id === undefined || subtree.has(id)) continue;
    subtree.add(id);
    for (const childId of childrenByParent.get(id) ?? []) pending.push(childId);
  }

  return subtree;
}

/** Nests folders by their parent link, keeping the order the repository returns. */
export function buildFolderTree(folders: readonly FolderLike[]): FolderNode[] {
  const nodes = new Map<string, FolderNode>(
    folders.map((folder) => [folder.id, { folder, children: [] }]),
  );
  const roots: FolderNode[] = [];

  for (const folder of folders) {
    const node = nodes.get(folder.id);
    if (node === undefined) continue;

    const parent = folder.parentId === null ? undefined : nodes.get(folder.parentId);
    if (parent === undefined) {
      roots.push(node);
    } else {
      parent.children.push(node);
    }
  }

  return roots;
}

import { useCallback, useEffect, useId, useState } from 'react';

import type {
  CollectionRepository,
  Entry,
  Folder,
  FolderErrorCode,
  SaveErrorCode,
} from '../data/collectionRepository';
import { buildFolderTree, folderPath, HOME_FOLDER_ID } from '../domain/collection';
import { EntryForm } from './EntryForm';
import type { EntryDraft, SubmitResult } from './EntryForm';
import { FolderPanel } from './FolderPanel';
import { FolderTree } from './FolderTree';

type Status = 'loading' | 'ready' | 'failed';

const EMPTY_DRAFT: EntryDraft = { url: '', author: '', folderIds: [HOME_FOLDER_ID] };

function saveErrorMessage(code: SaveErrorCode): string {
  switch (code) {
    case 'URL_OR_AUTHOR_REQUIRED':
      return '请填写网址或作者。';
    case 'ENTRY_NOT_FOUND':
      return '条目已不存在，请重新打开应用。';
  }
}

function folderErrorMessage(code: FolderErrorCode): string {
  switch (code) {
    case 'NAME_REQUIRED':
      return '请输入收藏夹名称。';
    case 'FOLDER_NOT_FOUND':
      return '收藏夹已不存在，请重新打开应用。';
    case 'INVALID_MOVE':
      return '不能移动到该收藏夹。';
  }
}

export function App({ repository }: { repository: CollectionRepository }) {
  const searchId = useId();
  const [status, setStatus] = useState<Status>('loading');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        await repository.init();
        const [nextEntries, nextFolders] = await Promise.all([
          repository.listEntries({
            ...(selectedFolderId === null ? {} : { folderIds: [selectedFolderId] }),
            ...(search.trim() === '' ? {} : { search }),
          }),
          repository.listFolders(),
        ]);
        if (cancelled) return;
        setEntries(nextEntries);
        setFolders(nextFolders);
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('failed');
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [repository, selectedFolderId, search, reloadKey]);

  const saveEntry = useCallback(
    async (draft: EntryDraft): Promise<SubmitResult> => {
      const result =
        editingId === null
          ? await repository.createEntry(draft)
          : await repository.updateEntry(editingId, draft);

      if (!result.ok) {
        return { saved: false, error: saveErrorMessage(result.error) };
      }

      setEditingId(null);
      setReloadKey((key) => key + 1);
      return { saved: true };
    },
    [repository, editingId],
  );

  const createFolder = useCallback(
    async (name: string): Promise<string | null> => {
      if (selectedFolderId === null) return null;

      const result = await repository.createFolder(name, selectedFolderId);
      if (!result.ok) return folderErrorMessage(result.error);

      setReloadKey((key) => key + 1);
      return null;
    },
    [repository, selectedFolderId],
  );

  const renameFolder = useCallback(
    async (name: string): Promise<string | null> => {
      if (selectedFolderId === null) return null;

      const result = await repository.renameFolder(selectedFolderId, name);
      if (!result.ok) return folderErrorMessage(result.error);

      setReloadKey((key) => key + 1);
      return null;
    },
    [repository, selectedFolderId],
  );

  const moveFolder = useCallback(
    async (parentId: string): Promise<string | null> => {
      if (selectedFolderId === null) return null;

      const result = await repository.moveFolder(selectedFolderId, parentId);
      if (!result.ok) return folderErrorMessage(result.error);

      setReloadKey((key) => key + 1);
      return null;
    },
    [repository, selectedFolderId],
  );

  if (status === 'loading') {
    return (
      <p className="status" role="status">
        加载中…
      </p>
    );
  }

  if (status === 'failed') {
    return (
      <p className="status" role="alert">
        无法读取本地数据，请重新打开应用。
      </p>
    );
  }

  const selectedFolder = folders.find((folder) => folder.id === selectedFolderId);
  const editingEntry = entries.find((entry) => entry.id === editingId) ?? null;
  const heading =
    selectedFolder === undefined ? '全部条目' : folderPath(folders, selectedFolder.id);

  return (
    <div className="app">
      <nav className="sidebar" aria-label="收藏夹">
        <p className="brand">Star Everything</p>
        <button
          type="button"
          className="nav-item"
          aria-current={selectedFolderId === null ? 'page' : undefined}
          onClick={() => {
            setSelectedFolderId(null);
            setEditingId(null);
          }}
        >
          全部条目
        </button>
        <FolderTree
          nodes={buildFolderTree(folders)}
          selectedId={selectedFolderId}
          onSelect={(folderId) => {
            setSelectedFolderId(folderId);
            setEditingId(null);
          }}
        />
      </nav>

      <main className="content">
        <div className="content-header">
          <h1>{heading}</h1>
          <label htmlFor={searchId} className="visually-hidden">
            搜索
          </label>
          <input
            id={searchId}
            type="search"
            className="search-input"
            autoComplete="off"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {selectedFolder !== undefined && (
          <FolderPanel
            key={selectedFolder.id}
            folders={folders}
            folder={selectedFolder}
            onCreate={createFolder}
            onRename={renameFolder}
            onMove={moveFolder}
          />
        )}

        <EntryForm
          key={`${editingEntry?.id ?? 'new-entry'}-${selectedFolderId ?? 'all'}`}
          folders={folders}
          initial={
            editingEntry === null
              ? {
                  ...EMPTY_DRAFT,
                  folderIds: [selectedFolderId ?? HOME_FOLDER_ID],
                }
              : {
                  url: editingEntry.url ?? '',
                  author: editingEntry.author ?? '',
                  folderIds: editingEntry.folderIds,
                }
          }
          submitLabel={editingEntry === null ? '保存条目' : '保存修改'}
          autoFocus={editingEntry !== null}
          onSubmit={saveEntry}
          onCancel={editingEntry === null ? undefined : () => setEditingId(null)}
        />

        {entries.length === 0 ? (
          <p className="empty">
            {selectedFolderId === null && search.trim() === ''
              ? '还没有收藏条目。'
              : '没有匹配的条目。'}
          </p>
        ) : (
          <ul className="entry-list" aria-label="收藏条目">
            {entries.map((entry) => (
              <li key={entry.id} className="entry">
                <div className="entry-text">
                  <span className="entry-primary">{entry.url ?? entry.author}</span>
                  {entry.url !== null && entry.author !== null && (
                    <span className="entry-secondary">{entry.author}</span>
                  )}
                  <span className="entry-paths">
                    {entry.folderIds.map((folderId) => folderPath(folders, folderId)).join(' · ')}
                  </span>
                </div>
                <button type="button" className="secondary" onClick={() => setEditingId(entry.id)}>
                  编辑
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

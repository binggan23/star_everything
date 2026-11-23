import { useCallback, useEffect, useState } from 'react';

import type {
  CollectionRepository,
  Entry,
  Folder,
  SaveErrorCode,
} from '../data/collectionRepository';
import { EntryForm } from './EntryForm';
import type { EntryDraft, SubmitResult } from './EntryForm';

type Status = 'loading' | 'ready' | 'failed';

const EMPTY_DRAFT: EntryDraft = { url: '', author: '' };

function saveErrorMessage(code: SaveErrorCode): string {
  switch (code) {
    case 'URL_OR_AUTHOR_REQUIRED':
      return '请填写网址或作者。';
    case 'ENTRY_NOT_FOUND':
      return '条目已不存在，请重新打开应用。';
  }
}

export function App({ repository }: { repository: CollectionRepository }) {
  const [status, setStatus] = useState<Status>('loading');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        await repository.init();
        const [nextEntries, nextFolders] = await Promise.all([
          repository.listEntries(
            selectedFolderId === null ? undefined : { folderId: selectedFolderId },
          ),
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
  }, [repository, selectedFolderId, reloadKey]);

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
        <ul className="folder-list">
          {folders.map((folder) => (
            <li key={folder.id}>
              <button
                type="button"
                className="nav-item"
                aria-current={selectedFolderId === folder.id ? 'page' : undefined}
                onClick={() => {
                  setSelectedFolderId(folder.id);
                  setEditingId(null);
                }}
              >
                {folder.name}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <main className="content">
        <h1>{selectedFolder?.name ?? '全部条目'}</h1>

        <EntryForm
          key={editingEntry?.id ?? 'new-entry'}
          initial={
            editingEntry === null
              ? EMPTY_DRAFT
              : { url: editingEntry.url ?? '', author: editingEntry.author ?? '' }
          }
          submitLabel={editingEntry === null ? '保存条目' : '保存修改'}
          autoFocus={editingEntry !== null}
          onSubmit={saveEntry}
          onCancel={editingEntry === null ? undefined : () => setEditingId(null)}
        />

        {entries.length === 0 ? (
          <p className="empty">还没有收藏条目。</p>
        ) : (
          <ul className="entry-list" aria-label="收藏条目">
            {entries.map((entry) => (
              <li key={entry.id} className="entry">
                <div className="entry-text">
                  <span className="entry-primary">{entry.url ?? entry.author}</span>
                  {entry.url !== null && entry.author !== null && (
                    <span className="entry-secondary">{entry.author}</span>
                  )}
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

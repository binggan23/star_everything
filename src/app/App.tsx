import { useCallback, useEffect, useId, useState } from 'react';

import type {
  CollectionRepository,
  ContentLabel,
  Entry,
  Folder,
  FolderErrorCode,
  PlatformLabel,
  SaveErrorCode,
} from '../data/collectionRepository';
import { buildFolderTree, folderPath, HOME_FOLDER_ID } from '../domain/collection';
import { matchesDiscovery } from '../domain/discovery';
import type { MetadataRecognizer } from '../domain/metadata';
import { formatContentLabels } from '../domain/labels';
import { EntryForm } from './EntryForm';
import type { EntryDraft, SubmitResult } from './EntryForm';
import { FolderPanel } from './FolderPanel';
import { FolderTree } from './FolderTree';
import { PlatformLabelManager } from './PlatformLabelManager';

type Status = 'loading' | 'ready' | 'failed';

function emptyDraft(folderId: string): EntryDraft {
  return {
    title: '',
    url: '',
    author: '',
    platformLabelId: '',
    contentLabels: '',
    folderIds: [folderId],
  };
}

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

export function App({
  repository,
  recognizer,
}: {
  repository: CollectionRepository;
  recognizer: MetadataRecognizer;
}) {
  const searchId = useId();
  const [status, setStatus] = useState<Status>('loading');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [platformLabels, setPlatformLabels] = useState<PlatformLabel[]>([]);
  const [contentLabels, setContentLabels] = useState<ContentLabel[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState<string[]>([]);
  const [contentFilter, setContentFilter] = useState<string[]>([]);
  const [managingLabels, setManagingLabels] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        await repository.init();
        const [nextEntries, nextFolders, nextPlatformLabels, nextContentLabels] = await Promise.all(
          [
            repository.listEntries(
              selectedFolderId === null ? {} : { folderIds: [selectedFolderId] },
            ),
            repository.listFolders(),
            repository.listPlatformLabels(),
            repository.listContentLabels(),
          ],
        );
        if (cancelled) return;
        setEntries(nextEntries);
        setFolders(nextFolders);
        setPlatformLabels(nextPlatformLabels);
        setContentLabels(nextContentLabels);
        setPlatformFilter((current) =>
          current.filter((id) => nextPlatformLabels.some((label) => label.id === id)),
        );
        setContentFilter((current) =>
          current.filter((name) =>
            nextContentLabels.some((label) => label.name.toLowerCase() === name.toLowerCase()),
          ),
        );
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

  const createPlatformLabel = useCallback(
    async (name: string) => {
      const result = await repository.createPlatformLabel(name);
      if (result.ok) setReloadKey((key) => key + 1);
      return result;
    },
    [repository],
  );

  const renamePlatformLabel = useCallback(
    async (id: string, name: string) => {
      const result = await repository.renamePlatformLabel(id, name);
      if (result.ok) setReloadKey((key) => key + 1);
      return result;
    },
    [repository],
  );

  const deletePlatformLabel = useCallback(
    async (id: string) => {
      await repository.deletePlatformLabel(id);
      setReloadKey((key) => key + 1);
    },
    [repository],
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
  const pathsByFolder = new Map(
    folders.map((folder) => [folder.id, folderPath(folders, folder.id)]),
  );
  const visibleEntries = entries.filter((entry) =>
    matchesDiscovery(
      {
        ...entry,
        folderPaths: entry.folderIds.map((id) => pathsByFolder.get(id) ?? ''),
      },
      {
        search: searchQuery,
        platformLabelIds: platformFilter,
        contentLabelNames: contentFilter,
      },
    ),
  );
  const searchActive =
    searchQuery.trim() !== '' || platformFilter.length > 0 || contentFilter.length > 0;
  const heading =
    selectedFolder === undefined ? '全部条目' : folderPath(folders, selectedFolder.id);
  const emptyMessage =
    entries.length === 0 && !searchActive && selectedFolder === undefined
      ? '还没有收藏条目。'
      : '没有符合条件的条目。';

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
        <h1>{heading}</h1>

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

        <form
          className="discovery"
          role="search"
          aria-label="搜索与筛选"
          onSubmit={(event) => event.preventDefault()}
        >
          <div className="field field-wide">
            <label htmlFor={searchId}>搜索</label>
            <input
              id={searchId}
              name="search"
              type="search"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>

          <fieldset className="filter-group">
            <legend>平台标签</legend>
            <ul className="filter-options">
              {platformLabels.map((label) => (
                <li key={label.id}>
                  <label>
                    <input
                      type="checkbox"
                      name="platform"
                      value={label.id}
                      checked={platformFilter.includes(label.id)}
                      onChange={(event) =>
                        setPlatformFilter((current) =>
                          event.target.checked
                            ? [...current, label.id]
                            : current.filter((id) => id !== label.id),
                        )
                      }
                    />
                    {label.name}
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>

          {contentLabels.length > 0 && (
            <fieldset className="filter-group">
              <legend>内容标签</legend>
              <ul className="filter-options">
                {contentLabels.map((label) => (
                  <li key={label.id}>
                    <label>
                      <input
                        type="checkbox"
                        name="content"
                        value={label.name}
                        checked={contentFilter.includes(label.name)}
                        onChange={(event) =>
                          setContentFilter((current) =>
                            event.target.checked
                              ? [...current, label.name]
                              : current.filter((name) => name !== label.name),
                          )
                        }
                      />
                      #{label.name}
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}

          {searchActive && (
            <button
              type="button"
              className="secondary clear-filters"
              onClick={() => {
                setSearchQuery('');
                setPlatformFilter([]);
                setContentFilter([]);
              }}
            >
              清除筛选
            </button>
          )}
        </form>

        <button
          type="button"
          className="secondary label-manager-toggle"
          aria-expanded={managingLabels}
          aria-controls="platform-label-manager"
          onClick={() => setManagingLabels((current) => !current)}
        >
          管理平台标签
        </button>

        {managingLabels && (
          <div id="platform-label-manager">
            <PlatformLabelManager
              labels={platformLabels}
              onCreate={createPlatformLabel}
              onRename={renamePlatformLabel}
              onDelete={deletePlatformLabel}
            />
          </div>
        )}

        <EntryForm
          key={`${editingEntry?.id ?? 'new-entry'}-${selectedFolderId ?? 'all'}`}
          folders={folders}
          platformLabels={platformLabels}
          recognizer={recognizer}
          initial={
            editingEntry === null
              ? emptyDraft(selectedFolderId ?? HOME_FOLDER_ID)
              : {
                  title: editingEntry.title ?? '',
                  url: editingEntry.url ?? '',
                  author: editingEntry.author ?? '',
                  platformLabelId: editingEntry.platformLabelId ?? '',
                  contentLabels: formatContentLabels(editingEntry.contentLabels),
                  folderIds: editingEntry.folderIds,
                }
          }
          submitLabel={editingEntry === null ? '保存条目' : '保存修改'}
          autoFocus={editingEntry !== null}
          onSubmit={saveEntry}
          onCancel={editingEntry === null ? undefined : () => setEditingId(null)}
        />

        {visibleEntries.length === 0 ? (
          <p className="empty">{emptyMessage}</p>
        ) : (
          <ul className="entry-list" aria-label="收藏条目">
            {visibleEntries.map((entry) => (
              <li key={entry.id} className="entry">
                <div className="entry-text">
                  {entry.title !== null && <span className="entry-title">{entry.title}</span>}
                  <span className="entry-primary">{entry.url ?? entry.author}</span>
                  {entry.url !== null && entry.author !== null && (
                    <span className="entry-secondary">{entry.author}</span>
                  )}
                  <span className="entry-paths">
                    {entry.folderIds.map((folderId) => folderPath(folders, folderId)).join(' · ')}
                  </span>
                  {(entry.platformLabelName !== null || entry.contentLabels.length > 0) && (
                    <span className="entry-labels">
                      {entry.platformLabelName !== null && (
                        <span className="chip">{entry.platformLabelName}</span>
                      )}
                      {entry.contentLabels.map((label) => (
                        <span key={label} className="chip">
                          #{label}
                        </span>
                      ))}
                    </span>
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

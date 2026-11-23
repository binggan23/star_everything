import { useId, useRef, useState } from 'react';

import { collectFolderSubtree, folderPath, HOME_FOLDER_ID } from '../domain/collection';
import type { Folder, FolderDeleteMode } from '../data/collectionRepository';
import { ConfirmDialog } from './ConfirmDialog';

export type FolderPanelProps = {
  folders: readonly Folder[];
  folder: Folder;
  /** Entries in this collection and its descendants; they decide which delete choices apply. */
  entryCount: number;
  onCreate: (name: string) => Promise<string | null>;
  onRename: (name: string) => Promise<string | null>;
  onMove: (parentId: string) => Promise<string | null>;
  onDelete: (mode: FolderDeleteMode) => Promise<string | null>;
};

type Mode = 'create' | 'rename' | 'move' | 'delete' | null;

/**
 * Collection management controls for the selected folder. Submit handlers report back a
 * user-facing error message, or `null` once the change is saved.
 */
export function FolderPanel({
  folders,
  folder,
  entryCount,
  onCreate,
  onRename,
  onMove,
  onDelete,
}: FolderPanelProps) {
  const nameId = useId();
  const parentId = useId();
  const deleteGroupId = useId();
  const errorId = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [name, setName] = useState('');
  const [parent, setParent] = useState(HOME_FOLDER_ID);
  const [deleteMode, setDeleteMode] = useState<FolderDeleteMode>('move-entries-to-home');
  const [error, setError] = useState<string | null>(null);

  const subfolderCount = collectFolderSubtree(folders, [folder.id]).size - 1;

  function open(nextMode: Exclude<Mode, null>) {
    setMode(nextMode);
    setName(nextMode === 'rename' ? folder.name : '');
    setParent(folder.parentId ?? HOME_FOLDER_ID);
    setDeleteMode('move-entries-to-home');
    setError(null);
  }

  function close() {
    setMode(null);
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message =
      mode === 'rename'
        ? await onRename(name)
        : mode === 'create'
          ? await onCreate(name)
          : mode === 'move'
            ? await onMove(parent)
            : null;
    if (message === null) {
      close();
    } else {
      setError(message);
      nameRef.current?.focus();
    }
  }

  const submitLabel = mode === 'rename' ? '保存' : mode === 'move' ? '移动' : '创建';

  return (
    <div className="folder-panel">
      <div className="folder-actions">
        <button type="button" className="secondary" onClick={() => open('create')}>
          新建子收藏夹
        </button>
        {folder.id !== HOME_FOLDER_ID && (
          <>
            <button type="button" className="secondary" onClick={() => open('rename')}>
              重命名
            </button>
            <button type="button" className="secondary" onClick={() => open('move')}>
              移动收藏夹
            </button>
            <button type="button" className="secondary" onClick={() => open('delete')}>
              删除收藏夹
            </button>
          </>
        )}
      </div>

      {mode === 'delete' && (
        <DeleteFolderDialog
          folder={folder}
          subfolderCount={subfolderCount}
          entryCount={entryCount}
          mode={deleteMode}
          onModeChange={setDeleteMode}
          onCancel={close}
          onConfirm={async () => {
            const message = await onDelete(deleteMode);
            if (message === null) close();
            else setError(message);
          }}
          groupName={deleteGroupId}
          error={error}
        />
      )}

      {mode !== null && mode !== 'delete' && (
        <form className="folder-form" onSubmit={handleSubmit} noValidate>
          {mode === 'move' ? (
            <div className="field">
              <label htmlFor={parentId}>移动到</label>
              <select
                id={parentId}
                name="parent"
                value={parent}
                autoFocus
                aria-invalid={error !== null}
                aria-describedby={error === null ? undefined : errorId}
                onChange={(event) => {
                  setParent(event.target.value);
                  setError(null);
                }}
              >
                {folders.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {folderPath(folders, candidate.id)}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="field">
              <label htmlFor={nameId}>名称</label>
              <input
                ref={nameRef}
                id={nameId}
                name="name"
                type="text"
                autoComplete="off"
                value={name}
                autoFocus
                aria-invalid={error !== null}
                aria-describedby={error === null ? undefined : errorId}
                onChange={(event) => {
                  setName(event.target.value);
                  setError(null);
                }}
              />
            </div>
          )}

          {error !== null && (
            <p id={errorId} className="form-error">
              {error}
            </p>
          )}

          <div className="form-actions">
            <button type="submit" className="primary">
              {submitLabel}
            </button>
            <button type="button" className="secondary" onClick={close}>
              取消
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

type DeleteFolderDialogProps = {
  folder: Folder;
  subfolderCount: number;
  entryCount: number;
  mode: FolderDeleteMode;
  onModeChange: (mode: FolderDeleteMode) => void;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  groupName: string;
  error: string | null;
};

function DeleteFolderDialog({
  folder,
  subfolderCount,
  entryCount,
  mode,
  onModeChange,
  onConfirm,
  onCancel,
  groupName,
  error,
}: DeleteFolderDialogProps) {
  return (
    <ConfirmDialog
      title="删除收藏夹？"
      confirmLabel="删除"
      onConfirm={() => void onConfirm()}
      onCancel={onCancel}
    >
      <p className="confirm-impact">
        将删除「{folder.name}」{subfolderCount > 0 ? `及其 ${subfolderCount} 个子收藏夹` : ''}， 共{' '}
        {entryCount} 个条目受影响。
      </p>

      {entryCount > 0 && (
        <fieldset className="delete-choices" aria-label="条目处理方式">
          <label>
            <input
              type="radio"
              name={groupName}
              checked={mode === 'move-entries-to-home'}
              onChange={() => onModeChange('move-entries-to-home')}
            />
            条目移到 Home，删除收藏夹
          </label>
          <label>
            <input
              type="radio"
              name={groupName}
              checked={mode === 'trash-tree'}
              onChange={() => onModeChange('trash-tree')}
            />
            收藏夹和条目移到回收站
          </label>
        </fieldset>
      )}

      {error !== null && <p className="form-error">{error}</p>}
    </ConfirmDialog>
  );
}

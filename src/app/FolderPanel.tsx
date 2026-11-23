import { useId, useRef, useState } from 'react';

import { folderPath, HOME_FOLDER_ID } from '../domain/collection';
import type { Folder } from '../data/collectionRepository';

export type FolderPanelProps = {
  folders: readonly Folder[];
  folder: Folder;
  onCreate: (name: string) => Promise<string | null>;
  onRename: (name: string) => Promise<string | null>;
  onMove: (parentId: string) => Promise<string | null>;
};

type Mode = 'create' | 'rename' | 'move' | null;

/**
 * Collection management controls for the selected folder. Submit handlers report back a
 * user-facing error message, or `null` once the change is saved.
 */
export function FolderPanel({ folders, folder, onCreate, onRename, onMove }: FolderPanelProps) {
  const nameId = useId();
  const parentId = useId();
  const errorId = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [name, setName] = useState('');
  const [parent, setParent] = useState(HOME_FOLDER_ID);
  const [error, setError] = useState<string | null>(null);

  function open(nextMode: Exclude<Mode, null>) {
    setMode(nextMode);
    setName(nextMode === 'rename' ? folder.name : '');
    setParent(folder.parentId ?? HOME_FOLDER_ID);
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
          </>
        )}
      </div>

      {mode !== null && (
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

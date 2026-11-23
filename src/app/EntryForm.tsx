import { useEffect, useId, useRef, useState } from 'react';

import { folderPath } from '../domain/collection';
import type { Folder } from '../data/collectionRepository';

export type EntryDraft = {
  url: string;
  author: string;
  folderIds: string[];
};

export type SubmitResult = { saved: true } | { saved: false; error: string };

export type EntryFormProps = {
  initial: EntryDraft;
  folders: readonly Folder[];
  submitLabel: string;
  onSubmit: (draft: EntryDraft) => Promise<SubmitResult>;
  onCancel?: () => void;
  autoFocus?: boolean;
};

export function EntryForm({
  initial,
  folders,
  submitLabel,
  onSubmit,
  onCancel,
  autoFocus = false,
}: EntryFormProps) {
  const urlId = useId();
  const authorId = useId();
  const folderId = useId();
  const errorId = useId();
  const urlRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<EntryDraft>(initial);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (error !== null) urlRef.current?.focus();
  }, [error]);

  function update(field: 'url' | 'author', value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setError(null);
  }

  function toggleFolder(folderId: string) {
    setDraft((current) => ({
      ...current,
      folderIds: current.folderIds.includes(folderId)
        ? current.folderIds.filter((id) => id !== folderId)
        : [...current.folderIds, folderId],
    }));
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await onSubmit(draft);
    if (result.saved) {
      setDraft(initial);
      setError(null);
    } else {
      setError(result.error);
    }
  }

  const invalid = error !== null;
  const describedBy = invalid ? errorId : undefined;

  return (
    <form className="entry-form" onSubmit={handleSubmit} noValidate>
      <div className="field">
        <label htmlFor={urlId}>网址</label>
        <input
          ref={urlRef}
          id={urlId}
          name="url"
          type="text"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={draft.url}
          autoFocus={autoFocus}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          onChange={(event) => update('url', event.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor={authorId}>作者</label>
        <input
          id={authorId}
          name="author"
          type="text"
          autoComplete="off"
          value={draft.author}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          onChange={(event) => update('author', event.target.value)}
        />
      </div>

      <fieldset className="field folder-field">
        <legend>收藏夹</legend>
        {folders.map((folder) => {
          const id = `${folderId}-${folder.id}`;
          return (
            <span key={folder.id} className="folder-choice">
              <input
                id={id}
                type="checkbox"
                checked={draft.folderIds.includes(folder.id)}
                onChange={() => toggleFolder(folder.id)}
              />
              <label htmlFor={id}>{folderPath(folders, folder.id)}</label>
            </span>
          );
        })}
      </fieldset>

      {invalid && (
        <p id={errorId} className="form-error">
          {error}
        </p>
      )}

      <div className="form-actions">
        <button type="submit" className="primary">
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="secondary" onClick={onCancel}>
            取消
          </button>
        )}
      </div>
    </form>
  );
}

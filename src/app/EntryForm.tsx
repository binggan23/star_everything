import { useEffect, useId, useRef, useState } from 'react';

export type EntryDraft = {
  url: string;
  author: string;
};

export type SubmitResult = { saved: true } | { saved: false; error: string };

export type EntryFormProps = {
  initial: EntryDraft;
  submitLabel: string;
  onSubmit: (draft: EntryDraft) => Promise<SubmitResult>;
  onCancel?: () => void;
  autoFocus?: boolean;
};

export function EntryForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  autoFocus = false,
}: EntryFormProps) {
  const urlId = useId();
  const authorId = useId();
  const errorId = useId();
  const urlRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<EntryDraft>(initial);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (error !== null) urlRef.current?.focus();
  }, [error]);

  function update(field: keyof EntryDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
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

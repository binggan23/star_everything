import { useEffect, useId, useRef, useState } from 'react';

import type { PlatformLabel } from '../data/collectionRepository';
import { folderPath } from '../domain/collection';
import type { Folder } from '../data/collectionRepository';
import type { MetadataRecognizer, RecognitionProblem } from '../domain/metadata';
import { SEEDED_PLATFORM_LABEL_IDS } from '../domain/platforms';

export type EntryDraft = {
  title: string;
  url: string;
  author: string;
  platformLabelId: string;
  contentLabels: string;
  folderIds: string[];
};

export type SubmitResult = { saved: true } | { saved: false; error: string };

export type EntryFormProps = {
  initial: EntryDraft;
  folders: readonly Folder[];
  platformLabels: readonly PlatformLabel[];
  recognizer: MetadataRecognizer;
  submitLabel: string;
  onSubmit: (draft: EntryDraft) => Promise<SubmitResult>;
  onCancel?: () => void;
  autoFocus?: boolean;
};

export function EntryForm({
  initial,
  folders,
  platformLabels,
  recognizer,
  submitLabel,
  onSubmit,
  onCancel,
  autoFocus = false,
}: EntryFormProps) {
  const titleId = useId();
  const urlId = useId();
  const authorId = useId();
  const platformId = useId();
  const contentLabelsId = useId();
  const folderId = useId();
  const shareId = useId();
  const errorId = useId();
  const urlRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<EntryDraft>(initial);
  const [shareText, setShareText] = useState('');
  const [recognizing, setRecognizing] = useState(false);
  const [recognitionMessage, setRecognitionMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (error !== null) urlRef.current?.focus();
  }, [error]);

  function update(
    field: 'title' | 'url' | 'author' | 'platformLabelId' | 'contentLabels',
    value: string,
  ) {
    setDraft((current) => ({ ...current, [field]: value }));
    setError(null);
  }

  function toggleFolder(id: string) {
    setDraft((current) => ({
      ...current,
      folderIds: current.folderIds.includes(id)
        ? current.folderIds.filter((folder) => folder !== id)
        : [...current.folderIds, id],
    }));
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await onSubmit(draft);
    if (result.saved) {
      setDraft(initial);
      setShareText('');
      setRecognitionMessage(null);
      setError(null);
    } else {
      setError(result.error);
    }
  }

  async function handleRecognize() {
    if (recognizing) return;

    const input = shareText.trim() === '' ? draft.url : shareText;
    setRecognizing(true);
    setRecognitionMessage(null);
    try {
      const result = await recognizer.recognize(input);
      setDraft((current) => {
        const platformLabelId =
          current.platformLabelId === '' && result.platform !== null
            ? SEEDED_PLATFORM_LABEL_IDS[result.platform]
            : current.platformLabelId;
        return {
          ...current,
          url:
            current.url.trim() === '' || input.includes(current.url.trim())
              ? (result.url ?? current.url)
              : current.url,
          title: recognizedValue(current.title, result.title),
          author: recognizedValue(current.author, result.author),
          platformLabelId: platformLabels.some((label) => label.id === platformLabelId)
            ? platformLabelId
            : current.platformLabelId,
        };
      });
      setRecognitionMessage(result.problem === null ? '已识别' : describeProblem(result.problem));
    } finally {
      setRecognizing(false);
    }
  }

  function recognizedValue(current: string, recognized: string | null): string {
    return current.trim() === '' && recognized !== null ? recognized : current;
  }

  function describeProblem(problem: RecognitionProblem): string {
    switch (problem) {
      case 'NO_INPUT':
        return '请粘贴链接或分享文案。';
      case 'NO_URL':
        return '未找到链接，请检查后重试。';
      case 'UNSUPPORTED_PLATFORM':
        return '暂不支持自动识别，请手动填写标题和作者。';
      case 'PAGE_UNAVAILABLE':
        return '无法读取平台页面，请手动填写。';
      case 'VERIFICATION_REQUIRED':
        return '平台要求验证，请手动填写标题和作者。';
      case 'ERROR_PAGE':
        return '平台页面不可用，请手动填写。';
      case 'METADATA_MISSING':
        return '未能识别标题和作者，请补充分享文案或手动填写。';
    }
  }

  const invalid = error !== null;
  const describedBy = invalid ? errorId : undefined;
  const recognitionStatus = recognizing ? '识别中…' : recognitionMessage;

  return (
    <form className="entry-form" onSubmit={handleSubmit} noValidate>
      <div className="field field-wide">
        <label htmlFor={shareId}>分享链接或文案</label>
        <textarea
          id={shareId}
          name="shareText"
          rows={2}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={shareText}
          onChange={(event) => {
            setShareText(event.target.value);
            setRecognitionMessage(null);
          }}
        />
        <div className="share-actions">
          <button
            type="button"
            className="secondary"
            disabled={recognizing}
            aria-busy={recognizing}
            onClick={handleRecognize}
          >
            识别
          </button>
          {recognitionStatus !== null && (
            <p className="share-status" role="status">
              {recognitionStatus}
            </p>
          )}
        </div>
      </div>

      <div className="field field-wide">
        <label htmlFor={titleId}>标题</label>
        <input
          id={titleId}
          name="title"
          type="text"
          autoComplete="off"
          value={draft.title}
          onChange={(event) => update('title', event.target.value)}
        />
      </div>

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

      <div className="field">
        <label htmlFor={platformId}>平台标签</label>
        <select
          id={platformId}
          name="platformLabelId"
          value={draft.platformLabelId}
          onChange={(event) => update('platformLabelId', event.target.value)}
        >
          <option value="">无</option>
          {platformLabels.map((label) => (
            <option key={label.id} value={label.id}>
              {label.name}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor={contentLabelsId}>内容标签</label>
        <input
          id={contentLabelsId}
          name="contentLabels"
          type="text"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="#标签 #标签"
          value={draft.contentLabels}
          onChange={(event) => update('contentLabels', event.target.value)}
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

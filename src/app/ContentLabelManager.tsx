import { useId, useState } from 'react';

import type {
  ContentLabel,
  ContentLabelErrorCode,
  ContentLabelResult,
} from '../data/collectionRepository';

function labelErrorMessage(code: ContentLabelErrorCode): string {
  switch (code) {
    case 'LABEL_NAME_REQUIRED':
      return '请输入内容标签名称。';
    case 'LABEL_NAME_TAKEN':
      return '内容标签已存在。';
    case 'LABEL_NOT_FOUND':
      return '内容标签已不存在，请重新打开管理面板。';
    case 'LABEL_IN_USE':
      return '内容标签正在使用，请先从条目中移除。';
  }
}

export type ContentLabelManagerProps = {
  labels: ContentLabel[];
  onRename: (id: string, name: string) => Promise<ContentLabelResult>;
  onDelete: (id: string) => Promise<ContentLabelResult>;
};

export function ContentLabelManager({ labels, onRename, onDelete }: ContentLabelManagerProps) {
  const editNameId = useId();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleRename(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editingId === null) return;
    const result = await onRename(editingId, editName);
    if (!result.ok) {
      setError(labelErrorMessage(result.error));
      return;
    }
    setEditingId(null);
    setError(null);
  }

  async function handleDelete(id: string) {
    const result = await onDelete(id);
    if (!result.ok) {
      setError(labelErrorMessage(result.error));
      return;
    }
    if (editingId === id) setEditingId(null);
    setError(null);
  }

  return (
    <section className="label-manager" aria-label="内容标签管理">
      {labels.length === 0 ? (
        <p className="empty">还没有内容标签。</p>
      ) : (
        <ul className="label-list">
          {labels.map((label) =>
            editingId === label.id ? (
              <li key={label.id}>
                <form className="label-edit" aria-label="重命名内容标签" onSubmit={handleRename}>
                  <label htmlFor={editNameId}>内容标签名称</label>
                  <input
                    id={editNameId}
                    name="name"
                    type="text"
                    autoComplete="off"
                    autoFocus
                    value={editName}
                    aria-invalid={error !== null}
                    onChange={(event) => {
                      setEditName(event.target.value);
                      setError(null);
                    }}
                  />
                  <button type="submit" className="secondary">
                    保存
                  </button>
                  <button type="button" className="secondary" onClick={() => setEditingId(null)}>
                    取消
                  </button>
                </form>
              </li>
            ) : (
              <li key={label.id} className="label-row">
                <span>#{label.name}</span>
                <button
                  type="button"
                  className="secondary"
                  aria-label={`重命名 #${label.name}`}
                  onClick={() => {
                    setEditingId(label.id);
                    setEditName(label.name);
                    setError(null);
                  }}
                >
                  重命名
                </button>
                <button
                  type="button"
                  className="secondary"
                  aria-label={`删除 #${label.name}`}
                  onClick={() => void handleDelete(label.id)}
                >
                  删除
                </button>
              </li>
            ),
          )}
        </ul>
      )}
      {error !== null && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

import { useId, useState } from 'react';

import type { LabelErrorCode, LabelResult, PlatformLabel } from '../data/collectionRepository';

function labelErrorMessage(code: LabelErrorCode): string {
  switch (code) {
    case 'LABEL_NAME_REQUIRED':
      return '请输入平台标签名称。';
    case 'LABEL_NAME_TAKEN':
      return '平台标签已存在。';
    case 'LABEL_NOT_FOUND':
      return '平台标签已不存在，请重新打开管理面板。';
  }
}

export type PlatformLabelManagerProps = {
  labels: PlatformLabel[];
  onCreate: (name: string) => Promise<LabelResult>;
  onRename: (id: string, name: string) => Promise<LabelResult>;
  onDelete: (id: string) => Promise<void>;
};

export function PlatformLabelManager({
  labels,
  onCreate,
  onRename,
  onDelete,
}: PlatformLabelManagerProps) {
  const newNameId = useId();
  const editNameId = useId();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await onCreate(newName);
    if (!result.ok) {
      setError(labelErrorMessage(result.error));
      return;
    }
    setNewName('');
    setError(null);
  }

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

  function startRename(label: PlatformLabel) {
    setEditingId(label.id);
    setEditName(label.name);
    setError(null);
  }

  async function handleDelete(id: string) {
    await onDelete(id);
    if (editingId === id) setEditingId(null);
    setError(null);
  }

  return (
    <section className="label-manager" aria-label="平台标签管理">
      <ul className="label-list">
        {labels.map((label) =>
          editingId === label.id ? (
            <li key={label.id}>
              <form className="label-edit" onSubmit={handleRename}>
                <label htmlFor={editNameId}>平台标签名称</label>
                <input
                  id={editNameId}
                  type="text"
                  autoFocus
                  value={editName}
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
              <span>{label.name}</span>
              <button
                type="button"
                className="secondary"
                aria-label={`重命名 ${label.name}`}
                onClick={() => startRename(label)}
              >
                重命名
              </button>
              <button
                type="button"
                className="secondary"
                aria-label={`删除 ${label.name}`}
                onClick={() => void handleDelete(label.id)}
              >
                删除
              </button>
            </li>
          ),
        )}
      </ul>

      <form className="label-add" onSubmit={handleCreate}>
        <label htmlFor={newNameId}>新平台标签</label>
        <input
          id={newNameId}
          type="text"
          autoComplete="off"
          value={newName}
          onChange={(event) => {
            setNewName(event.target.value);
            setError(null);
          }}
        />
        <button type="submit" className="secondary">
          添加平台标签
        </button>
      </form>

      {error !== null && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

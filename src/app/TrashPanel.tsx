import { useState } from 'react';

import type { TrashItem } from '../data/collectionRepository';
import { ConfirmDialog } from './ConfirmDialog';

export type TrashPanelProps = {
  items: readonly TrashItem[];
  onRestore: (id: string) => void;
  onPurge: (id: string) => void;
  onClearAll: () => void;
};

type PendingPurge = { kind: 'one'; item: TrashItem } | { kind: 'all' } | null;

/** Recoverable deleted entries and collection groups, newest first. */
export function TrashPanel({ items, onRestore, onPurge, onClearAll }: TrashPanelProps) {
  const [pending, setPending] = useState<PendingPurge>(null);

  if (items.length === 0) {
    return <p className="empty">回收站是空的。</p>;
  }

  return (
    <>
      <ul className="trash-list" aria-label="回收站项目">
        {items.map((item) => (
          <li key={item.id} className="trash-item">
            <div className="trash-text">
              <span className="trash-label">{item.label}</span>
              <span className="trash-meta">
                {item.kind === 'collection'
                  ? `收藏夹 · ${item.folderCount} 个收藏夹 · ${item.entryCount} 个条目`
                  : '条目'}
              </span>
              <span className="trash-retention">剩余 {item.retentionDays} 天</span>
            </div>
            <button
              type="button"
              className="secondary"
              aria-label={`恢复 ${item.label}`}
              onClick={() => onRestore(item.id)}
            >
              恢复
            </button>
            <button
              type="button"
              className="secondary"
              aria-label={`立即清除 ${item.label}`}
              onClick={() => setPending({ kind: 'one', item })}
            >
              立即清除
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="secondary trash-clear"
        onClick={() => setPending({ kind: 'all' })}
      >
        立即清空回收站
      </button>

      {pending !== null && (
        <ConfirmDialog
          title="永久清除？"
          confirmLabel={pending.kind === 'all' ? '清空回收站' : '永久清除'}
          onCancel={() => setPending(null)}
          onConfirm={() => {
            if (pending.kind === 'all') onClearAll();
            else onPurge(pending.item.id);
            setPending(null);
          }}
        >
          <p className="confirm-impact">
            {pending.kind === 'all'
              ? `回收站中的 ${items.length} 个项目将被永久删除，无法恢复。`
              : `「${pending.item.label}」将被永久删除，无法恢复。`}
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}

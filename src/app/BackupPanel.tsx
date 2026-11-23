import { useId, useState } from 'react';

import { BackupError, readBackup } from '../domain/backup';
import type { BackupData, ImportMode } from '../domain/backup';
import { ConfirmDialog } from './ConfirmDialog';

function downloadBackup(text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const revoke = URL.revokeObjectURL.bind(URL);
  const link = document.createElement('a');
  link.href = url;
  link.download = `star-everything-${new Date().toISOString().replaceAll(':', '-')}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => revoke(url), 1000);
}

const importErrors = {
  format: '文件格式无效，请选择 Star Everything 导出的 JSON 备份。',
  version: '此备份版本不受支持。',
  integrity: '备份数据不完整或已损坏。',
  conflict: '备份与本机数据冲突，无法合并。你仍可选择替换导入。',
};

export function BackupPanel({
  onExport,
  onImport,
}: {
  onExport: () => Promise<string>;
  onImport: (backup: BackupData, mode: ImportMode) => Promise<void>;
}) {
  const fileId = useId();
  const feedbackId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [pendingReplace, setPendingReplace] = useState<BackupData | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null);

  async function handleExport() {
    setBusy(true);
    setFeedback(null);
    try {
      downloadBackup(await onExport());
    } catch {
      setFeedback({ error: true, text: '无法导出备份，请重试。' });
    } finally {
      setBusy(false);
    }
  }

  async function handleImport(mode: ImportMode, confirmed?: BackupData) {
    if (file === null || busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      const backup = confirmed ?? (await readBackup(await file.text()));
      if (mode === 'replace' && confirmed === undefined) {
        setPendingReplace(backup);
        return;
      }
      await onImport(backup, mode);
      setFeedback({ error: false, text: mode === 'merge' ? '备份已合并。' : '本机数据已替换。' });
    } catch (error) {
      setFeedback({
        error: true,
        text: error instanceof BackupError ? importErrors[error.code] : '无法导入备份，请重试。',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="settings-section">
      <h2>备份</h2>
      <button type="button" className="secondary" disabled={busy} onClick={handleExport}>
        导出 JSON 备份
      </button>
      <div className="field">
        <label htmlFor={fileId}>备份文件</label>
        <input
          id={fileId}
          name="backup"
          type="file"
          accept=".json,application/json"
          disabled={busy}
          aria-describedby={feedback?.error ? feedbackId : undefined}
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setFeedback(null);
          }}
        />
      </div>
      <div className="settings-options">
        <button
          type="button"
          className="secondary"
          disabled={file === null}
          aria-disabled={busy}
          onClick={() => void handleImport('merge')}
        >
          合并导入
        </button>
        <button
          type="button"
          className="secondary"
          disabled={file === null}
          aria-disabled={busy}
          onClick={() => void handleImport('replace')}
        >
          替换导入
        </button>
      </div>
      {pendingReplace !== null && (
        <ConfirmDialog
          title="替换本机数据？"
          description="本机的收藏条目、标签、收藏夹、设置和回收站将被此备份覆盖，无法撤销。"
          closeOnConfirm
          confirmLabel="确认替换"
          onCancel={() => setPendingReplace(null)}
          onConfirm={() => {
            setPendingReplace(null);
            void handleImport('replace', pendingReplace);
          }}
        />
      )}
      {feedback !== null && (
        <p
          id={feedbackId}
          className={feedback.error ? 'form-error' : 'settings-status'}
          role={feedback.error ? 'alert' : 'status'}
        >
          {feedback.text}
        </p>
      )}
    </section>
  );
}

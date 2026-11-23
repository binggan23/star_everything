import { useState } from 'react';

import { themes } from '../domain/settings';
import type { Settings } from '../domain/settings';

const themeLabels = { system: '跟随系统', light: '浅色', dark: '深色' };

export function SettingsPanel({
  settings,
  onSave,
}: {
  settings: Settings;
  onSave: (settings: Settings) => Promise<void>;
}) {
  const [draft, setDraft] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<'saved' | 'error' | null>(null);

  return (
    <form
      className="settings-form"
      aria-label="偏好"
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        setFeedback(null);
        try {
          await onSave(draft);
          setFeedback('saved');
        } catch {
          setFeedback('error');
        } finally {
          setSaving(false);
        }
      }}
    >
      <fieldset className="filter-group" disabled={saving}>
        <legend>主题</legend>
        <div className="settings-options">
          {themes.map((theme) => (
            <label key={theme}>
              <input
                type="radio"
                name="theme"
                value={theme}
                checked={draft.theme === theme}
                onChange={() => {
                  setDraft({ ...draft, theme });
                  setFeedback(null);
                }}
              />
              {themeLabels[theme]}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="settings-choice">
        <input
          type="checkbox"
          name="recognizeMetadata"
          checked={draft.recognizeMetadata}
          disabled={saving}
          onChange={(event) => {
            setDraft({ ...draft, recognizeMetadata: event.target.checked });
            setFeedback(null);
          }}
        />
        启用元数据识别
      </label>
      <div className="settings-options">
        <button type="submit" className="primary" disabled={saving}>
          保存偏好
        </button>
        {feedback === 'saved' && <span role="status">偏好已保存。</span>}
        {feedback === 'error' && (
          <span role="alert" className="form-error">
            无法保存偏好，请重试。
          </span>
        )}
      </div>
    </form>
  );
}

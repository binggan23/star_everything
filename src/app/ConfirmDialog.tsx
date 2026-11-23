import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';

export type ConfirmDialogProps = {
  title: string;
  children?: ReactNode;
  description?: string;
  closeOnConfirm?: boolean;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * A blocking confirmation around an irreversible change. Opened as a native modal where
 * supported; environments without `showModal` (such as jsdom) fall back to `open`.
 */
export function ConfirmDialog({
  title,
  children,
  description,
  closeOnConfirm = false,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null || dialog.open) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }, []);

  function cancel() {
    dialogRef.current?.close?.();
    onCancel();
  }

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        cancel();
      }}
    >
      <h2 id={titleId}>{title}</h2>
      {description && (
        <p className="confirm-impact" id={descriptionId}>
          {description}
        </p>
      )}
      {children}
      <div className="form-actions">
        <button type="button" className="secondary" autoFocus onClick={cancel}>
          取消
        </button>
        <button
          type="button"
          className="danger"
          onClick={() => {
            if (closeOnConfirm) dialogRef.current?.close?.();
            onConfirm();
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}

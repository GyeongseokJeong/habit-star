"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertCircle } from "lucide-react";

export type ConfirmDialogProps = {
  title: string;
  description: ReactNode;
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
  confirmTone?: "danger" | "neutral";
};

/**
 * Shared Starlit Warmth confirmation. showModal() places this above an
 * existing dialog without moving the editor, changing scroll, or allowing
 * interaction with the underlying page.
 *
 * Cancelling via Escape, Android Back or tapping outside never confirms.
 * All destructive actions require the explicit confirm button.
 */
export function ConfirmDialog({
  title,
  description,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
  busy = false,
  confirmTone = "danger",
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    const previouslyFocused = document.activeElement;
    dialog?.showModal();
    cancelRef.current?.focus({ preventScroll: true });
    return () => {
      if (dialog?.open) dialog.close();
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, []);

  // Portalling inside the app retains its light/dark design tokens.
  const portalTarget = typeof document === "undefined"
    ? null
    : document.querySelector<HTMLElement>(".byeolharu") ?? document.body;
  if (!portalTarget) return null;

  return createPortal(
    <dialog
      ref={dialogRef}
      className="byeolharu-confirm-dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-busy={busy}
      onCancel={(event) => {
        // React portal events bubble through the logical parent Modal even
        // though the native dialogs are top-layer siblings. Stop propagation
        // or one Escape can close both the confirmation and its editor.
        event.preventDefault();
        event.stopPropagation();
        if (!busy) onCancel();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current && !busy) onCancel();
      }}
    >
      <div className="byeolharu-confirm-dialog-content">
        <div className="byeolharu-confirm-dialog-heading">
          <AlertCircle size={20} aria-hidden="true" />
          <h2 id={titleId}>{title}</h2>
        </div>
        <p id={descriptionId}>{description}</p>
        <div className="byeolharu-confirm-dialog-actions">
          <button
            ref={cancelRef}
            type="button"
            className="primary full"
            data-confirm-cancel
            disabled={busy}
            onClick={onCancel}
          >{cancelLabel}</button>
          <button
            type="button"
            className={"text-button full byeolharu-confirm-action" +
              (confirmTone === "neutral" ? " is-neutral" : "")}
            disabled={busy}
            onClick={onConfirm}
          >{busy ? "처리 중…" : confirmLabel}</button>
        </div>
      </div>
    </dialog>,
    portalTarget,
  );
}

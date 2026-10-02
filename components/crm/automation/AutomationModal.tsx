"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/** Centered dialog in the `.crm-modal` style, closed by Escape or a click on the overlay. */
export function AutomationModal({
  title,
  onClose,
  children,
  footer,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
  /** Wider dialog (flow editor) */
  wide?: boolean;
}) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return createPortal(
    <div className="crm-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`crm-modal auto-modal${wide ? " auto-modal--wide" : ""}`} role="dialog" aria-label={title}>
        <button type="button" className="crm-modal-close" onClick={onClose} aria-label="Fechar">
          <X size={20} />
        </button>
        <h2>{title}</h2>
        <div className="auto-modal__body">{children}</div>
        <div className="crm-modal-actions">{footer}</div>
      </div>
    </div>,
    document.body
  );
}

export function ModalRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="auto-modal__row">
      <span className="auto-modal__label">{label}</span>
      <div className="auto-modal__control">{children}</div>
    </div>
  );
}

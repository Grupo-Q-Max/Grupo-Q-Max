"use client";

import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./ui.css";

// Styled replacements for window.alert / confirm / prompt. Each call mounts a
// native <dialog> (focus trap, Esc, top layer for free) and resolves on close.

type DialogOptions = {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Paints the confirm button red (destructive actions). */
  danger?: boolean;
};

type Kind = "alert" | "confirm" | "prompt";
type Result = boolean | string | null | undefined;

const CANCEL: Record<Kind, Result> = { alert: undefined, confirm: false, prompt: null };

function open(kind: Kind, message: string, options: DialogOptions & { defaultValue?: string }) {
  return new Promise<Result>((resolve) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const done = (result: Result) => {
      resolve(result);
      // Unmount outside the React event that triggered it.
      setTimeout(() => {
        root.unmount();
        host.remove();
      });
    };
    root.render(<QDialog kind={kind} message={message} options={options} onDone={done} />);
  });
}

export const alertDialog = (message: string, options: DialogOptions = {}) =>
  open("alert", message, options) as Promise<void>;

export const confirmDialog = (message: string, options: DialogOptions = {}) =>
  open("confirm", message, options) as Promise<boolean>;

export const promptDialog = (message: string, options: DialogOptions & { defaultValue?: string } = {}) =>
  open("prompt", message, options) as Promise<string | null>;

function QDialog({
  kind,
  message,
  options,
  onDone,
}: {
  kind: Kind;
  message: string;
  options: DialogOptions & { defaultValue?: string };
  onDone: (result: Result) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState(options.defaultValue ?? "");
  const closed = useRef(false);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const finish = (result: Result) => {
    if (closed.current) return;
    closed.current = true;
    ref.current?.close();
    onDone(result);
  };
  const cancel = () => finish(CANCEL[kind]);

  return (
    <dialog
      ref={ref}
      className="qdialog"
      aria-label={options.title ?? message}
      onCancel={(e) => {
        e.preventDefault();
        cancel();
      }}
      // Keep Esc from also reaching document listeners (they close the panel behind).
      onKeyDown={(e) => e.key === "Escape" && e.stopPropagation()}
      onClick={(e) => e.target === e.currentTarget && cancel()}
    >
      <form
        className="qdialog__body"
        onSubmit={(e) => {
          e.preventDefault();
          finish(kind === "confirm" ? true : kind === "prompt" ? value : undefined);
        }}
      >
        {options.title && <h2 className="qdialog__title">{options.title}</h2>}
        <p className="qdialog__message">{message}</p>
        {kind === "prompt" && (
          <input className="qdialog__input" autoFocus value={value} onChange={(e) => setValue(e.target.value)} />
        )}
        <div className="qdialog__actions">
          {kind !== "alert" && (
            <button type="button" className="qdialog__btn" onClick={cancel}>
              {options.cancelLabel ?? "Cancelar"}
            </button>
          )}
          <button
            type="submit"
            autoFocus={kind !== "prompt"}
            className={`qdialog__btn qdialog__btn--primary${options.danger ? " qdialog__btn--danger" : ""}`}
          >
            {options.confirmLabel ?? (kind === "alert" ? "OK" : "Confirmar")}
          </button>
        </div>
      </form>
    </dialog>
  );
}

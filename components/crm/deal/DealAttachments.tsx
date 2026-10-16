"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Paperclip, Trash2, Upload } from "lucide-react";
import { useCan } from "../CrmAccess";
import { confirmDialog } from "@/components/ui/Dialogs";
import { formatDateTime } from "./ui";

type Attachment = { id: string; originalName: string; mimeType: string; size: number; createdAt: string; uploadedBy: { name: string } | null };

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip";

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;

/** "Anexos" tab of the deal panel: files of the card, downloaded through the access-checked route. */
export function DealAttachments({ dealId }: { dealId: string }) {
  const can = useCan();
  const input = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<Attachment[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/crm/attachment?cardId=${encodeURIComponent(dealId)}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : []))
      .then(setAttachments)
      .catch(() => {});
    return () => controller.abort();
  }, [dealId]);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    setUploading(true);
    for (const file of Array.from(files)) {
      const body = new FormData();
      body.set("cardId", dealId);
      body.set("file", file);
      const res = await fetch("/api/crm/attachment", { method: "POST", body });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(`${file.name}: ${data?.error ?? "não foi possível enviar."}`);
        continue;
      }
      setAttachments((list) => [data, ...(list ?? [])]);
    }
    setUploading(false);
    if (input.current) input.current.value = "";
  };

  const remove = async (attachment: Attachment) => {
    if (!(await confirmDialog(`Excluir o anexo "${attachment.originalName}"?`, { danger: true, confirmLabel: "Excluir" }))) return;
    const res = await fetch(`/api/crm/attachment?id=${attachment.id}`, { method: "DELETE" });
    if (res.ok) setAttachments((list) => list?.filter((a) => a.id !== attachment.id) ?? null);
  };

  return (
    <div className="deal-attachments">
      {can("deal.edit") && (
        <div
          className="deal-attachments__drop"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            upload(e.dataTransfer.files);
          }}
        >
          <Upload size={18} />
          <span>Arraste arquivos aqui ou</span>
          <button type="button" className="btn-secondary" disabled={uploading} onClick={() => input.current?.click()}>
            {uploading ? "Enviando..." : "Escolher arquivos"}
          </button>
          <span className="deal-field__hint">PDF, imagens, Office, CSV, TXT ou ZIP · até 8 MB</span>
          <input ref={input} type="file" multiple hidden accept={ACCEPT} onChange={(e) => upload(e.target.files)} />
        </div>
      )}
      {error && <p className="deal-savebar__error">{error}</p>}

      {attachments === null ? (
        <div className="crm-spinner" />
      ) : attachments.length === 0 ? (
        <p className="deal-empty">Nenhum anexo.</p>
      ) : (
        <ul className="deal-attachments__list">
          {attachments.map((a) => (
            <li key={a.id}>
              <Paperclip size={16} />
              <a href={`/api/crm/attachment/${a.id}`} className="deal-attachments__name">
                {a.originalName}
              </a>
              <span className="deal-field__hint">
                {formatSize(a.size)} · {a.uploadedBy?.name ?? "—"} · {formatDateTime(a.createdAt)}
              </span>
              <a href={`/api/crm/attachment/${a.id}`} className="deal-icon-btn" title="Baixar">
                <Download size={16} />
              </a>
              {can("deal.edit") && (
                <button type="button" className="deal-icon-btn deal-icon-btn--danger" title="Excluir anexo" onClick={() => remove(a)}>
                  <Trash2 size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

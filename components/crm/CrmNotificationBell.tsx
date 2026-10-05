"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { createPortal } from "react-dom";

type Notification = {
  id: string;
  message: string;
  readAt: string | null;
  createdAt: string;
  /** Set for deal notifications; `request` for improvement requests */
  card: { number: number; title: string } | null;
  request: { title: string } | null;
};

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Notification bell of the CRM sidebar: notifications of the signed-in member ("Adicionar notificação" rules). */
export function CrmNotificationBell() {
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/crm/notification", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setItems(data.items);
    setUnread(data.unread);
  }, []);

  useEffect(() => {
    load();
    const source = new EventSource("/api/crm/events?notifications=1");
    source.onmessage = () => load();
    return () => source.close();
  }, [load]);

  const markRead = (id?: string) => {
    fetch("/api/crm/notification", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
      keepalive: true,
    }).then(load);
  };

  return (
    <>
      <button
        type="button"
        className="crm-nav__item crm-bell"
        onClick={() => setOpen(!open)}
        aria-label={`Notificações${unread ? ` (${unread} não lidas)` : ""}`}
        title="Notificações"
      >
        <Bell size={18} />
        {unread > 0 && <span className="crm-bell__badge">{unread > 99 ? "99+" : unread}</span>}
      </button>

      {open &&
        createPortal(
        <div className="crm-bell__panel" role="dialog" aria-label="Notificações">
          <div className="crm-bell__head">
            <strong>Notificações</strong>
            {unread > 0 && (
              <button type="button" className="crm-bell__link" onClick={() => markRead()}>
                Marcar todas como lidas
              </button>
            )}
            <button type="button" className="crm-bell__close" onClick={() => setOpen(false)} aria-label="Fechar">
              <X size={16} />
            </button>
          </div>

          <div className="crm-bell__list">
            {items.length === 0 ? (
              <p className="crm-bell__empty">Nenhuma notificação.</p>
            ) : (
              items.map((n) => (
                <a
                  key={n.id}
                  href={n.card ? `/crm/deal/details/${n.card.number}` : "/crm/requests"}
                  className={`crm-bell__item ${n.readAt ? "" : "is-unread"}`}
                  onClick={() => !n.readAt && markRead(n.id)}
                >
                  <strong>{n.card?.title ?? n.request?.title}</strong>
                  <span>{n.message}</span>
                  <time>{formatWhen(n.createdAt)}</time>
                </a>
              ))
            )}
          </div>
        </div>,
          document.body
        )}
    </>
  );
}

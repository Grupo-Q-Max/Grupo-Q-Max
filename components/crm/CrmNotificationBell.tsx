"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { createPortal } from "react-dom";

type Notification = {
  id: string;
  message: string;
  readAt: string | null;
  createdAt: string;
  card: { number: number; title: string };
};

type Member = { id: string; name: string };

/** There is no login per member: each browser says who it is, and sees that member's notifications. */
const STORAGE_KEY = "qmax_crm_member";

const readStoredMember = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
};

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Notification bell of the CRM sidebar (notifications created by "Adicionar notificação" rules). */
export function CrmNotificationBell() {
  const [memberId, setMemberId] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setMemberId(readStoredMember());
    fetch("/api/team")
      .then((res) => (res.ok ? res.json() : []))
      .then((team: Member[]) => setMembers(team.map(({ id, name }) => ({ id, name }))))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    if (!memberId) return;
    const res = await fetch(`/api/crm/notification?memberId=${encodeURIComponent(memberId)}`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setItems(data.items);
    setUnread(data.unread);
  }, [memberId]);

  useEffect(() => {
    setItems([]);
    setUnread(0);
    if (!memberId) return;
    load();
    const source = new EventSource(`/api/crm/events?memberId=${encodeURIComponent(memberId)}`);
    source.onmessage = () => load();
    return () => source.close();
  }, [memberId, load]);

  const chooseMember = (id: string) => {
    setMemberId(id);
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // storage blocked: the choice lasts until the page reloads
    }
  };

  const markRead = (id?: string) => {
    fetch("/api/crm/notification", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, id }),
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
      >
        <Bell size={18} />
        Notificações
        {unread > 0 && <span className="crm-bell__badge">{unread > 99 ? "99+" : unread}</span>}
      </button>

      {open &&
        createPortal(
        <div className="crm-bell__panel" role="dialog" aria-label="Notificações">
          <div className="crm-bell__head">
            <select value={memberId} onChange={(e) => chooseMember(e.target.value)} aria-label="Quem é você">
              <option value="">Quem é você?</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
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
            {!memberId ? (
              <p className="crm-bell__empty">Escolha quem você é para ver suas notificações.</p>
            ) : items.length === 0 ? (
              <p className="crm-bell__empty">Nenhuma notificação.</p>
            ) : (
              items.map((n) => (
                <a
                  key={n.id}
                  href={`/crm/deal/details/${n.card.number}`}
                  className={`crm-bell__item ${n.readAt ? "" : "is-unread"}`}
                  onClick={() => !n.readAt && markRead(n.id)}
                >
                  <strong>{n.card.title}</strong>
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

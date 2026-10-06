"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Link2, Mail, Pencil, Phone, RotateCcw, Trash2, X } from "lucide-react";
import { DealGeneralForm, DealProductsEditor } from "./DealGeneralForm";
import { DealTimeline } from "./DealTimeline";
import { pickDraft, type DealDetails, type DealDraft, type TeamMember } from "./types";
import { formatDateOnly } from "./ui";
import { useCan } from "../CrmAccess";
import { confirmDialog } from "@/components/ui/Dialogs";

type Tab = "general" | "products" | "history";

type Props = {
  dealId: string;
  /** Called with the loaded deal (e.g. to show its number in the URL). */
  onLoad?: (deal: DealDetails) => void;
  onClose: () => void;
  /** Called after the deal is changed or deleted so the board can refresh. */
  onChanged: () => void;
};

const jsonRequest = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

/** Drops placeholder values the form adds (empty contact/company/product) so they don't count as changes. */
function normalizeDraft(draft: DealDraft): DealDraft {
  return {
    ...draft,
    contacts: draft.contacts.filter((c) => c.name.trim()),
    company: draft.company?.name.trim() ? draft.company : null,
    products: draft.products.filter((p) => p.name.trim()),
    dealType: draft.dealType || null,
    source: draft.source || null,
    sourceInfo: draft.sourceInfo || null,
    comment: draft.comment || null,
  };
}

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

function changedFields(draft: DealDraft, deal: DealDetails) {
  const original = normalizeDraft(pickDraft(deal));
  const current = normalizeDraft(draft);
  return (Object.keys(current) as (keyof DealDraft)[]).filter((key) => !sameValue(current[key], original[key]));
}

export function DealDetailsPanel({ dealId, onLoad, onClose, onChanged }: Props) {
  const can = useCan();
  const [deal, setDeal] = useState<DealDetails | null>(null);
  const [draft, setDraft] = useState<DealDraft | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [tab, setTab] = useState<Tab>("general");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [closeMenuOpen, setCloseMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  // The panel can be open on the first render (/crm/deal/details/<n>); portal only after hydration
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const dirtyFields = deal && draft ? changedFields(draft, deal) : [];
  const isDirty = dirtyFields.length > 0;
  const dirtyRef = useRef(isDirty);
  dirtyRef.current = isDirty;

  const load = useCallback(
    async (resetDraft: boolean) => {
      const res = await fetch(`/api/crm/card?id=${dealId}`, { cache: "no-store" });
      if (!res.ok) {
        setError(res.status === 404 ? "Este negócio não existe mais." : "Não foi possível carregar o negócio.");
        return;
      }
      const data: DealDetails = await res.json();
      setDeal(data);
      if (resetDraft) setDraft(pickDraft(data));
    },
    [dealId]
  );

  useEffect(() => {
    load(true);
    fetch("/api/team")
      .then((res) => (res.ok ? res.json() : []))
      .then(setTeam)
      .catch(() => setTeam([]));
  }, [load]);

  // Report the first load only (e.g. to fix the URL of a legacy ?deal= link)
  const onLoadRef = useRef(onLoad);
  onLoadRef.current = onLoad;
  const reportedRef = useRef(false);
  useEffect(() => {
    if (!deal || reportedRef.current) return;
    reportedRef.current = true;
    onLoadRef.current?.(deal);
  }, [deal]);

  // Realtime: reflect changes made by other users while the panel is open
  const pipelineId = deal?.pipeline.id;
  useEffect(() => {
    if (!pipelineId) return;
    const source = new EventSource(`/api/crm/events?pipelineId=${encodeURIComponent(pipelineId)}`);
    source.onmessage = () => load(!dirtyRef.current);
    return () => source.close();
  }, [pipelineId, load]);

  const requestClose = useCallback(async () => {
    if (dirtyRef.current && !(await confirmDialog("Existem alterações não salvas. Deseja descartá-las?", { danger: true, confirmLabel: "Descartar" }))) return;
    onClose();
  }, [onClose]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [requestClose]);

  const updateDraft = (changes: Partial<DealDraft>) => setDraft((d) => (d ? { ...d, ...changes } : d));

  /** Immediate change (stage, status) — keeps unsaved edits in the form. */
  const patch = async (changes: Record<string, unknown>) => {
    setError(null);
    const res = await fetch("/api/crm/card", jsonRequest("PATCH", { id: dealId, ...changes }));
    if (!res.ok) {
      setError((await res.json().catch(() => null))?.error ?? "Não foi possível salvar.");
      return;
    }
    setDeal(await res.json());
    onChanged();
  };

  const save = async () => {
    if (!deal || !draft) return;
    if (!draft.title.trim()) {
      setError("O nome do negócio é obrigatório.");
      return;
    }
    const missing = (deal.pipeline.fieldsConfig ?? []).find((f) => f.required && !draft.customData?.[f.id]);
    if (missing) {
      setError(`O campo ${missing.name} é obrigatório.`);
      return;
    }
    if (draft.contacts.some((c) => !c.name.trim() && Object.values(c).some((v) => typeof v === "string" && v.trim()))) {
      setError("Informe o nome do contato.");
      return;
    }
    if (draft.company && !draft.company.name.trim() && Object.values(draft.company).some((v) => typeof v === "string" && v.trim())) {
      setError("Informe o nome da empresa.");
      return;
    }

    const normalized = normalizeDraft(draft);
    const changes = Object.fromEntries(dirtyFields.map((key) => [key, normalized[key]]));

    setSaving(true);
    setError(null);
    const res = await fetch("/api/crm/card", jsonRequest("PATCH", { id: dealId, ...changes }));
    setSaving(false);
    if (!res.ok) {
      setError((await res.json().catch(() => null))?.error ?? "Não foi possível salvar.");
      return;
    }
    const updated: DealDetails = await res.json();
    setDeal(updated);
    setDraft(pickDraft(updated));
    setEditingTitle(false);
    onChanged();
  };

  const cancel = () => {
    if (deal) setDraft(pickDraft(deal));
    setEditingTitle(false);
    setError(null);
  };

  const remove = async () => {
    if (!(await confirmDialog("Certeza que deseja excluir este negócio?", { danger: true, confirmLabel: "Excluir" }))) return;
    const res = await fetch(`/api/crm/card?id=${dealId}`, { method: "DELETE" });
    if (!res.ok) return;
    onChanged();
    onClose();
  };

  const copyLink = async () => {
    if (!deal) return;
    const url = `${window.location.origin}/crm/deal/details/${deal.number}`;
    await navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const content = (
    <div
      className="deal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <aside className="deal-panel" role="dialog" aria-modal="true">
        <button type="button" className="deal-panel__close" title="Fechar (Esc)" onClick={requestClose}>
          <X size={20} />
        </button>

        {!deal || !draft ? (
          <div className="deal-panel__loading">
            {error ?? <div className="crm-spinner" />}
          </div>
        ) : (
          <>
            <header className="deal-header">
              <div className="deal-header__title">
                {editingTitle ? (
                  <input
                    autoFocus
                    className="deal-input deal-header__input"
                    value={draft.title}
                    onChange={(e) => updateDraft({ title: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") save();
                    }}
                  />
                ) : (
                  <h2 onDoubleClick={() => setEditingTitle(true)}>{draft.title}</h2>
                )}
                <button type="button" className="deal-icon-btn" title="Renomear" onClick={() => setEditingTitle(true)}>
                  <Pencil size={15} />
                </button>
                <button type="button" className="deal-icon-btn" title="Copiar link do negócio" onClick={copyLink}>
                  {copied ? <Check size={15} /> : <Link2 size={15} />}
                </button>
                <span className="deal-header__number">#{deal.number}</span>
                {deal.status !== "OPEN" && (
                  <span className={`deal-status deal-status--${deal.status.toLowerCase()}`}>
                    {deal.status === "WON" ? "Ganho" : "Perdido"}
                  </span>
                )}
              </div>

              <div className="deal-header__actions">
                <ContactActions deal={deal} />
                {can("deal.delete") && (
                  <button type="button" className="deal-icon-btn deal-icon-btn--boxed deal-icon-btn--danger" title="Excluir negócio" onClick={remove}>
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </header>

            <div className="deal-meta">
              Criado em {formatDateOnly(deal.createdAt)}
              {deal.closeDate && <> · Término previsto {formatDateOnly(deal.closeDate)}</>}
            </div>

            <StageBar
              deal={deal}
              menuOpen={closeMenuOpen}
              onToggleMenu={() => setCloseMenuOpen(!closeMenuOpen)}
              onStage={(stageId) => patch({ stageId, status: "OPEN" })}
              onStatus={(status) => {
                setCloseMenuOpen(false);
                patch({ status });
              }}
            />

            <nav className="deal-tabs">
              {(
                [
                  ["general", "Geral"],
                  ["products", `Serviços${deal.products.length ? ` (${deal.products.length})` : ""}`],
                  ["history", "Histórico"],
                ] as [Tab, string][]
              ).map(([value, label]) => (
                <button key={value} type="button" className={tab === value ? "is-active" : ""} onClick={() => setTab(value)}>
                  {label}
                </button>
              ))}
            </nav>

            <div className={`deal-body ${isDirty ? "has-savebar" : ""}`}>
              {tab === "general" && (
                <div className="deal-grid">
                  <DealGeneralForm
                    deal={deal}
                    draft={draft}
                    onChange={updateDraft}
                    team={team}
                    onStageChange={(stageId) => patch({ stageId })}
                    onOpenProducts={() => setTab("products")}
                  />
                  <DealTimeline deal={deal} team={team} onChanged={() => load(false)} />
                </div>
              )}
              {tab === "products" && <DealProductsEditor draft={draft} onChange={updateDraft} />}
              {tab === "history" && <DealHistoryTable deal={deal} />}
            </div>

            {(isDirty || error) && (
              <footer className="deal-savebar">
                {error && <span className="deal-savebar__error">{error}</span>}
                {isDirty && (
                  <>
                    <button type="button" className="btn-primary" disabled={saving} onClick={save}>
                      {saving ? "Salvando..." : "Salvar"}
                    </button>
                    <button type="button" className="btn-secondary" disabled={saving} onClick={cancel}>
                      Cancelar
                    </button>
                  </>
                )}
              </footer>
            )}
          </>
        )}
      </aside>
    </div>
  );

  return mounted ? createPortal(content, document.body) : null;
}

function ContactActions({ deal }: { deal: DealDetails }) {
  const contact = deal.contacts.find((c) => c.phone || c.email);
  const phone = contact?.phone || deal.company?.phone;
  const email = contact?.email || deal.company?.email;
  return (
    <>
      <a
        className={`deal-icon-btn deal-icon-btn--boxed ${phone ? "" : "is-disabled"}`}
        href={phone ? `tel:${phone}` : undefined}
        title={phone ? `Ligar para ${phone}` : "Nenhum telefone cadastrado"}
      >
        <Phone size={16} />
      </a>
      <a
        className={`deal-icon-btn deal-icon-btn--boxed ${email ? "" : "is-disabled"}`}
        href={email ? `mailto:${email}` : undefined}
        title={email ? `Enviar e-mail para ${email}` : "Nenhum e-mail cadastrado"}
      >
        <Mail size={16} />
      </a>
    </>
  );
}

function StageBar({
  deal,
  menuOpen,
  onToggleMenu,
  onStage,
  onStatus,
}: {
  deal: DealDetails;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onStage: (stageId: string) => void;
  onStatus: (status: DealDetails["status"]) => void;
}) {
  const currentIndex = deal.pipeline.stages.findIndex((s) => s.id === deal.stageId);
  const closedClass = deal.status === "WON" ? "is-won" : deal.status === "LOST" ? "is-lost" : "";

  return (
    <div className={`deal-stages ${closedClass}`}>
      {deal.pipeline.stages.map((stage, index) => (
        <button
          key={stage.id}
          type="button"
          title={stage.name}
          className={`deal-stage ${index <= currentIndex ? "is-passed" : ""} ${index === currentIndex ? "is-current" : ""}`}
          onClick={() => (stage.id !== deal.stageId || deal.status !== "OPEN") && onStage(stage.id)}
        >
          <span>{stage.name}</span>
        </button>
      ))}

      <div className="deal-stage-close">
        <button
          type="button"
          className={`deal-stage deal-stage--final ${deal.status !== "OPEN" ? "is-passed" : ""}`}
          onClick={onToggleMenu}
        >
          <span>{deal.status === "WON" ? "Negócio ganho" : deal.status === "LOST" ? "Negócio perdido" : "Fechar negócio"}</span>
        </button>
        {menuOpen && (
          <div className="deal-menu deal-menu--right">
            {deal.status !== "WON" && (
              <button type="button" className="deal-menu__won" onClick={() => onStatus("WON")}>
                <Check size={14} /> Negócio ganho
              </button>
            )}
            {deal.status !== "LOST" && (
              <button type="button" className="deal-menu__lost" onClick={() => onStatus("LOST")}>
                <X size={14} /> Negócio perdido
              </button>
            )}
            {deal.status !== "OPEN" && (
              <button type="button" onClick={() => onStatus("OPEN")}>
                <RotateCcw size={14} /> Reabrir negócio
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const HISTORY_LABELS: Record<string, string> = {
  CREATED: "Negócio criado",
  STAGE_CHANGED: "Etapa alterada",
  STATUS_CHANGED: "Status alterado",
  FIELD_CHANGED: "Campo alterado",
  RECURRENCE_CREATED: "Negócio recorrente criado",
};

const STATUS_LABELS: Record<string, string> = { OPEN: "Em andamento", WON: "Ganho", LOST: "Perdido" };

function DealHistoryTable({ deal }: { deal: DealDetails }) {
  const describe = (item: DealDetails["history"][number]) => {
    const data = item.data ?? {};
    switch (item.type) {
      case "CREATED":
      case "RECURRENCE_CREATED":
        return data.title ?? "";
      case "STAGE_CHANGED":
        return `${data.from} → ${data.to}`;
      case "STATUS_CHANGED":
        return `${STATUS_LABELS[data.from ?? ""] ?? data.from} → ${STATUS_LABELS[data.to ?? ""] ?? data.to}`;
      default: {
        const show = (v: string | null | undefined) => {
          if (!v) return "vazio";
          if (data.field === "startDate" || data.field === "closeDate") return formatDateOnly(v);
          return v;
        };
        return data.from || data.to ? `${data.label}: ${show(data.from)} → ${show(data.to)}` : `${data.label} alterado`;
      }
    }
  };

  return (
    <div className="deal-history">
      <table className="crm-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Evento</th>
            <th>Detalhes</th>
          </tr>
        </thead>
        <tbody>
          {deal.history.map((item) => (
            <tr key={item.id}>
              <td>{new Date(item.createdAt).toLocaleString("pt-BR")}</td>
              <td>{HISTORY_LABELS[item.type] ?? item.type}</td>
              <td>{describe(item)}</td>
            </tr>
          ))}
          {deal.history.length === 0 && (
            <tr>
              <td colSpan={3} className="deal-empty">
                Nenhuma alteração registrada.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

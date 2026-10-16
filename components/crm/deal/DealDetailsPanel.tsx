"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Archive, ArchiveRestore, BookmarkPlus, Check, Copy, Link2, Mail, Pencil, Phone, RotateCcw, Trash2, X } from "lucide-react";
import { DealGeneralForm, DealProductsEditor } from "./DealGeneralForm";
import { DealTimeline } from "./DealTimeline";
import { DealAttachments } from "./DealAttachments";
import { formatMoney, pickDraft, type DealDetails, type DealDraft, type TeamMember } from "./types";
import { formatDateOnly } from "./ui";
import { useCan } from "../CrmAccess";
import { sendStageMove } from "../stageEntry";
import { alertDialog, confirmDialog } from "@/components/ui/Dialogs";

type Tab = "general" | "products" | "files" | "history";

type Props = {
  dealId: string;
  /** Called with the loaded deal (e.g. to show its number in the URL). */
  onLoad?: (deal: DealDetails) => void;
  onClose: () => void;
  /** Called after the deal is changed or deleted so the board can refresh. */
  onChanged: () => void;
  /** Opens another card in the panel (e.g. the copy made by "Duplicar"). */
  onOpenCard: (card: { id: string; number: number }) => void;
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

export function DealDetailsPanel({ dealId, onLoad, onClose, onChanged, onOpenCard }: Props) {
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
    const lastStage = deal?.pipeline.stages.at(-1)?.id;
    if (isTasks && changes.stageId === lastStage && deal?.blockedBy.some((c) => c.status === "OPEN")) {
      if (!(await confirmDialog("Esta tarefa está bloqueada por outra que ainda não foi concluída. Concluir mesmo assim?", { confirmLabel: "Concluir" }))) return;
    }
    const send = (extra: Record<string, unknown> = {}) => fetch("/api/crm/card", jsonRequest("PATCH", { id: dealId, ...changes, ...extra }));
    // Stage moves follow the QXBACK stage rules (required services / lost reason)
    const res = "stageId" in changes ? await sendStageMove(send) : await send();
    if (!res) return;
    if (!res.ok) {
      setError((await res.json().catch(() => null))?.error ?? "Não foi possível salvar.");
      return;
    }
    const updated: DealDetails = await res.json();
    // The lost reason is saved in a custom field: refresh it in the form unless it has unsaved edits
    if (deal && !dirtyFields.includes("customData")) updateDraft({ customData: updated.customData });
    setDeal(updated);
    onChanged();
  };

  const save = async () => {
    if (!deal || !draft) return;
    if (!draft.title.trim()) {
      setError(deal.pipeline.kind === "TASKS" ? "O título da tarefa é obrigatório." : "O nome do negócio é obrigatório.");
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

  const restore = async (stageId: string) => {
    const confirmed = await confirmDialog(
      "As informações atuais do card serão substituídas pelos dados salvos quando ele estava nesta coluna." +
        (isDirty ? " As alterações não salvas serão descartadas." : "") +
        " Deseja continuar?",
      { title: "Restaurar informações?", confirmLabel: "Restaurar informações", danger: true }
    );
    if (!confirmed) return;
    setError(null);
    const res = await fetch("/api/crm/card", jsonRequest("PATCH", { id: dealId, restoreStageId: stageId }));
    if (!res.ok) {
      setError((await res.json().catch(() => null))?.error ?? "Não foi possível restaurar.");
      return;
    }
    const updated: DealDetails = await res.json();
    setDeal(updated);
    setDraft(pickDraft(updated));
    onChanged();
  };

  const remove = async () => {
    if (!(await confirmDialog("Certeza que deseja excluir este negócio?", { danger: true, confirmLabel: "Excluir" }))) return;
    const res = await fetch(`/api/crm/card?id=${dealId}`, { method: "DELETE" });
    if (!res.ok) return;
    onChanged();
    onClose();
  };

  const duplicate = async () => {
    if (isDirty && !(await confirmDialog("A cópia é feita do card salvo; as alterações não salvas ficam de fora. Continuar?", { confirmLabel: "Duplicar" }))) return;
    setError(null);
    const res = await fetch("/api/crm/card", jsonRequest("POST", { duplicateOf: dealId }));
    if (!res.ok) {
      setError((await res.json().catch(() => null))?.error ?? "Não foi possível duplicar.");
      return;
    }
    onChanged();
    onOpenCard(await res.json());
  };

  const saveAsTemplate = async () => {
    setError(null);
    const res = await fetch("/api/crm/card", jsonRequest("POST", { saveAsTemplate: dealId }));
    if (!res.ok) {
      setError((await res.json().catch(() => null))?.error ?? "Não foi possível salvar o modelo.");
      return;
    }
    alertDialog("Modelo salvo. Use-o em \"Nova Tarefa\".");
  };

  const copyLink = async () => {
    if (!deal) return;
    const url = `${window.location.origin}/crm/deal/details/${deal.number}`;
    await navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Task boards hide the sales parts (contact buttons, services, won/lost)
  const isTasks = deal?.pipeline.kind === "TASKS";

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
                {deal.archivedAt && <span className="deal-status">Arquivado</span>}
                {deal.isTemplate && <span className="deal-status">Modelo</span>}
                {deal.status !== "OPEN" && (
                  <span className={`deal-status deal-status--${deal.status.toLowerCase()}`}>
                    {deal.status === "WON" ? (isTasks ? "Concluída" : "Ganho") : "Perdido"}
                  </span>
                )}
              </div>

              <div className="deal-header__actions">
                {!isTasks && <ContactActions deal={deal} />}
                {isTasks && !deal.isTemplate && can("deal.create") && (
                  <button type="button" className="deal-icon-btn deal-icon-btn--boxed" title="Salvar como modelo" onClick={saveAsTemplate}>
                    <BookmarkPlus size={16} />
                  </button>
                )}
                {!deal.isTemplate && can("deal.create") && (
                  <button type="button" className="deal-icon-btn deal-icon-btn--boxed" title="Duplicar" onClick={duplicate}>
                    <Copy size={16} />
                  </button>
                )}
                {!deal.isTemplate && can("deal.edit") && (
                  <button
                    type="button"
                    className="deal-icon-btn deal-icon-btn--boxed"
                    title={deal.archivedAt ? "Restaurar do arquivo" : "Arquivar"}
                    onClick={() => patch({ archived: !deal.archivedAt })}
                  >
                    {deal.archivedAt ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                  </button>
                )}
                {can("deal.delete") && (
                  <button type="button" className="deal-icon-btn deal-icon-btn--boxed deal-icon-btn--danger" title={isTasks ? "Excluir tarefa" : "Excluir negócio"} onClick={remove}>
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </header>

            <div className="deal-meta">
              Criado em {formatDateOnly(deal.createdAt)}
              {deal.closeDate && <> · {isTasks ? "Prazo" : "Término previsto"} {formatDateOnly(deal.closeDate)}{deal.dueTime && ` às ${deal.dueTime}`}</>}
            </div>

            <StageBar
              deal={deal}
              closable={!isTasks}
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
                  ["files", "Anexos"],
                  ["history", "Histórico"],
                ] as [Tab, string][]
              ).filter(([value]) => !isTasks || value !== "products").map(([value, label]) => (
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
                    onReload={() => load(false)}
                    onOpenCard={onOpenCard}
                  />
                  <DealTimeline deal={deal} team={team} onChanged={() => load(false)} />
                </div>
              )}
              {tab === "products" && <DealProductsEditor draft={draft} onChange={updateDraft} />}
              {tab === "files" && <DealAttachments dealId={deal.id} />}
              {tab === "history" && (
                <>
                  <StageSnapshots deal={deal} onRestore={can("deal.edit") ? restore : undefined} />
                  <DealHistoryTable deal={deal} team={team} />
                </>
              )}
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
  closable,
  menuOpen,
  onToggleMenu,
  onStage,
  onStatus,
}: {
  deal: DealDetails;
  /** Shows the won/lost menu (sales boards only) */
  closable: boolean;
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

      {closable && <div className="deal-stage-close">
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
      </div>}
    </div>
  );
}

const HISTORY_LABELS: Record<string, string> = {
  CREATED: "Negócio criado",
  STAGE_CHANGED: "Etapa alterada",
  STATUS_CHANGED: "Status alterado",
  FIELD_CHANGED: "Campo alterado",
  RECURRENCE_CREATED: "Negócio recorrente criado",
  STATE_RESTORED: "Informações restauradas",
};

/** Restore points: the deal's state when it left each stage, in pipeline order. */
function StageSnapshots({ deal, onRestore }: { deal: DealDetails; onRestore?: (stageId: string) => void }) {
  const rows = deal.pipeline.stages.flatMap((stage) => {
    const snap = deal.stageSnapshots.find((s) => s.stageId === stage.id);
    return snap ? [{ stage, snap }] : [];
  });
  if (rows.length === 0) return null;

  return (
    <div className="deal-history deal-snapshots">
      <h3>Informações salvas por etapa</h3>
      <table className="crm-table">
        <thead>
          <tr>
            <th>Etapa</th>
            <th>Salvo em</th>
            <th>Valor</th>
            <th>Serviços</th>
            <th>Contato</th>
            {onRestore && <th />}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ stage, snap }) => (
            <tr key={stage.id}>
              <td>{stage.name}</td>
              <td>{new Date(snap.savedAt).toLocaleString("pt-BR")}</td>
              <td>{formatMoney(snap.data.value, snap.data.currency)}</td>
              <td>{snap.data.products.map((p) => p.name).join(", ") || "—"}</td>
              <td>{snap.data.contacts[0]?.name || "—"}</td>
              {onRestore && (
                <td>
                  <button type="button" className="btn-secondary" onClick={() => onRestore(stage.id)}>
                    <RotateCcw size={14} /> Restaurar informações
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = { OPEN: "Em andamento", WON: "Ganho", LOST: "Perdido" };

function DealHistoryTable({ deal, team }: { deal: DealDetails; team: TeamMember[] }) {
  const describe = (item: DealDetails["history"][number]) => {
    const data = item.data ?? {};
    switch (item.type) {
      case "CREATED":
      case "RECURRENCE_CREATED":
        return data.title ?? "";
      case "STAGE_CHANGED":
        return `${data.from} → ${data.to}`;
      case "STATE_RESTORED":
        return `Dados da etapa ${data.stage ?? ""}`.trim();
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
            <th>Por</th>
          </tr>
        </thead>
        <tbody>
          {deal.history.map((item) => (
            <tr key={item.id}>
              <td>{new Date(item.createdAt).toLocaleString("pt-BR")}</td>
              <td>{HISTORY_LABELS[item.type] ?? item.type}</td>
              <td>{describe(item)}</td>
              <td>{team.find((m) => m.id === item.actorId)?.name ?? "—"}</td>
            </tr>
          ))}
          {deal.history.length === 0 && (
            <tr>
              <td colSpan={4} className="deal-empty">
                Nenhuma alteração registrada.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

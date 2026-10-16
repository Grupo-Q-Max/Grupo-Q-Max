"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCan } from "./CrmAccess";
import { alertDialog, confirmDialog } from "@/components/ui/Dialogs";
import { Select } from "@/components/ui/Select";
import type { DuplicateDeal } from "@/lib/crm-deal";

/**
 * POST /api/crm/card. When an open deal already has the same title, company, seller
 * and value the API answers 409; the user confirms and the deal is created anyway.
 * Returns null when the user gives up.
 */
export async function postDeal(body: Record<string, unknown>): Promise<Response | null> {
  const send = (force?: boolean) =>
    fetch("/api/crm/card", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, force }),
    });
  const res = await send();
  if (res.status !== 409) return res;
  const { deals } = (await res.json()) as { deals: DuplicateDeal[] };
  const list = deals.map((d) => `#${d.number} ${d.title} (${d.stage})`).join("\n");
  const ok = await confirmDialog(
    `Já existe negócio aberto com mesmo nome, empresa, vendedor e valor:\n${list}\n\nCriar mesmo assim?`,
    { title: "Possível duplicado", confirmLabel: "Criar mesmo assim" }
  );
  return ok ? send(true) : null;
}

export function CrmButtons({
  pipeline,
  spaces,
  currentMemberId,
}: {
  pipeline?: any;
  spaces: { id: string; name: string }[];
  currentMemberId: string | null;
}) {
  const router = useRouter();
  const can = useCan();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDealModalOpen, setIsDealModalOpen] = useState(false);
  const isTasks = pipeline?.kind === "TASKS";

  const [pipelineName, setPipelineName] = useState("");
  const [pipelineKind, setPipelineKind] = useState<"DEALS" | "TASKS">("DEALS");
  // New pipelines start in the space of the one on screen
  const [pipelineSpace, setPipelineSpace] = useState<string>(pipeline?.spaceId ?? "");
  const [dealDeadline, setDealDeadline] = useState("");
  const [dealDescription, setDealDescription] = useState("");
  const [dealTitle, setDealTitle] = useState("");
  const [dealValue, setDealValue] = useState("");
  const [dealCompany, setDealCompany] = useState("");
  const [customData, setCustomData] = useState<any>({});
  const [dealResponsible, setDealResponsible] = useState(currentMemberId ?? "");
  const [team, setTeam] = useState<{ id: string; name: string; role: string }[]>([]);
  // Task boards: templates saved from a card ("Salvar como modelo"); "" = blank task
  const [templates, setTemplates] = useState<{ id: string; number: number; title: string }[]>([]);
  const [templateId, setTemplateId] = useState("");

  const [isLoading, setIsLoading] = useState(false);

  const handleCreatePipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pipelineName.trim()) return;
    
    setIsLoading(true);
    const res = await fetch('/api/crm/pipeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: pipelineName, kind: pipelineKind, spaceId: pipelineSpace })
    });

    if (res.ok) {
      const created = await res.json();
      setIsModalOpen(false);
      setPipelineName("");
      router.push(`/crm?pipelineId=${created.id}`);
      // The sidebar lives in the layout, which a search-param navigation keeps: refresh it too
      router.refresh();
    }
    setIsLoading(false);
  };

  const handleCreateDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dealTitle.trim() || !pipeline?.stages?.[0]) return;
    
    // Validate required custom fields
    // A template brings its own custom field values
    if (!templateId && pipeline.fieldsConfig && Array.isArray(pipeline.fieldsConfig)) {
      for (let field of pipeline.fieldsConfig) {
        if (field.required && !customData[field.id]) {
          alertDialog(`O campo ${field.name} é obrigatório.`);
          return;
        }
      }
    }

    setIsLoading(true);
    const res = templateId
      ? await fetch("/api/crm/card", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fromTemplate: templateId, title: dealTitle, closeDate: dealDeadline || null, responsibleId: dealResponsible || null }),
        })
      : await postDeal({
      title: dealTitle,
      company: dealCompany,
      value: Number(dealValue) || 0,
      stageId: pipeline.stages[0].id,
      responsibleId: dealResponsible || null,
      customData,
      ...(isTasks && { closeDate: dealDeadline || null, comment: dealDescription }),
    });

    if (res?.ok) {
      setIsDealModalOpen(false);
      setDealTitle("");
      setDealCompany("");
      setDealValue("");
      setDealDeadline("");
      setDealDescription("");
      setCustomData({});
      setTemplateId("");
      setDealResponsible(currentMemberId ?? "");
      router.refresh();
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (!isDealModalOpen || !isTasks) return;
    const controller = new AbortController();
    fetch(`/api/crm/card?templatesOf=${pipeline.id}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : []))
      .then(setTemplates)
      .catch(() => {});
    return () => controller.abort();
  }, [isDealModalOpen, isTasks, pipeline?.id]);

  const deleteTemplate = async () => {
    const template = templates.find((t) => t.id === templateId);
    if (!template || !(await confirmDialog(`Excluir o modelo "${template.title}"?`, { danger: true, confirmLabel: "Excluir" }))) return;
    const res = await fetch(`/api/crm/card?id=${template.id}`, { method: "DELETE" });
    if (!res.ok) return alertDialog("Não foi possível excluir o modelo.");
    setTemplates((list) => list.filter((t) => t.id !== template.id));
    setTemplateId("");
  };

  useEffect(() => {
    if (!isDealModalOpen || team.length) return;
    fetch("/api/team")
      .then((res) => (res.ok ? res.json() : []))
      .then(setTeam)
      .catch(() => setTeam([]));
  }, [isDealModalOpen, team.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsModalOpen(false);
        setIsDealModalOpen(false);
      }
    };
    if (isModalOpen || isDealModalOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isModalOpen, isDealModalOpen]);

  const modalContent = isModalOpen ? (
    <div 
      className="crm-modal-overlay" 
      onClick={(e) => {
        if (e.target === e.currentTarget) setIsModalOpen(false);
      }}
    >
      <div className="crm-modal">
        <button className="crm-modal-close" onClick={() => setIsModalOpen(false)}>
          <X size={20} />
        </button>
        <h2>Criar Novo Pipeline</h2>
        <p>O pipeline será criado com as fases padrão do tipo escolhido.</p>
        <form onSubmit={handleCreatePipeline}>
          <div className="crm-modal-group">
            <label>Nome do Pipeline</label>
            <input
              type="text"
              autoFocus
              placeholder={pipelineKind === "TASKS" ? "Ex: Sprint Tecnologia" : "Ex: Vendas B2B"}
              value={pipelineName}
              onChange={e => setPipelineName(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div className="crm-modal-group" style={{ flex: 1 }}>
              <label>Tipo</label>
              <Select value={pipelineKind} onChange={(e) => setPipelineKind(e.target.value as "DEALS" | "TASKS")} disabled={isLoading} aria-label="Tipo">
                <option value="DEALS">Negócios</option>
                <option value="TASKS">Tarefas</option>
              </Select>
            </div>
            <div className="crm-modal-group" style={{ flex: 1 }}>
              <label>Espaço</label>
              <Select value={pipelineSpace} onChange={(e) => setPipelineSpace(e.target.value)} disabled={isLoading} aria-label="Espaço">
                <option value="">Geral</option>
                {spaces.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="crm-modal-actions">
            <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)} disabled={isLoading}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={isLoading || !pipelineName.trim()}>
              {isLoading ? "Criando..." : "Criar Pipeline"}
            </button>
          </div>
        </form>
      </div>
    </div>
  ) : null;

  const dealModalContent = isDealModalOpen ? (
    <div 
      className="crm-modal-overlay" 
      onClick={(e) => {
        if (e.target === e.currentTarget) setIsDealModalOpen(false);
      }}
    >
      <div className="crm-modal" style={{ maxWidth: '500px' }}>
        <button className="crm-modal-close" onClick={() => setIsDealModalOpen(false)}>
          <X size={20} />
        </button>
        <h2>{isTasks ? "Nova Tarefa" : "Novo Negócio"}</h2>
        <p>{isTasks ? "A tarefa entra na primeira coluna." : "Preencha os detalhes do negócio para adicioná-lo à fase inicial."}</p>

        <form onSubmit={handleCreateDeal} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {isTasks && templates.length > 0 && (
            <div className="crm-modal-group" style={{ marginBottom: 0 }}>
              <label>Modelo</label>
              <div className="crm-template-pick">
                <Select
                  value={templateId}
                  disabled={isLoading}
                  aria-label="Modelo"
                  onChange={(e) => {
                    setTemplateId(e.target.value);
                    setDealTitle(templates.find((t) => t.id === e.target.value)?.title ?? "");
                  }}
                >
                  <option value="">Tarefa em branco</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </Select>
                {templateId && (
                  <>
                    <a
                      className="deal-icon-btn"
                      title="Editar modelo"
                      href={`/crm/deal/details/${templates.find((t) => t.id === templateId)?.number}`}
                    >
                      <Pencil size={16} />
                    </a>
                    {can("deal.delete") && (
                      <button type="button" className="deal-icon-btn deal-icon-btn--danger" title="Excluir modelo" onClick={deleteTemplate}>
                        <Trash2 size={16} />
                      </button>
                    )}
                  </>
                )}
              </div>
              {templateId && <small className="crm-modal-hint">Descrição, etiquetas, prioridade e checklist vêm do modelo.</small>}
            </div>
          )}

          <div className="crm-modal-group" style={{ marginBottom: 0 }}>
            <label>{isTasks ? "Título da Tarefa *" : "Título do Negócio *"}</label>
            <input
              type="text"
              autoFocus
              required
              placeholder={isTasks ? "Ex: Revisar contrato do cliente" : "Ex: Auditoria TechCorp"}
              value={dealTitle}
              onChange={e => setDealTitle(e.target.value)}
              disabled={isLoading}
            />
          </div>

          {isTasks ? (
            <>
              <div className="crm-modal-group" style={{ marginBottom: 0 }}>
                <label>Prazo</label>
                <input type="date" value={dealDeadline} onChange={(e) => setDealDeadline(e.target.value)} disabled={isLoading} />
              </div>
              {!templateId && <div className="crm-modal-group" style={{ marginBottom: 0 }}>
                <label>Descrição</label>
                <textarea rows={3} value={dealDescription} onChange={(e) => setDealDescription(e.target.value)} disabled={isLoading} />
              </div>}
            </>
          ) : (
          <div style={{ display: 'flex', gap: '16px' }}>
            <div className="crm-modal-group" style={{ flex: 1, marginBottom: 0 }}>
              <label>Empresa</label>
              <input 
                type="text" 
                placeholder="Ex: TechCorp" 
                value={dealCompany}
                onChange={e => setDealCompany(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="crm-modal-group" style={{ flex: 1, marginBottom: 0 }}>
              <label>Valor Previsto (R$)</label>
              <input 
                type="number"
                step="0.01" 
                placeholder="Ex: 50000.00" 
                value={dealValue}
                onChange={e => setDealValue(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>
          )}

          <div className="crm-modal-group" style={{ marginBottom: 0 }}>
            <label>{isTasks ? "Responsável" : "Vendedor"}</label>
            <Select value={dealResponsible} onChange={(e) => setDealResponsible(e.target.value)} disabled={isLoading} aria-label={isTasks ? "Responsável" : "Vendedor"}>
              <option value="">{isTasks ? "Sem responsável" : "Sem vendedor"}</option>
              {team.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name} — {member.role}
                </option>
              ))}
            </Select>
          </div>

          {/* DYNAMIC CUSTOM FIELDS */}
          {pipeline?.fieldsConfig && Array.isArray(pipeline.fieldsConfig) && pipeline.fieldsConfig.length > 0 && (
            <div style={{ marginTop: '8px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <h4 style={{ color: '#fff', marginBottom: '16px', fontSize: '14px' }}>Informações Adicionais</h4>
              {pipeline.fieldsConfig.map((field: any) => (
                <div className="crm-modal-group" key={field.id} style={{ marginBottom: '12px' }}>
                  <label>{field.name} {field.required && '*'}</label>
                  <input 
                    type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                    placeholder={`Digite ${field.name.toLowerCase()}...`}
                    required={field.required}
                    value={customData[field.id] || ""}
                    onChange={e => setCustomData({...customData, [field.id]: e.target.value})}
                    disabled={isLoading}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="crm-modal-actions" style={{ marginTop: '16px' }}>
            <button type="button" className="btn-secondary" onClick={() => setIsDealModalOpen(false)} disabled={isLoading}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={isLoading || !dealTitle.trim()}>
              {isLoading ? "Criando..." : isTasks ? "Criar Tarefa" : "Criar Negócio"}
            </button>
          </div>
        </form>
      </div>
    </div>
  ) : null;

  return (
    <>
      <div className="crm-header__actions">
        {can("pipeline.create") && (
          <button className="btn-secondary" onClick={() => setIsModalOpen(true)}>
            Criar Pipeline
          </button>
        )}
        {can("deal.create") && (
          <button className="btn-primary" data-shortcut="new-card" title="Atalho: N" onClick={() => {
            if (!pipeline) {
              alertDialog("Crie um pipeline primeiro.");
              return;
            }
            setIsDealModalOpen(true);
          }}>
            <Plus size={18} />
            {isTasks ? "Nova Tarefa" : "Novo Negócio"}
          </button>
        )}
      </div>
      
      {isModalOpen && typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null}
      {isDealModalOpen && typeof document !== 'undefined' ? createPortal(dealModalContent, document.body) : null}
    </>
  );
}

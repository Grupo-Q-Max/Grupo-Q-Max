"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Plus, X } from "lucide-react";
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

export function CrmButtons({ pipeline, currentMemberId }: { pipeline?: any; currentMemberId: string | null }) {
  const router = useRouter();
  const can = useCan();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDealModalOpen, setIsDealModalOpen] = useState(false);
  
  const [pipelineName, setPipelineName] = useState("");
  const [dealTitle, setDealTitle] = useState("");
  const [dealValue, setDealValue] = useState("");
  const [dealCompany, setDealCompany] = useState("");
  const [customData, setCustomData] = useState<any>({});
  const [dealResponsible, setDealResponsible] = useState(currentMemberId ?? "");
  const [team, setTeam] = useState<{ id: string; name: string; role: string }[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);

  const handleCreatePipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pipelineName.trim()) return;
    
    setIsLoading(true);
    const res = await fetch('/api/crm/pipeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: pipelineName })
    });
    
    if (res.ok) {
      const created = await res.json();
      setIsModalOpen(false);
      setPipelineName("");
      router.push(`/crm?pipelineId=${created.id}`);
    }
    setIsLoading(false);
  };

  const handleCreateDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dealTitle.trim() || !pipeline?.stages?.[0]) return;
    
    // Validate required custom fields
    if (pipeline.fieldsConfig && Array.isArray(pipeline.fieldsConfig)) {
      for (let field of pipeline.fieldsConfig) {
        if (field.required && !customData[field.id]) {
          alertDialog(`O campo ${field.name} é obrigatório.`);
          return;
        }
      }
    }

    setIsLoading(true);
    const res = await postDeal({
      title: dealTitle,
      company: dealCompany,
      value: Number(dealValue) || 0,
      stageId: pipeline.stages[0].id,
      responsibleId: dealResponsible || null,
      customData,
    });

    if (res?.ok) {
      setIsDealModalOpen(false);
      setDealTitle("");
      setDealCompany("");
      setDealValue("");
      setCustomData({});
      setDealResponsible(currentMemberId ?? "");
      router.refresh();
    }
    setIsLoading(false);
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
        <p>O pipeline será criado com as fases padrão do Q-Max.</p>
        <form onSubmit={handleCreatePipeline}>
          <div className="crm-modal-group">
            <label>Nome do Pipeline</label>
            <input 
              type="text" 
              autoFocus
              placeholder="Ex: Vendas B2B" 
              value={pipelineName}
              onChange={e => setPipelineName(e.target.value)}
              disabled={isLoading}
            />
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
        <h2>Novo Negócio</h2>
        <p>Preencha os detalhes do negócio para adicioná-lo à fase inicial.</p>
        
        <form onSubmit={handleCreateDeal} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div className="crm-modal-group" style={{ marginBottom: 0 }}>
            <label>Título do Negócio *</label>
            <input 
              type="text" 
              autoFocus
              required
              placeholder="Ex: Auditoria TechCorp" 
              value={dealTitle}
              onChange={e => setDealTitle(e.target.value)}
              disabled={isLoading}
            />
          </div>

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

          <div className="crm-modal-group" style={{ marginBottom: 0 }}>
            <label>Vendedor</label>
            <Select value={dealResponsible} onChange={(e) => setDealResponsible(e.target.value)} disabled={isLoading} aria-label="Vendedor">
              <option value="">Sem vendedor</option>
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
              {isLoading ? "Criando..." : "Criar Negócio"}
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
          <button className="btn-primary" onClick={() => {
            if (!pipeline) {
              alertDialog("Crie um pipeline primeiro.");
              return;
            }
            setIsDealModalOpen(true);
          }}>
            <Plus size={18} />
            Novo Negócio
          </button>
        )}
      </div>
      
      {isModalOpen && typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null}
      {isDealModalOpen && typeof document !== 'undefined' ? createPortal(dealModalContent, document.body) : null}
    </>
  );
}

"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Settings, X, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function CrmPipelineSettings({ pipeline }: { pipeline: any }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const parseFields = (config: any) => {
    if (!config) return [];
    if (Array.isArray(config)) return config;
    if (typeof config === 'string') {
      try { return JSON.parse(config); } catch (e) { return []; }
    }
    return [];
  };

  const [fields, setFields] = useState<any[]>(parseFields(pipeline.fieldsConfig));
  const [pipelineName, setPipelineName] = useState(pipeline.name || "");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setFields(parseFields(pipeline.fieldsConfig));
    setPipelineName(pipeline.name || "");
  }, [pipeline.fieldsConfig, pipeline.name]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen]);

  const addField = () => {
    setFields([
      ...fields, 
      { id: Math.random().toString(36).substring(7), name: "", type: "text", required: false }
    ]);
  };

  const updateField = (id: string, key: string, value: any) => {
    setFields(fields.map(f => f.id === id ? { ...f, [key]: value } : f));
  };

  const removeField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
  };

  const handleSave = async () => {
    // Validate empty names
    if (fields.some(f => !f.name.trim())) {
      alert("Por favor, preencha o nome de todos os campos.");
      return;
    }

    setIsLoading(true);
    const res = await fetch('/api/crm/pipeline/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: pipeline.id, fieldsConfig: fields, name: pipelineName })
    });

    if (res.ok) {
      setIsOpen(false);
      router.refresh();
    }
    setIsLoading(false);
  };

  const modalContent = isOpen ? (
    <div className="crm-modal-overlay" onClick={(e) => {
      if (e.target === e.currentTarget) setIsOpen(false);
    }}>
      <div className="crm-modal" style={{ maxWidth: '600px' }}>
        <button className="crm-modal-close" onClick={() => setIsOpen(false)}>
          <X size={20} />
        </button>
        <h2>Configurações do Pipeline</h2>
        <p>Defina o nome do pipeline e os campos personalizados.</p>

        <div className="crm-modal-group" style={{ marginTop: '24px' }}>
          <label>Nome do Pipeline</label>
          <input 
            type="text" 
            value={pipelineName}
            onChange={(e) => setPipelineName(e.target.value)}
            style={{ width: '100%', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', color: '#fff', borderRadius: '4px' }}
          />
        </div>
        
        <h4 style={{ color: '#fff', marginBottom: '16px', marginTop: '24px' }}>Campos Dinâmicos dos Cards</h4>
        <div className="crm-fields-config">
          {fields.map((field, index) => (
            <div key={field.id} style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px', background: '#1a1a1c', padding: '12px', borderRadius: '8px' }}>
              <input 
                type="text" 
                placeholder="Nome do Campo (ex: CNPJ)" 
                value={field.name}
                onChange={(e) => updateField(field.id, "name", e.target.value)}
                style={{ flex: 1, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', padding: '8px', color: '#fff', borderRadius: '4px' }}
              />
              <select 
                value={field.type}
                onChange={(e) => updateField(field.id, "type", e.target.value)}
                style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', padding: '8px', color: '#fff', borderRadius: '4px' }}
              >
                <option value="text">Texto</option>
                <option value="number">Número / Moeda</option>
                <option value="phone">Telefone</option>
                <option value="date">Data</option>
              </select>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#a5a0aa', fontSize: '13px' }}>
                <input 
                  type="checkbox" 
                  checked={field.required}
                  onChange={(e) => updateField(field.id, "required", e.target.checked)}
                />
                Obrigatório
              </label>
              <button 
                onClick={() => removeField(field.id)}
                style={{ background: 'transparent', border: 'none', color: '#ff4d4d', cursor: 'pointer', padding: '4px' }}
                title="Remover campo"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
          {fields.length === 0 && (
            <div style={{ color: '#a5a0aa', fontSize: '14px', marginBottom: '16px', fontStyle: 'italic' }}>
              Nenhum campo personalizado configurado.
            </div>
          )}
          
          <button 
            type="button" 
            className="btn-secondary" 
            onClick={addField}
            style={{ width: '100%', marginBottom: '24px', display: 'flex', justifyContent: 'center', gap: '8px' }}
          >
            <Plus size={16} /> Adicionar Novo Campo
          </button>
        </div>

        <div className="crm-modal-actions">
          <button className="btn-secondary" onClick={() => setIsOpen(false)} disabled={isLoading}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={handleSave} disabled={isLoading}>
            {isLoading ? "Salvando..." : "Salvar Configurações"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button 
        className="btn-secondary" 
        onClick={() => setIsOpen(true)}
        style={{ padding: '8px', display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', borderColor: 'rgba(255,255,255,0.1)' }}
        title="Configurar Campos"
      >
        <Settings size={18} />
      </button>
      
      {isOpen && typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null}
    </>
  );
}

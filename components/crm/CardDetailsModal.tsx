"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Send, Calendar as CalendarIcon, MessageSquare, CheckSquare, Briefcase } from "lucide-react";

export function CardDetailsModal({ cardId, onClose, pipeline }: { cardId: string, onClose: () => void, pipeline: any }) {
  const [card, setCard] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Activity state
  const [activityType, setActivityType] = useState<"COMMENT" | "TASK" | "MEETING">("COMMENT");
  const [activityText, setActivityText] = useState("");
  const [activityDate, setActivityDate] = useState("");
  
  // Custom data state
  const [customData, setCustomData] = useState<any>({});

  useEffect(() => {
    // Fetch detailed card with activities and products
    fetch(`/api/crm/card/details?id=${cardId}`)
      .then(res => res.json())
      .then(data => {
        setCard(data);
        setCustomData(data.customData || {});
        setIsLoading(false);
      });
  }, [cardId]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  if (isLoading) return null;

  const handleUpdateField = async (field: string, value: any, isCustom: boolean = false) => {
    // Optimistic UI update
    if (isCustom) {
      setCustomData({ ...customData, [field]: value });
    } else {
      setCard({ ...card, [field]: value });
    }

    const payload = isCustom 
      ? { id: cardId, customData: { ...customData, [field]: value } }
      : { id: cardId, [field]: value };
      
    await fetch('/api/crm/card', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  };

  const handlePostActivity = async () => {
    if (!activityText.trim()) return;
    
    const payload = {
      cardId,
      type: activityType,
      content: activityText,
      dueDate: activityType !== "COMMENT" && activityDate ? new Date(activityDate).toISOString() : null
    };

    const res = await fetch('/api/crm/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const newActivity = await res.json();
      setCard({ ...card, activities: [newActivity, ...(card.activities || [])] });
      setActivityText("");
      setActivityDate("");
    }
  };

  const modalContent = (
    <div className="crm-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()} style={{ zIndex: 9999999 }}>
      <div className="crm-card-details-panel">
        <button className="crm-card-details-close" onClick={onClose}><X size={24} /></button>
        
        {/* HEADER */}
        <div className="crm-card-details-header">
          <h2>{card.title}</h2>
          <div className="crm-badge">{card.stage?.name}</div>
        </div>

        <div className="crm-card-details-body">
          {/* LEFT COLUMN: Data Fields */}
          <div className="crm-card-details-left">
            <div className="crm-card-section">
              <h3>Sobre o Negócio</h3>
              <div className="crm-card-field">
                <label>Valor Previsto (R$)</label>
                <input 
                  type="number" 
                  value={card.value} 
                  onChange={(e) => handleUpdateField("value", Number(e.target.value))} 
                />
              </div>
              <div className="crm-card-field">
                <label>Empresa Vinculada</label>
                <input 
                  type="text" 
                  value={card.company || ""} 
                  onChange={(e) => handleUpdateField("company", e.target.value)} 
                />
              </div>
            </div>

            {/* DYNAMIC PIPELINE FIELDS */}
            {pipeline?.fieldsConfig && pipeline.fieldsConfig.length > 0 && (
              <div className="crm-card-section">
                <h3>Informações Adicionais</h3>
                {pipeline.fieldsConfig.map((field: any) => (
                  <div className="crm-card-field" key={field.id}>
                    <label>{field.name} {field.required && "*"}</label>
                    <input 
                      type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
                      value={customData[field.id] || ""}
                      onChange={(e) => handleUpdateField(field.id, e.target.value, true)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Activities & Timeline */}
          <div className="crm-card-details-right">
            
            {/* ACTIVITY CREATOR */}
            <div className="crm-activity-creator">
              <div className="crm-activity-tabs">
                <button className={activityType === "COMMENT" ? "active" : ""} onClick={() => setActivityType("COMMENT")}>
                  <MessageSquare size={14} /> Comentário
                </button>
                <button className={activityType === "TASK" ? "active" : ""} onClick={() => setActivityType("TASK")}>
                  <CheckSquare size={14} /> Tarefa
                </button>
                <button className={activityType === "MEETING" ? "active" : ""} onClick={() => setActivityType("MEETING")}>
                  <CalendarIcon size={14} /> Agendamento
                </button>
              </div>
              <div className="crm-activity-input-box">
                <textarea 
                  placeholder={activityType === "COMMENT" ? "Digite um comentário..." : "Descreva a atividade..."}
                  value={activityText}
                  onChange={(e) => setActivityText(e.target.value)}
                />
                <div className="crm-activity-footer">
                  {activityType !== "COMMENT" && (
                    <input 
                      type="datetime-local" 
                      value={activityDate} 
                      onChange={(e) => setActivityDate(e.target.value)}
                      className="crm-activity-date" 
                    />
                  )}
                  <button className="btn-primary" onClick={handlePostActivity} disabled={!activityText.trim()}>
                    <Send size={16} /> Salvar
                  </button>
                </div>
              </div>
            </div>

            {/* TIMELINE */}
            <div className="crm-activity-timeline">
              {card.activities?.map((act: any) => (
                <div className="crm-timeline-node" key={act.id}>
                  <div className="crm-timeline-dot" data-type={act.type}>
                    {act.type === "COMMENT" && <MessageSquare size={12} />}
                    {act.type === "TASK" && <CheckSquare size={12} />}
                    {act.type === "MEETING" && <CalendarIcon size={12} />}
                    {act.type === "SYSTEM" && <Briefcase size={12} />}
                  </div>
                  <div className="crm-timeline-card">
                    <div className="crm-timeline-meta">
                      <strong>{act.type === "SYSTEM" ? "Sistema" : "Você"}</strong> 
                      <span>{new Date(act.createdAt).toLocaleString('pt-BR')}</span>
                    </div>
                    <div className="crm-timeline-text">{act.content}</div>
                    {act.dueDate && (
                      <div className="crm-timeline-due">
                        Prazo: {new Date(act.dueDate).toLocaleString('pt-BR')}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modalContent, document.body);
}

"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Building2, Check, ShieldCheck, Sparkles, Stethoscope, Users2, X, Zap } from "lucide-react";
import { QmaxInline } from "@/components/QmaxBrandText";

const companies = [
  { id: "contabil", name: "Q-Max Contábil", category: "Contabilidade & BPO", icon: Building2, color: "#14d0c1" },
  { id: "auditoria", name: "Q-Max Auditoria", category: "Auditoria & Compliance", icon: ShieldCheck, color: "#f22b22" },
  { id: "finora", name: "FINORA", category: "Clínicas Odontológicas", icon: Stethoscope, color: "#a45cff" },
  { id: "talents", name: "Q-Max Talents", category: "Pessoas & RH", icon: Users2, color: "#8f3aa8" },
  { id: "technology", name: "Q-Max Technology", category: "Tech & Indicação", icon: Zap, color: "#3156ff" },
  { id: "lagerhaus", name: "Lagerhaus", category: "Endereço & Coworking", icon: Building2, color: "#ff8b2a" },
];

export function QuickLeadModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(companies[0]);
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener("open-qmax-modal", handleOpen);
    return () => window.removeEventListener("open-qmax-modal", handleOpen);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNumber = whatsapp.replace(/\D/g, "");
    const text = encodeURIComponent(
      `Olá! Meu nome é ${name || "Visitante"}${companyName ? ` (Empresa: ${companyName})` : ""}. Gostaria de solicitar um diagnóstico com a unidade ${selectedCompany.name} (${selectedCompany.category}).`
    );
    window.open(`https://wa.me/5511912957356?text=${text}`, "_blank");
    setIsOpen(false);
  };

  return (
    <div className="qmax-modal-backdrop" onClick={() => setIsOpen(false)}>
      <div
        className="qmax-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <button
          type="button"
          className="qmax-modal-close"
          onClick={() => setIsOpen(false)}
          aria-label="Fechar modal"
        >
          <X size={20} />
        </button>

        <header className="qmax-modal-header">
          <span className="eyebrow">
            <Sparkles size={13} />
            DIAGNÓSTICO PERSONALIZADO
          </span>
          <h3 id="modal-title">
            Fale com o especialista certo do Grupo <QmaxInline>Q-Max</QmaxInline>
          </h3>
          <p>
            Selecione a empresa de interesse e inicie a conversa direta com o time responsável.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="qmax-modal-form">
          <label className="qmax-modal-label">01 / SELECIONE O SERVIÇO OU EMPRESA</label>
          <div className="qmax-modal-companies">
            {companies.map((comp) => {
              const Icon = comp.icon;
              const isSelected = selectedCompany.id === comp.id;
              return (
                <button
                  type="button"
                  key={comp.id}
                  className={`qmax-modal-companyBtn ${isSelected ? "selected" : ""}`}
                  style={{
                    borderColor: isSelected ? comp.color : undefined,
                    boxShadow: isSelected ? `0 0 20px ${comp.color}30` : undefined,
                  }}
                  onClick={() => setSelectedCompany(comp)}
                >
                  <div
                    className="qmax-modal-companyIcon"
                    style={{ color: comp.color, background: `${comp.color}15` }}
                  >
                    <Icon size={16} />
                  </div>
                  <div className="qmax-modal-companyInfo">
                    <strong>{comp.name}</strong>
                    <small>{comp.category}</small>
                  </div>
                  {isSelected && <Check size={16} style={{ color: comp.color, marginLeft: "auto" }} />}
                </button>
              );
            })}
          </div>

          <label className="qmax-modal-label">02 / SEUS DADOS PARA CONTATO</label>
          <div className="qmax-modal-fields">
            <input
              type="text"
              placeholder="Seu nome completo"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="qmax-modal-input"
            />
            <input
              type="text"
              placeholder="Nome da sua empresa (opcional)"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="qmax-modal-input"
            />
          </div>

          <button type="submit" className="qmax-modal-submit">
            <span>Iniciar Conversa no WhatsApp</span>
            <ArrowRight size={17} />
          </button>
        </form>
      </div>
    </div>
  );
}

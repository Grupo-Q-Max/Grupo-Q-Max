"use client";

import { useEffect, useRef, useState } from "react";
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
  const [selectedCompany, setSelectedCompany] = useState(() => {
    if (typeof window !== "undefined") {
      const p = window.location.pathname.toLowerCase();
      const match = companies.find((comp) => p.includes(comp.id));
      if (match) return match;
    }
    return companies[0];
  });
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  // Quem abriu o modal, para devolver o foco ao fechar (guardado na
  // abertura: o autoFocus do campo de nome muda o foco antes dos efeitos)
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const handleOpen = (e: Event) => {
      openerRef.current = document.activeElement as HTMLElement | null;
      const customEvent = e as CustomEvent<{ company?: string; unit?: string }>;
      const requested = customEvent.detail?.company || customEvent.detail?.unit;

      const currentPath = typeof window !== "undefined" ? window.location.pathname.toLowerCase() : "";
      const targetSlug =
        requested ||
        (currentPath.includes("auditoria")
          ? "auditoria"
          : currentPath.includes("contabil")
          ? "contabil"
          : currentPath.includes("talents")
          ? "talents"
          : currentPath.includes("technology")
          ? "technology"
          : currentPath.includes("lagerhaus")
          ? "lagerhaus"
          : null);

      if (targetSlug) {
        const found = companies.find(
          (comp) => comp.id === targetSlug.toLowerCase() || comp.name.toLowerCase().includes(targetSlug.toLowerCase())
        );
        if (found) {
          setSelectedCompany(found);
        }
      }

      setIsOpen(true);
    };
    window.addEventListener("open-qmax-modal", handleOpen);
    return () => window.removeEventListener("open-qmax-modal", handleOpen);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const opener = openerRef.current;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
      opener?.focus?.();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // LGPD: nothing leaves the browser without the visitor's explicit consent
    if (!consent || name.trim().length < 2) return;
    const text = encodeURIComponent(
      `Olá! Meu nome é ${name.trim()}${companyName ? ` (Empresa: ${companyName})` : ""}. Gostaria de solicitar um diagnóstico com a unidade ${selectedCompany.name} (${selectedCompany.category}).`
    );

    // Abre o WhatsApp antes de salvar: depois de um await lento o navegador
    // já não considera a abertura parte do clique e bloqueia como pop-up
    window.open(`https://wa.me/551128976514?text=${text}`, "_blank");

    // Salvar o Lead no Banco de Dados (keepalive: conclui mesmo se a aba mudar)
    fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        name: name.trim(),
        phone,
        consent: true,
        company: companyName,
        message: `Deseja diagnóstico com ${selectedCompany.name}`,
      }),
    }).catch((error) => {
      console.error("Failed to save lead:", error);
    });

    setIsOpen(false);
    setConsent(false);
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
              name="name"
              autoComplete="name"
              aria-label="Seu nome completo"
              autoFocus
              placeholder="Seu nome completo"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="qmax-modal-input"
            />
            <input
              type="text"
              name="company"
              autoComplete="organization"
              aria-label="Nome da sua empresa (opcional)"
              placeholder="Nome da sua empresa (opcional)"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="qmax-modal-input"
            />
            <input
              type="tel"
              name="phone"
              autoComplete="tel"
              inputMode="tel"
              maxLength={40}
              aria-label="Telefone ou WhatsApp (opcional)"
              placeholder="Telefone ou WhatsApp (opcional)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="qmax-modal-input"
            />
          </div>

          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 14, fontSize: "0.8rem", lineHeight: 1.45, color: "#c4c0c8", cursor: "pointer" }}>
            <input
              type="checkbox"
              name="consent"
              required
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              style={{ marginTop: 3, accentColor: "var(--qmax-magenta, #d90f81)" }}
            />
            <span>
              Li a{" "}
              <a href="/politica-de-privacidade" target="_blank" rel="noopener" style={{ color: "inherit", textDecoration: "underline" }}>Política de Privacidade</a>{" "}
              e autorizo o Grupo <QmaxInline>Q-Max</QmaxInline> a usar meu nome, empresa e telefone para responder a esta
              solicitação. A conversa continua no WhatsApp (Meta).
            </span>
          </label>

          <button
            type="submit"
            className="qmax-modal-submit"
            disabled={!consent}
            style={{ opacity: consent ? 1 : 0.55, cursor: consent ? "pointer" : "not-allowed" }}
          >
            <span>Iniciar Conversa no WhatsApp</span>
            <ArrowRight size={17} />
          </button>

          <p style={{ marginTop: 14, fontSize: "0.74rem", color: "#71717a", textAlign: "center", lineHeight: 1.45 }}>
            Você pode pedir acesso, correção ou exclusão dos seus dados pelo e-mail{" "}
            <a href="mailto:dpo@grupoqmax.com.br" style={{ color: "inherit", textDecoration: "underline" }}>dpo@grupoqmax.com.br</a>.
            Veja também os{" "}
            <a href="/termos-de-uso" target="_blank" rel="noopener" style={{ color: "inherit", textDecoration: "underline" }}>Termos de Uso</a>.
          </p>
        </form>
      </div>
    </div>
  );
}

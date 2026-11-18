"use client";

import { useSettings } from "@/components/SettingsProvider";
import { legal } from "@/data/site";

const socials = [
  { label: "Facebook", href: "https://www.facebook.com/grupoqmax/" },
  { label: "Instagram", href: "https://www.instagram.com/finora_gestao/" },
  { label: "LinkedIn", href: "https://www.linkedin.com/company/grupoqmaxoficial" },
];

export function FinoraFooter() {
  const settings = useSettings();
  const whatsappDigits = settings.whatsapp.replace(/\D/g, "");

  return (
    <footer className="fnr-footer">
      <div className="fnr-footer__top">
        <div className="fnr-footer__logo">
          <img src="/finora/footer-logo-sprite.png" alt="FINORA" />
        </div>

        <div className="fnr-footer__info">
          <p>
            Um produto <strong>Q-MAX</strong>
          </p>
          <p>
            WhatsApp/Tel:{" "}
            <a href={`https://wa.me/${whatsappDigits}`} target="_blank" rel="noopener noreferrer">
              {settings.whatsapp}
            </a>
          </p>
          <p>
            Email: <a href={`mailto:${settings.email}`}>{settings.email}</a>
          </p>
        </div>

        <div className="fnr-footer__social">
          <strong>Nos acompanhe</strong>
          {/* Os três ícones vêm numa imagem só (Figma); cada link cobre um terço dela. */}
          <div className="fnr-footer__socialIcons">
            <img src="/finora/socials.png" alt="" width={156} height={44} />
            {socials.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.label}
              />
            ))}
          </div>
        </div>
      </div>

      <img src="/finora/footer-line.svg" alt="" className="fnr-footer__line" aria-hidden />

      <p className="fnr-footer__copy">
        Copyright © 2026 Grupo Q-Max | Desenvolvido por <strong>Q-Max Technology</strong>
      </p>
      <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 8, fontSize: "0.8rem", color: "#a1a1aa" }}>
        <a href="/termos-de-uso" style={{ color: "#a1a1aa", textDecoration: "none" }}>Termos de Uso</a>
        <span>·</span>
        <a href="/politica-de-privacidade" style={{ color: "#a1a1aa", textDecoration: "none" }}>Privacidade (LGPD)</a>
        <span>·</span>
        <a href="/politica-de-cookies" style={{ color: "#a1a1aa", textDecoration: "none" }}>Cookies</a>
        <span>·</span>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("open-cookie-preferences"))}
          style={{ background: "none", border: 0, padding: 0, color: "#a1a1aa", font: "inherit", cursor: "pointer" }}
        >
          Preferências de Cookies
        </button>
      </div>
      <p style={{ textAlign: "center", marginTop: 8, fontSize: "0.75rem", color: "#71717a" }}>
        {legal.companies[legal.mainCompanyIndex].legalName} · CNPJ {legal.companies[legal.mainCompanyIndex].cnpj} · DPO:{" "}
        <a href={`mailto:${legal.dpoEmail}`} style={{ color: "inherit" }}>{legal.dpoEmail}</a>
      </p>
    </footer>
  );
}

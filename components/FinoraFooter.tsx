"use client";

import { useSettings } from "@/components/SettingsProvider";

const socials = [
  { label: "Facebook", href: "https://www.facebook.com/grupoqmax/" },
  { label: "Instagram", href: "https://www.instagram.com/finora_gestao/" },
  { label: "LinkedIn", href: "https://www.linkedin.com/company/grupoqmaxoficial" },
];

export function FinoraFooter() {
  const settings = useSettings();
  const whatsappDigits = settings.whatsapp.replace(/\D/g, "");
  const phoneDigits = settings.phone.replace(/\D/g, "");

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
            Tel: <a href={`tel:+${phoneDigits}`}>{settings.phone}</a>
          </p>
          <p>
            Email: <a href={`mailto:${settings.email}`}>{settings.email}</a>
          </p>
          <p>
            WhatsApp:{" "}
            <a href={`https://wa.me/${whatsappDigits}`} target="_blank" rel="noopener noreferrer">
              {settings.whatsapp}
            </a>
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
    </footer>
  );
}

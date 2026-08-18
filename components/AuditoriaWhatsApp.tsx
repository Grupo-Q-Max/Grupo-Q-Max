"use client";

import { MessageCircle } from "lucide-react";

const WHATSAPP_URL =
  "https://wa.me/551128976514?text=Olá%2C%20vim%20pelo%20site%20da%20Q-Max%20Auditoria%20e%20gostaria%20de%20falar%20com%20o%20time.";

export function AuditoriaWhatsApp() {
  function handleClick() {
    window.dispatchEvent(
      new CustomEvent("qmax:analytics", {
        detail: {
          event: "qmax_interaction",
          action: "qmax_whatsapp_click",
          source: "auditoria_floating_whatsapp",
          destination: "whatsapp",
        },
      })
    );
  }

  return (
    <a
      className="audit67__whatsapp"
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar com a Q-Max Auditoria pelo WhatsApp"
      onClick={handleClick}
    >
      <span className="audit67__whatsappPulse" aria-hidden="true" />

      <span className="audit67__whatsappIcon">
        <MessageCircle size={21} strokeWidth={1.8} />
      </span>

      <span className="audit67__whatsappCopy">
        <small>
          <i aria-hidden="true" />
          ATENDIMENTO
        </small>

        <strong>Fale com nosso time</strong>
      </span>

      <span className="audit67__whatsappArrow" aria-hidden="true">
        ↗
      </span>
    </a>
  );
}

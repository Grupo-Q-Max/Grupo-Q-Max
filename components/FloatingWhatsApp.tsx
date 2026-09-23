"use client";

import { MessageCircle } from "lucide-react";

const WHATSAPP_URL =
  "https://wa.me/551128976514?text=Olá%2C%20estou%20no%20site%20do%20Grupo%20Q-Max%20e%20gostaria%20de%20conversar.";

export function FloatingWhatsApp() {
  function handleClick() {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("qmax:analytics", {
          detail: {
            event: "qmax_interaction",
            action: "qmax_whatsapp_click",
            source: "global_floating_whatsapp",
            destination: "whatsapp",
          },
        })
      );
    }
  }

  return (
    <aside aria-label="Atendimento via WhatsApp">
      <a
        className="qmax-floating-whatsapp"
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Falar com o Grupo Q-Max pelo WhatsApp"
        onClick={handleClick}
      >
        <span className="qmax-floating-whatsapp__pulse" aria-hidden="true" />

        <span className="qmax-floating-whatsapp__icon">
          <MessageCircle size={22} strokeWidth={1.8} />
        </span>

        <span className="qmax-floating-whatsapp__copy">
          <small>
            <i aria-hidden="true" />
            ONLINE
          </small>
          <strong>Fale no WhatsApp</strong>
        </span>

        <span className="qmax-floating-whatsapp__arrow" aria-hidden="true">
          ↗
        </span>
      </a>
    </aside>
  );
}

"use client";

import { useEffect } from "react";
import { hasConsent } from "@/lib/consent";

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;

    gtag?: (
      command: "event" | "config" | "js",
      targetOrEvent: string | Date,
      params?: Record<string, unknown>
    ) => void;
  }
}

type QmaxEvent = {
  event: "qmax_interaction";
  interaction_type: string;
  interaction_label: string;
  interaction_location: string;
  destination?: string;
};

function cleanText(value: string | null | undefined) {
  return (value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function sendBusinessEvent(data: QmaxEvent) {
  if (typeof window.gtag !== "function") return;

  const commonParams = {
    interaction_label:
      data.interaction_label,

    interaction_location:
      data.interaction_location,

    destination:
      data.destination,

    event_category:
      "engagement",
  };

  switch (data.interaction_type) {
    case "cta_contato":
      window.gtag(
        "event",
        "qmax_contact_click",
        commonParams
      );
      break;

    case "telefone":
      window.gtag(
        "event",
        "qmax_phone_click",
        commonParams
      );
      break;

    case "email":
      window.gtag(
        "event",
        "qmax_email_click",
        commonParams
      );
      break;

    case "mapa":
      window.gtag(
        "event",
        "qmax_map_open",
        commonParams
      );
      break;

    case "produto":
      window.gtag(
        "event",
        "qmax_product_interest",
        commonParams
      );
      break;

    case "empresa":
      window.gtag(
        "event",
        "qmax_company_interest",
        commonParams
      );
      break;

    case "faq":
      window.gtag(
        "event",
        "qmax_faq_interaction",
        commonParams
      );
      break;
  }
}
function sendEvent(data: QmaxEvent) {
  window.dataLayer = window.dataLayer || [];

  window.dataLayer.push(data);

  if (typeof window.gtag === "function") {
    window.gtag(
      "event",
      "qmax_interaction",
      {
        interaction_type:
          data.interaction_type,

        interaction_label:
          data.interaction_label,

        interaction_location:
          data.interaction_location,

        destination:
          data.destination,

        event_category:
          "engagement",

        event_label:
          data.interaction_label,
      }
    );
  }

  sendBusinessEvent(data);

  window.dispatchEvent(
    new CustomEvent("qmax:analytics", {
      detail: data,
    })
  );

  if (process.env.NODE_ENV === "development") {
  }
}

function getLocation(element: Element) {
  if (element.closest(".nav15")) return "header";

  if (element.closest("#empresas")) return "empresas";

  if (element.closest("#produtos")) return "produtos";

  if (element.closest(".faq43")) return "faq";

  if (element.closest("#contato")) return "contato";

  if (element.closest("footer")) return "footer";

  return "site";
}

function classifyLink(anchor: HTMLAnchorElement) {
  const href = anchor.getAttribute("href") || "";
  const label = cleanText(anchor.textContent);
  const location = getLocation(anchor);

  if (href.startsWith("tel:")) {
    return {
      type: "telefone",
      label,
      location,
    };
  }

  if (href.startsWith("mailto:")) {
    return {
      type: "email",
      label,
      location,
    };
  }

  if (
    href.includes("google.com/maps") ||
    href.includes("maps.google")
  ) {
    return {
      type: "mapa",
      label: label || "Google Maps",
      location,
    };
  }

  if (href === "#empresas") {
    return {
      type: "empresa",
      label,
      location,
    };
  }

  if (href === "#produtos") {
    return {
      type: "produto",
      label,
      location,
    };
  }

  if (href === "#contato") {
    return {
      type: "cta_contato",
      label,
      location,
    };
  }

  if (href.startsWith("#")) {
    return {
      type: "navegacao",
      label,
      location,
    };
  }

  if (
    href.startsWith("http://") ||
    href.startsWith("https://")
  ) {
    return {
      type: "link_externo",
      label,
      location,
    };
  }

  return {
    type: "link",
    label,
    location,
  };
}

export function QmaxAnalytics() {
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      // Click statistics are part of the "Estatísticas" consent
      if (!hasConsent("analytics")) return;
      const target = event.target;

      if (!(target instanceof Element)) return;

      const anchor =
        target.closest<HTMLAnchorElement>("a");

      if (anchor) {
        const result = classifyLink(anchor);

        sendEvent({
          event: "qmax_interaction",
          interaction_type: result.type,
          interaction_label:
            result.label || "sem_label",
          interaction_location:
            result.location,
          // Without query string: links such as wa.me?text= or mailto:?body= may carry personal data
          destination:
            (anchor.getAttribute("href") || "").split("?")[0] || undefined,
        });

        return;
      }

      const button =
        target.closest<HTMLButtonElement>("button");

      if (!button) return;

      const label = cleanText(
        button.getAttribute("aria-label") ||
          button.textContent
      );

      const location = getLocation(button);

      let type = "botao";

      if (button.closest(".faq43")) {
        type = "faq";
      } else if (button.closest("#empresas")) {
        type = "empresa";
      } else if (button.closest("#produtos")) {
        type = "produto";
      } else if (
        button.classList.contains(
          "nav15__mobileTrigger"
        )
      ) {
        type = "menu_mobile";
      }

      sendEvent({
        event: "qmax_interaction",
        interaction_type: type,
        interaction_label:
          label || "sem_label",
        interaction_location: location,
      });
    }

    document.addEventListener(
      "click",
      handleClick,
      true
    );

    return () => {
      document.removeEventListener(
        "click",
        handleClick,
        true
      );
    };
  }, []);

  return null;
}
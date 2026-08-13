"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
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

function sendEvent(data: QmaxEvent) {
  window.dataLayer = window.dataLayer || [];

  window.dataLayer.push(data);

  window.dispatchEvent(
    new CustomEvent("qmax:analytics", {
      detail: data,
    })
  );

  if (process.env.NODE_ENV === "development") {
    console.info("[QMAX analytics]", data);
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
          destination:
            anchor.getAttribute("href") || undefined,
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
/**
 * Utilitário para geração de links e mensagens inteligentes de WhatsApp para o CRM Q-Max.
 */

export function buildWhatsAppMessage(
  contactName?: string | null,
  source?: string | null,
  customData?: Record<string, any> | null
): string {
  let firstName = "";
  if (contactName) {
    const parts = contactName.trim().split(/\s+/);
    if (parts.length > 1 && /^(dr|dra|sr|sra|prof)\.?$/i.test(parts[0])) {
      firstName = `${parts[0]} ${parts[1]}`;
    } else {
      firstName = parts[0];
    }
  }
  const greeting = firstName ? `Olá ${firstName}, tudo bem?` : "Olá, tudo bem?";

  const s = (source || "").toLowerCase();
  const prize = customData?.prizeName;

  if (s.includes("evento") || s.includes("invictus") || s.includes("finora")) {
    if (prize) {
      return `${greeting} Sou da equipe do Grupo Q-Max / Finora! Parabéns por ganhar o brinde "${prize}" em nosso estande no Invictus Experience. Gostaria de dar continuidade à nossa conversa, como podemos te ajudar?`;
    }
    return `${greeting} Sou da equipe do Grupo Q-Max / Finora! Foi um prazer recebê-lo em nosso estande no Invictus Experience. Gostaria de dar continuidade ao seu atendimento, como podemos te ajudar?`;
  }

  if (s.includes("quiz")) {
    return `${greeting} Sou da equipe do Grupo Q-Max! Vi que você realizou nosso Diagnóstico Empresarial. Gostaria de conversar sobre os resultados e como podemos apoiar sua empresa.`;
  }

  if (s.includes("site") || s.includes("institucional") || s.includes("contato")) {
    return `${greeting} Sou da equipe do Grupo Q-Max! Recebemos sua solicitação através de nosso site institucional. Em que posso te ajudar hoje?`;
  }

  return `${greeting} Sou da equipe do Grupo Q-Max! Gostaria de conversar com você sobre as soluções para sua empresa.`;
}

export function formatWhatsAppUrl(
  phone: string | null | undefined,
  contactName?: string | null,
  source?: string | null,
  customData?: Record<string, any> | null
): string | null {
  if (!phone) return null;
  const clean = phone.replace(/\D/g, "");
  if (!clean || clean.length < 8) return null;
  const intl = clean.startsWith("55") ? clean : `55${clean}`;
  const message = buildWhatsAppMessage(contactName, source, customData);
  return `https://wa.me/${intl}?text=${encodeURIComponent(message)}`;
}

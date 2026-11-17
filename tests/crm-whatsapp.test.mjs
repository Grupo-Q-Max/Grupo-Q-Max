import test from "node:test";
import assert from "node:assert/strict";
import { buildWhatsAppMessage, formatWhatsAppUrl } from "../lib/crm-whatsapp.ts";

test("buildWhatsAppMessage: generates custom messages for Eventos, Quiz and Site", () => {
  // 1. Evento com prêmio e título honorífico (Dr.)
  const eventPrizeMsg = buildWhatsAppMessage("Dr. Roberto Silva", "Evento: Finora Experience", {
    prizeName: "Caneca Térmica",
  });
  assert.match(eventPrizeMsg, /Olá Dr\. Roberto/);
  assert.match(eventPrizeMsg, /Caneca Térmica/);
  assert.match(eventPrizeMsg, /Invictus Experience/);

  // 2. Evento sem prêmio
  const eventMsg = buildWhatsAppMessage("Dra. Paula", "Evento: Invictus", null);
  assert.match(eventMsg, /Olá Dra\. Paula/);
  assert.match(eventMsg, /estande no Invictus Experience/);

  // 3. Quiz
  const quizMsg = buildWhatsAppMessage("Carlos Mendes", "Q-Max Quiz", null);
  assert.match(quizMsg, /Olá Carlos/);
  assert.match(quizMsg, /Diagnóstico Empresarial/);

  // 4. Site institucional
  const siteMsg = buildWhatsAppMessage("Fernanda Lima", "Site: Formulário de Contato", null);
  assert.match(siteMsg, /Olá Fernanda/);
  assert.match(siteMsg, /site institucional/);

  // 5. Default
  const defaultMsg = buildWhatsAppMessage(null, null, null);
  assert.match(defaultMsg, /Olá, tudo bem\?/);
});

test("formatWhatsAppUrl: creates valid international WhatsApp URLs with encoded messages", () => {
  // Número com DDD brasileiro
  const url1 = formatWhatsAppUrl("(11) 98765-4321", "Lucas", "Evento: Invictus", {
    prizeName: "Ecobag",
  });
  assert.ok(url1);
  assert.ok(url1.startsWith("https://wa.me/5511987654321?text="));
  assert.ok(url1.includes("Ecobag"));

  // Número já com DDI 55
  const url2 = formatWhatsAppUrl("5511999998888", "Julia", "Quiz");
  assert.ok(url2);
  assert.ok(url2.startsWith("https://wa.me/5511999998888?text="));

  // Número inválido ou nulo retorna null
  assert.equal(formatWhatsAppUrl(null), null);
  assert.equal(formatWhatsAppUrl("123"), null);
});

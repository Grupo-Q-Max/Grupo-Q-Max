require("./exigir-env-test");
const axios = require("axios");
const db = require("../config/db");
const followUpService = require("../services/followUpService");
const BASE_URL = process.env.BASE_URL || "http://localhost:3005";
const webhookHeaders = { headers: { "X-Webhook-Secret": process.env.WEBHOOK_SECRET || "" } };

async function testSuiteAutomacoes() {
  console.log("==========================================================================");
  console.log("🤖 INICIANDO TESTE DA SUÍTE DE HIPERAUTOMAÇÃO COMERCIAL (360°)");
  console.log("==========================================================================");

  let leadId = null;
  let propostaId = null;

  try {
    // 1. Testar Webhook Universal de Entrada de Leads (Simulando Meta Ads / Instagram)
    console.log("📡 [Teste 1/3] Disparando Webhook de Lead Inbound (Meta Ads / Instagram)...");
    const payloadMetaAds = {
      origem: "Instagram Ads - Campanha Fator R Odonto",
      nome: "Dr. Gustavo Ferraz",
      clinica: "Instituto Ferraz de Odontologia",
      email: `dr.gustavo.${Date.now()}@institutoferraz.com`,
      telefone: "11977778888",
      cnpj: "33.444.555/0001-66",
      faturamento: 95000,
      cadeiras: 3,
      cargo: "Responsável Técnico"
    };

    const webhookRes = await axios.post(`${BASE_URL}/api/webhooks/leads`, payloadMetaAds, webhookHeaders);
    if (!webhookRes.data.success) {
      throw new Error("Erro ao processar webhook de lead.");
    }

    leadId = webhookRes.data.lead_id;
    propostaId = webhookRes.data.proposta_id;
    const linkCurto = webhookRes.data.link;

    console.log(`✔ Webhook processado com sucesso!`);
    console.log(`   - Lead ID criado: ${leadId}`);
    console.log(`   - Proposta ID gerada: ${propostaId}`);
    console.log(`   - Vendedor atribuído via Round-Robin: ${webhookRes.data.vendedor_atribuido}`);
    console.log(`   - Link Curto gerado: ${linkCurto}`);

    // 2. Testar Motor Autônomo de Follow-up
    console.log("\n⏰ [Teste 2/3] Executando varredura do Motor de Follow-up Inteligente...");
    const followUpRes = await followUpService.processarReguaFollowUp();
    console.log(`✔ Motor de Follow-up executado com sucesso! Propostas analisadas: ${followUpRes.totalAnalisadas}, Disparos: ${followUpRes.disparosRealizados}`);

    // 3. Testar Webhook de Onboarding Operacional Pós-Venda
    console.log("\n📦 [Teste 3/3] Disparando Webhook de Onboarding Operacional Pós-Assinatura...");
    const onboardingRes = await axios.post(`${BASE_URL}/api/webhooks/onboarding/notificar`, {
      proposta_id: propostaId
    }, webhookHeaders);

    if (!onboardingRes.data.success) {
      throw new Error("Erro ao disparar webhook de onboarding.");
    }
    console.log(`✔ Webhook de onboarding disparado com sucesso!`);
    console.log(`   - Evento: ${onboardingRes.data.onboarding.evento}`);
    console.log(`   - Clínica: ${onboardingRes.data.onboarding.clinica}`);
    console.log(`   - Valor Mensal: R$ ${onboardingRes.data.onboarding.valor_mensal}`);

    console.log("\n==========================================================================");
    console.log("🎉 TODOS OS TESTES DA SUÍTE DE HIPERAUTOMAÇÃO PASSARAM COM SUCESSO!");
    console.log("==========================================================================");
  } catch (error) {
    console.error("❌ ERRO NA SUÍTE DE HIPERAUTOMAÇÃO:", error.response?.data || error.message);
    throw error;
  } finally {
    console.log("🧹 Limpando dados de teste...");
    if (propostaId) {
      await db.execute("DELETE FROM proposta_followups WHERE proposta_id = ?", [propostaId]).catch(() => {});
      await db.execute("DELETE FROM propostas WHERE id = ?", [propostaId]).catch(() => {});
    }
    if (leadId) {
      await db.execute("DELETE FROM lead_comentarios WHERE lead_id = ?", [leadId]).catch(() => {});
      await db.execute("DELETE FROM leads WHERE id = ?", [leadId]).catch(() => {});
    }
    console.log("✔ Limpeza de teste concluída!");
    process.exit(0);
  }
}

testSuiteAutomacoes();

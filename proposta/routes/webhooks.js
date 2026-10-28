const express = require("express");
const router = express.Router();
const db = require("../config/db");
const crypto = require("crypto");
const notificationService = require("../services/notificationService");
const whatsappService = require("../services/whatsappService");
const teamsService = require("../services/teamsService");
const { linkCurto: gerarLinkCurto, proximoNumeroProposta } = require("../services/proposalHelpers");

// Webhooks externos exigem WEBHOOK_SECRET (header X-Webhook-Secret ou ?secret=). Sem env configurada, bloqueia tudo.
function exigirSegredoWebhook(req, res, next) {
  const esperado = Buffer.from(process.env.WEBHOOK_SECRET || "");
  const recebido = Buffer.from(String(req.get("x-webhook-secret") || req.query.secret || ""));
  if (!esperado.length || recebido.length !== esperado.length || !crypto.timingSafeEqual(recebido, esperado)) {
    return res.status(401).json({ error: "Webhook não autorizado." });
  }
  next();
}
router.use("/api/webhooks", exigirSegredoWebhook);

/**
 * 🌐 WEBHOOK UNIVERSAL DE ENTRADA DE LEADS (META ADS, GOOGLE ADS, TYPEFORM, RD STATION, ZAPIER/N8N)
 * Endpoint: POST /api/webhooks/leads
 */
router.post("/api/webhooks/leads", async (req, res, next) => {
  // Dentro do try: falha ao pegar conexão vira erro tratado, não promise rejeitada sem resposta
  let connection;
  try {
    connection = await db.getConnection();
    const payload = req.body || {};

    // Extração flexível de dados para qualquer formato de payload de formulário
    const nomeCliente = payload.nome || payload.nome_cliente || payload.name || payload.full_name || payload.contact_name || "Lead Sem Nome";
    const nomeClinica = payload.clinica || payload.nome_clinica || payload.company || payload.empresa || payload.clinic_name || `Clínica ${nomeCliente}`;
    const email = payload.email || payload.contact_email || payload.mail || "";
    const telefone = payload.telefone || payload.phone || payload.whatsapp || payload.celular || "";
    const cnpj = payload.cnpj || payload.document || "";
    const origem = payload.origem || payload.source || payload.utm_source || "Tráfego Pago / Anúncios";
    const faturamento = Number(payload.faturamento || payload.revenue || 50000);
    const cadeiras = Number(payload.cadeiras || payload.chairs || 2);
    const cargo = payload.cargo || payload.job_title || "Médico / Proprietário";
    const funil_id = Number(payload.funil_id || 1);

    await connection.beginTransaction();

    // 1. Distribuição Automática Round-Robin de Vendedor
    let [filaVendedores] = await connection.execute(
      "SELECT id, nome, email FROM usuarios WHERE role = 'Comercial' AND ativo = 1 AND recebe_leads = 1 ORDER BY ultimo_lead_recebido_em ASC, id ASC LIMIT 1 FOR UPDATE"
    );

    if (filaVendedores.length === 0) {
      [filaVendedores] = await connection.execute(
        "SELECT id, nome, email FROM usuarios WHERE role = 'Diretor' AND ativo = 1 AND recebe_leads = 1 ORDER BY ultimo_lead_recebido_em ASC, id ASC LIMIT 1 FOR UPDATE"
      );
    }

    let vendedorId = null;
    let vendedorNome = "Equipe Comercial";

    if (filaVendedores.length > 0) {
      const vend = filaVendedores[0];
      vendedorId = vend.id;
      vendedorNome = vend.nome;
      await connection.execute("UPDATE usuarios SET ultimo_lead_recebido_em = NOW() WHERE id = ?", [vendedorId]);
    }

    // 2. Inserir Lead no Banco de Dados
    const [leadRes] = await connection.execute(
      `INSERT INTO leads (
        funil_id, nome_cliente, nome_clinica, cnpj, cadeiras, faturamento, marca, email, telefone, origem, status, 
        valor_estimado, cargo, criado_por, vendedor_id, criado_em, atualizado_em
      ) VALUES (?, ?, ?, ?, ?, ?, 'finora', ?, ?, ?, 'Novo', 1450.00, ?, ?, ?, NOW(), NOW())`,
      [
        funil_id,
        nomeCliente,
        nomeClinica,
        cnpj,
        cadeiras,
        faturamento,
        email,
        telefone,
        origem,
        cargo,
        vendedorId || 1,
        vendedorId
      ]
    );

    const leadId = leadRes.insertId;

    // 3. Gerar Proposta Comercial Preliminar Instantânea
    const tokenAcesso = crypto.randomBytes(20).toString("hex");
    // Mesma sequência das propostas manuais: ano+leadId colidia com o MAX+1 no UNIQUE e o lead se perdia no rollback
    const numeroProposta = await proximoNumeroProposta(connection);
    const valorMensal = faturamento > 80000 ? 1850.00 : 1350.00;

    // `observacao` é o que PDF, totais e alçada usam para separar mensal de pontual (só `tipo` fazia o certificado contar como mensal)
    // ponytail: preço fixo 1350/1850 da campanha, fora do catálogo; usar precoService se o comercial quiser tabela
    const itensJson = JSON.stringify([
      { servico: "Assessoria Contábil & Fiscal Mensal (Fator R 6%)", valor: valorMensal, tipo: "mensal", observacao: "Mensal" },
      { servico: "Emissão de Notas Fiscais & BPO Financeiro", valor: 0.00, tipo: "mensal", observacao: "Mensal" },
      { servico: "Certificado Digital A1 PJ Gratuito", valor: 0.00, tipo: "pontual", observacao: "Pontual - emissão" }
    ]);

    const [propRes] = await connection.execute(
      `INSERT INTO propostas (
        numero_proposta, token_acesso, nome_clinica, nome_socio, email, telefone, cnpj,
        faturamento, regime_fiscal, cadeiras, socios, funcionarios, valor_total, percentual_desconto,
        empresa_proposta, tipo_proposta, criado_por, status, itens_json, data_proposta, criado_em
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Simples Nacional', ?, 2, 2, ?, 0, 'FINORA', 'finora', ?, 'Pendente', ?, CURDATE(), NOW())`,
      [
        numeroProposta,
        tokenAcesso,
        nomeClinica,
        nomeCliente,
        email,
        telefone,
        cnpj,
        faturamento * 12,
        cadeiras,
        valorMensal,
        vendedorId || 1,
        itensJson
      ]
    );

    const propostaId = propRes.insertId;

    // Vincular proposta ao lead
    await connection.execute("UPDATE leads SET proposta_id = ? WHERE id = ?", [propostaId, leadId]);

    // Registrar histórico inicial no CRM
    await connection.execute(
      "INSERT INTO lead_comentarios (lead_id, usuario_id, comentario, tipo, criado_em) VALUES (?, ?, ?, 'historico', NOW())",
      [leadId, vendedorId || 1, `Lead recebido via Webhook (${origem}). Atribuído para ${vendedorNome}. Proposta #${numeroProposta} gerada automaticamente.`]
    );

    await connection.commit();
    connection.release();
    connection = null; // catch abaixo não pode liberar de novo

    const linkCurto = gerarLinkCurto(tokenAcesso);

    // 4. Notificações Multicanal em Tempo Real
    notificationService.enviarNotificacao("novo_lead_webhook", {
      lead_id: leadId,
      proposta_id: propostaId,
      nome_cliente: nomeCliente,
      clinica: nomeClinica,
      origem: origem,
      vendedor: vendedorNome,
      link: linkCurto
    }, [vendedorId]);

    if (typeof teamsService.enviarNotificacaoTeams === "function") {
      teamsService.enviarNotificacaoTeams("criada", {
        numeroProposta: numeroProposta,
        nomeClinica: nomeClinica,
        nomeSocio: nomeCliente,
        email: email,
        telefone: telefone,
        investimentoMensal: valorMensal,
        tipoProposta: "FINORA"
      }).catch(() => {});
    }

    // 5. Disparo de WhatsApp de Boas-Vindas com o Link Curto
    if (telefone) {
      const msgWhats = `Olá, ${nomeCliente}! Sou da equipe da *FINORA Contabilidade Médica*.\n\nRecebemos seu contato com interesse na otimização tributária da *${nomeClinica}*.\n\nJá geramos uma proposta personalizada com enquadramento no *Fator R (6% de imposto)* e BPO financeiro:\n🔗 *Acesse sua proposta aqui:* ${linkCurto}\n\nO consultor *${vendedorNome}* entrará em contato em instantes para tirar qualquer dúvida!`;
      whatsappService.enviarMensagemTexto(telefone, msgWhats).catch((e) => console.warn("[Webhook Leads] Erro no WhatsApp:", e.message));
    }

    res.status(201).json({
      success: true,
      message: "Lead e proposta comercial criados com sucesso!",
      lead_id: leadId,
      proposta_id: propostaId,
      token: tokenAcesso,
      link: linkCurto,
      vendedor_atribuido: vendedorNome
    });
  } catch (error) {
    await connection?.rollback().catch(() => {});
    connection?.release();
    console.error("[Webhook Leads] Erro:", error);
    next(error);
  }
});

/**
 * 📦 WEBHOOK DE ONBOARDING OPERACIONAL PÓS-ASSINATURA
 * Endpoint: POST /api/webhooks/onboarding/notificar
 */
router.post("/api/webhooks/onboarding/notificar", async (req, res, next) => {
  try {
    const { proposta_id, token } = req.body;
    if (!proposta_id && !token) {
      return res.status(400).json({ error: "proposta_id ou token obrigatório." });
    }

    const rows = await db.executarQuery(
      "SELECT * FROM propostas WHERE id = ? OR token_acesso = ? LIMIT 1",
      [proposta_id || 0, token || ""]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Proposta não encontrada." });
    }

    const p = rows[0];
    const dadosOnboarding = {
      evento: "proposta_aprovada_onboarding",
      proposta_id: p.id,
      numero_proposta: p.numero_proposta,
      clinica: p.nome_clinica,
      socio: p.nome_socio,
      email: p.email,
      telefone: p.telefone,
      cnpj: p.cnpj,
      valor_mensal: p.valor_total,
      data_fechamento: p.data_decisao || new Date().toISOString(),
      contrato_url: `${process.env.BASE_URL || "http://localhost:3005"}/api/propostas/${p.token_acesso}/contrato`
    };

    console.log(`[Onboarding Webhook] Disparo operacional executado para Proposta #${p.numero_proposta}`);
    res.json({ success: true, onboarding: dadosOnboarding });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

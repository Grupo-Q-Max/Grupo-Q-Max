const db = require("../config/db");
const notificationService = require("./notificationService");
const auditService = require("./auditService");

const FUNIL_NOME = "Pipeline de Propostas Comerciais";
const ETAPAS = {
  RASCUNHO: "Rascunho",
  ENVIADA: "Proposta Enviada",
  VISUALIZADA: "Visualizada",
  EM_ASSINATURA: "Em Assinatura",
  ASSINADA: "Assinada",
  DECLINADA: "Declinada",
};

let cachedFunilId = null;

/**
 * Garante que o funil próprio de propostas e suas 6 etapas existem no banco de dados.
 */
async function obterIdFunilPropostas() {
  if (cachedFunilId) return cachedFunilId;

  try {
    const rows = await db.executarQuery(
      "SELECT id FROM crm_funis WHERE nome = ? OR nome LIKE '%Proposta%' ORDER BY id ASC LIMIT 1",
      [FUNIL_NOME]
    );

    if (rows.length > 0) {
      cachedFunilId = rows[0].id;
      return cachedFunilId;
    }

    // Criar se não existir
    const result = await db.transacao(async (conn) => {
      const [fRes] = await conn.query(
        "INSERT INTO crm_funis (nome, descricao, ativo) VALUES (?, ?, 1)",
        [FUNIL_NOME, "Acompanhamento do ciclo de vida das propostas comerciais e contratos D4Sign"]
      );
      const fId = fRes.insertId;

      const etapasPadrao = [
        ["Rascunho", "#94a3b8", 1],
        ["Proposta Enviada", "#3b82f6", 2],
        ["Visualizada", "#8b5cf6", 3],
        ["Em Assinatura", "#f59e0b", 4],
        ["Assinada", "#10b981", 5],
        ["Declinada", "#ef4444", 6],
      ];

      for (const [nome, cor, ordem] of etapasPadrao) {
        await conn.query(
          "INSERT INTO crm_etapas (nome, cor, ordem, ativo, funil_id) VALUES (?, ?, ?, 1, ?)",
          [nome, cor, ordem, fId]
        );
      }
      return fId;
    });

    cachedFunilId = result;
    return cachedFunilId;
  } catch (err) {
    console.error("[CRMPipelineService] Erro ao obter funil de propostas:", err.message);
    return 3; // fallback ID padrão
  }
}

/**
 * Mapeia o status da tabela propostas para o nome da etapa correspondente no CRM
 */
function mapearStatusPropostaParaEtapa(statusProposta, visualizacoesCount = 0) {
  const s = String(statusProposta || "").trim();
  if (s === "Rascunho") return ETAPAS.RASCUNHO;
  if (s === "Em Assinatura") return ETAPAS.EM_ASSINATURA;
  if (s === "Aprovada" || s === "Ganho") return ETAPAS.ASSINADA;
  if (s === "Recusada" || s === "Perdido" || s === "Cancelada") return ETAPAS.DECLINADA;
  if (s === "Visualizada" || visualizacoesCount > 0) return ETAPAS.VISUALIZADA;
  return ETAPAS.ENVIADA;
}

/**
 * Sincroniza uma proposta específica no funil próprio do CRM
 */
async function sincronizarPropostaNoCRM(propostaId, statusOverride = null) {
  try {
    const funilId = await obterIdFunilPropostas();

    const propostas = await db.executarQuery(
      `SELECT p.*, 
        (SELECT COUNT(*) FROM proposta_visualizacoes pv WHERE pv.proposta_id = p.id) as visualizacoes_count 
       FROM propostas p 
       WHERE p.id = ? LIMIT 1`,
      [propostaId]
    );

    if (propostas.length === 0) return null;
    const proposta = propostas[0];

    const etapaNome = statusOverride || mapearStatusPropostaParaEtapa(proposta.status, Number(proposta.visualizacoes_count || 0));
    const nomeCliente = proposta.nome_socio || proposta.nome_clinica || `Proposta #${proposta.numero_proposta}`;
    const valor = parseFloat(proposta.valor_total) || 0;
    const vendedorId = proposta.criado_por || 1;

    // Verificar se já existe um lead vinculado a esta proposta neste funil
    const leads = await db.executarQuery(
      "SELECT id, status, funil_id FROM leads WHERE proposta_id = ? AND funil_id = ? LIMIT 1",
      [proposta.id, funilId]
    );

    let leadId;
    if (leads.length > 0) {
      leadId = leads[0].id;
      const statusAnterior = leads[0].status;

      await db.execute(
        `UPDATE leads SET 
          nome_cliente = ?, 
          nome_clinica = ?, 
          email = ?, 
          telefone = ?, 
          status = ?, 
          valor_estimado = ?, 
          faturamento = ?, 
          cnpj = ?, 
          cadeiras = ?, 
          vendedor_id = ?, 
          atualizado_em = NOW() 
         WHERE id = ?`,
        [
          nomeCliente,
          proposta.nome_clinica,
          proposta.email || "",
          proposta.telefone || "",
          etapaNome,
          valor,
          proposta.faturamento || 0,
          proposta.cnpj || "",
          proposta.cadeiras || 0,
          vendedorId,
          leadId,
        ]
      );

      // Se mudou de etapa, registrar comentário no histórico do lead
      if (statusAnterior !== etapaNome) {
        await db.execute(
          "INSERT INTO lead_comentarios (lead_id, usuario_id, comentario, tipo, criado_em) VALUES (?, ?, ?, 'historico', NOW())",
          [
            leadId,
            vendedorId,
            `Proposta #${proposta.numero_proposta} mudou de status: [${statusAnterior}] ➔ [${etapaNome}]`,
          ]
        );
      }
    } else {
      // Criar novo lead para a proposta no funil próprio
      const [insertRes] = await db.execute(
        `INSERT INTO leads (
          nome_cliente, nome_clinica, email, telefone, origem, status, 
          valor_estimado, cargo, criado_por, vendedor_id, proposta_id, 
          criado_em, atualizado_em, cnpj, cadeiras, faturamento, marca, funil_id
        ) VALUES (?, ?, ?, ?, 'Proposta Comercial', ?, ?, 'Proprietário / Sócio', ?, ?, ?, NOW(), NOW(), ?, ?, ?, 'finora', ?)`,
        [
          nomeCliente,
          proposta.nome_clinica || "Clínica Sem Nome",
          proposta.email || "",
          proposta.telefone || "",
          etapaNome,
          valor,
          vendedorId,
          vendedorId,
          proposta.id,
          proposta.cnpj || "",
          proposta.cadeiras || 0,
          proposta.faturamento || 0,
          funilId,
        ]
      );

      leadId = insertRes.insertId;

      await db.execute(
        "INSERT INTO lead_comentarios (lead_id, usuario_id, comentario, tipo, criado_em) VALUES (?, ?, ?, 'historico', NOW())",
        [
          leadId,
          vendedorId,
          `Oportunidade criada automaticamente a partir da Proposta Comercial #${proposta.numero_proposta} (Etapa: ${etapaNome})`,
        ]
      );
    }

    return { leadId, funilId, etapaNome };
  } catch (err) {
    console.error(`[CRMPipelineService] Erro ao sincronizar proposta ${propostaId}:`, err.message);
    return null;
  }
}

/**
 * Gatilho disparado automaticamente quando o cliente abre o link público da proposta
 */
async function tratarAberturaProposta(propostaId, ip = "", userAgent = "") {
  try {
    const funilId = await obterIdFunilPropostas();

    const propostas = await db.executarQuery(
      "SELECT id, numero_proposta, status, nome_clinica, criado_por FROM propostas WHERE id = ? LIMIT 1",
      [propostaId]
    );
    if (propostas.length === 0) return;
    const proposta = propostas[0];

    // Se a proposta já estiver em assinatura ou fechada, não volta o status para visualizada
    if (["Em Assinatura", "Aprovada", "Recusada"].includes(proposta.status)) {
      return;
    }

    // 1. Atualizar status na tabela propostas para 'Visualizada'
    if (proposta.status !== "Visualizada") {
      await db.execute("UPDATE propostas SET status = 'Visualizada' WHERE id = ?", [proposta.id]);
    }

    // 2. Mover lead no CRM para a etapa 'Visualizada'
    const leads = await db.executarQuery(
      "SELECT id, status FROM leads WHERE proposta_id = ? AND funil_id = ? LIMIT 1",
      [proposta.id, funilId]
    );

    if (leads.length > 0) {
      const lead = leads[0];
      if (lead.status === ETAPAS.RASCUNHO || lead.status === ETAPAS.ENVIADA || lead.status === "Novo") {
        await db.execute(
          "UPDATE leads SET status = ?, atualizado_em = NOW() WHERE id = ?",
          [ETAPAS.VISUALIZADA, lead.id]
        );

        const dataHora = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
        await db.execute(
          "INSERT INTO lead_comentarios (lead_id, usuario_id, comentario, tipo, criado_em) VALUES (?, ?, ?, 'historico', NOW())",
          [
            lead.id,
            proposta.criado_por || 1,
            `👁️ Proposta #${proposta.numero_proposta} ABERTA pelo cliente em ${dataHora}! (IP: ${ip || "remoto"})`,
          ]
        );

        // Notificar vendedor responsável
        notificationService.enviarNotificacao(
          "lead_atualizado",
          {
            id: lead.id,
            nomeCliente: proposta.nome_clinica,
            status: "Visualizada (Cliente Aberto)",
          },
          [proposta.criado_por]
        );
      }
    } else {
      // Cria o lead já na etapa Visualizada
      await sincronizarPropostaNoCRM(proposta.id, ETAPAS.VISUALIZADA);
    }

    // Registrar no log de auditoria
    auditService.registrarLogProposta({
      proposta_id: proposta.id,
      usuario_nome: "Cliente (Acesso Remoto)",
      usuario_role: "Cliente",
      acao: "VISUALIZACAO_PROPOSTA",
      titulo: `Proposta #${proposta.numero_proposta} aberta pelo cliente`,
      detalhes: `Acesso identificado via IP ${ip || "desconhecido"}. Status no CRM atualizado para '${ETAPAS.VISUALIZADA}'.`,
      dados_novos: { status: "Visualizada", ip, data_abertura: new Date().toISOString() },
    }).catch(() => {});
  } catch (err) {
    console.error("[CRMPipelineService] Erro ao tratar abertura de proposta:", err.message);
  }
}

/**
 * Gatilho disparado quando o contrato é gerado e enviado ao D4Sign
 */
async function tratarEnvioD4Sign(propostaId, uuidDocumento) {
  try {
    const funilId = await obterIdFunilPropostas();

    await db.execute(
      "UPDATE propostas SET status = 'Em Assinatura', ip_assinatura = ? WHERE id = ?",
      [uuidDocumento, propostaId]
    );

    const leads = await db.executarQuery(
      "SELECT id, status FROM leads WHERE proposta_id = ? AND funil_id = ? LIMIT 1",
      [propostaId, funilId]
    );

    const propostas = await db.executarQuery(
      "SELECT id, numero_proposta, criado_por, nome_clinica FROM propostas WHERE id = ? LIMIT 1",
      [propostaId]
    );
    const proposta = propostas[0];

    if (leads.length > 0) {
      const lead = leads[0];
      await db.execute(
        "UPDATE leads SET status = ?, atualizado_em = NOW() WHERE id = ?",
        [ETAPAS.EM_ASSINATURA, lead.id]
      );

      await db.execute(
        "INSERT INTO lead_comentarios (lead_id, usuario_id, comentario, tipo, criado_em) VALUES (?, ?, ?, 'historico', NOW())",
        [
          lead.id,
          proposta?.criado_por || 1,
          `📄 Contrato enviado para assinatura digital no D4Sign. Documento UUID: ${uuidDocumento}. Etapa alterada para [${ETAPAS.EM_ASSINATURA}].`,
        ]
      );
    } else {
      await sincronizarPropostaNoCRM(propostaId, ETAPAS.EM_ASSINATURA);
    }

    auditService.registrarLogProposta({
      proposta_id: propostaId,
      usuario_nome: "Sistema / D4Sign",
      usuario_role: "Sistema",
      acao: "ENVIO_D4SIGN",
      titulo: "Contrato Gerado e Enviado ao D4Sign",
      detalhes: `Documento ${uuidDocumento} registrado com sucesso para coleta de assinaturas digitais.`,
      dados_novos: { status: "Em Assinatura", d4sign_uuid: uuidDocumento },
    }).catch(() => {});
  } catch (err) {
    console.error("[CRMPipelineService] Erro ao tratar envio D4Sign:", err.message);
  }
}

/**
 * Gatilho disparado quando um signatário individual assina no D4Sign (type_post = 4)
 */
async function tratarAssinaturaParcialD4Sign(uuidDocumento, signatarioInfo = {}) {
  try {
    const propostas = await db.executarQuery(
      "SELECT id, numero_proposta, criado_por, nome_clinica FROM propostas WHERE ip_assinatura = ? LIMIT 1",
      [uuidDocumento]
    );
    if (propostas.length === 0) return;
    const proposta = propostas[0];
    const funilId = await obterIdFunilPropostas();

    const nomeSignatario = signatarioInfo.nome || signatarioInfo.email || "Um signatário";
    const dataHora = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

    const leads = await db.executarQuery(
      "SELECT id FROM leads WHERE proposta_id = ? AND funil_id = ? LIMIT 1",
      [proposta.id, funilId]
    );

    if (leads.length > 0) {
      await db.execute(
        "INSERT INTO lead_comentarios (lead_id, usuario_id, comentario, tipo, criado_em) VALUES (?, ?, ?, 'historico', NOW())",
        [
          leads[0].id,
          proposta.criado_por || 1,
          `✍️ ${nomeSignatario} assinou o contrato no D4Sign em ${dataHora}. Aguardando os demais signatários.`,
        ]
      );
    }

    auditService.registrarLogProposta({
      proposta_id: proposta.id,
      usuario_nome: nomeSignatario,
      usuario_role: "Signatário",
      acao: "ASSINATURA_PARCIAL_D4SIGN",
      titulo: `Assinatura confirmada: ${nomeSignatario}`,
      detalhes: `O signatário ${nomeSignatario} concluiu sua assinatura eletrônica no documento D4Sign.`,
      dados_novos: { signatario: signatarioInfo, data_assinatura: dataHora },
    }).catch(() => {});
  } catch (err) {
    console.error("[CRMPipelineService] Erro ao registrar assinatura parcial D4Sign:", err.message);
  }
}

/**
 * Gatilho disparado quando TODOS os signatários concluem a assinatura (type_post = 1)
 */
async function tratarAssinaturaCompletaD4Sign(uuidDocumento) {
  try {
    const propostas = await db.executarQuery(
      "SELECT id, numero_proposta, criado_por, nome_clinica FROM propostas WHERE ip_assinatura = ? LIMIT 1",
      [uuidDocumento]
    );
    if (propostas.length === 0) return;
    const proposta = propostas[0];
    const funilId = await obterIdFunilPropostas();

    // Atualizar no CRM para 'Assinada'
    const leads = await db.executarQuery(
      "SELECT id FROM leads WHERE proposta_id = ? AND funil_id = ? LIMIT 1",
      [proposta.id, funilId]
    );

    const dataHora = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

    if (leads.length > 0) {
      await db.execute(
        "UPDATE leads SET status = ?, atualizado_em = NOW() WHERE id = ?",
        [ETAPAS.ASSINADA, leads[0].id]
      );

      await db.execute(
        "INSERT INTO lead_comentarios (lead_id, usuario_id, comentario, tipo, criado_em) VALUES (?, ?, ?, 'historico', NOW())",
        [
          leads[0].id,
          proposta.criado_por || 1,
          `🎉 CONTRATO 100% ASSINADO NO D4SIGN! Todas as partes concluíram as assinaturas digitais com validade jurídica em ${dataHora}. Negócio FECHADO e GANHO!`,
        ]
      );

      notificationService.enviarNotificacao(
        "lead_atualizado",
        {
          id: leads[0].id,
          nomeCliente: proposta.nome_clinica,
          status: "Assinada (Contrato 100% Finalizado)",
        },
        [proposta.criado_por]
      );
    } else {
      await sincronizarPropostaNoCRM(proposta.id, ETAPAS.ASSINADA);
    }
  } catch (err) {
    console.error("[CRMPipelineService] Erro ao tratar assinatura completa D4Sign:", err.message);
  }
}

/**
 * Sincroniza todas as propostas existentes do banco para a pipeline própria
 */
async function sincronizarTodasPropostasExistentes() {
  try {
    const funilId = await obterIdFunilPropostas();
    const propostas = await db.executarQuery(
      `SELECT p.id FROM propostas p
       WHERE p.id NOT IN (SELECT l.proposta_id FROM leads l WHERE l.funil_id = ? AND l.proposta_id IS NOT NULL)
       ORDER BY p.id DESC`,
      [funilId]
    );

    console.log(`[CRMPipelineService] Sincronizando ${propostas.length} propostas pendentes no funil próprio...`);
    for (const p of propostas) {
      await sincronizarPropostaNoCRM(p.id);
    }
    console.log(`[CRMPipelineService] Sincronização concluída com sucesso.`);
  } catch (err) {
    console.error("[CRMPipelineService] Erro na sincronização em massa:", err.message);
  }
}

module.exports = {
  FUNIL_NOME,
  ETAPAS,
  obterIdFunilPropostas,
  sincronizarPropostaNoCRM,
  tratarAberturaProposta,
  tratarEnvioD4Sign,
  tratarAssinaturaParcialD4Sign,
  tratarAssinaturaCompletaD4Sign,
  sincronizarTodasPropostasExistentes,
};


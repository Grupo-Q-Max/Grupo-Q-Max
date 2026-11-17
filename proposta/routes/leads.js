const express = require("express");
const router = express.Router();
const { z } = require("zod");
const db = require("../config/db");
const { verificarToken, verificarRole, donoLead, donoAtividade } = require("../middleware/auth");
const notificationService = require("../services/notificationService");

const { leadSchema } = require("../validations/leadValidation");

// Fila de distribuição (mesma regra do cadastro manual, webhook e prospecção): Comercial ativo com "recebe leads"
// há mais tempo sem receber; sem Comercial, Diretor. FOR UPDATE + carimbo: dois leads simultâneos não caem no mesmo vendedor.
async function proximoVendedorDaFila(conexao) {
  for (const role of ["Comercial", "Diretor"]) {
    const [fila] = await conexao.execute(
      "SELECT id, nome FROM usuarios WHERE role = ? AND ativo = 1 AND recebe_leads = 1 ORDER BY ultimo_lead_recebido_em ASC, id ASC LIMIT 1 FOR UPDATE",
      [role]
    );
    if (fila.length > 0) {
      await conexao.execute("UPDATE usuarios SET ultimo_lead_recebido_em = NOW() WHERE id = ?", [fila[0].id]);
      return fila[0];
    }
  }
  return null;
}

// --- LIST ALL LEADS ---
router.get("/api/leads", verificarToken, async (req, res, next) => {
  try {
    let whereClause = "WHERE l.funil_id = ?";
    const funil_id = req.query.funil_id || 1;
    let queryParams = [funil_id];

    if (req.user.role === "Comercial") {
      whereClause += " AND (l.vendedor_id = ? OR l.criado_por = ?)";
      queryParams.push(req.user.id, req.user.id);
    }

    const leads = await db.executarQuery(`
      SELECT 
        l.*,
        u_criador.nome AS criador_nome,
        u_vendedor.nome AS vendedor_nome,
        p.numero_proposta AS proposta_numero,
        p.token_acesso AS token_acesso,
        p.status AS proposta_status,
        p.ip_assinatura AS d4sign_uuid,
        p.valor_total AS proposta_valor_total,
        p.faturamento AS proposta_faturamento, -- link da proposta no CRM (o lead só aparece para o dono)
        p.status AS proposta_status,
        p.ip_assinatura AS d4sign_uuid,
        p.valor_total AS proposta_valor_total,
        (SELECT COUNT(*) FROM lead_comentarios lc WHERE lc.lead_id = l.id) AS total_comentarios,
        (
          SELECT lc.comentario 
          FROM lead_comentarios lc 
          WHERE lc.lead_id = l.id 
          ORDER BY lc.criado_em DESC 
          LIMIT 1
        ) AS ultimo_comentario,
        (
          SELECT lc.criado_em 
          FROM lead_comentarios lc 
          WHERE lc.lead_id = l.id 
          ORDER BY lc.criado_em DESC 
          LIMIT 1
        ) AS ultimo_comentario_data
      FROM leads l
      LEFT JOIN usuarios u_criador ON l.criado_por = u_criador.id
      LEFT JOIN usuarios u_vendedor ON l.vendedor_id = u_vendedor.id
      LEFT JOIN propostas p ON l.proposta_id = p.id
      ${whereClause}
      ORDER BY l.status = 'Ganho' ASC, l.status = 'Perdido' ASC, l.atualizado_em DESC
    `, queryParams);
    res.json(leads);
  } catch (error) {
    next(error);
  }
});

// --- LIST VENDORS (USERS) ---
router.get("/api/usuarios/vendedores", verificarToken, async (req, res, next) => {
  try {
    const vendedores = await db.executarQuery(
      "SELECT id, nome, email, role FROM usuarios WHERE ativo = 1 ORDER BY nome ASC"
    );
    res.json(vendedores);
  } catch (error) {
    next(error);
  }
});

// --- GET CRM PIPELINE STATISTICS --- (antes de "/api/leads/:id", senão "stats" vira :id)
router.get("/api/leads/stats", verificarToken, async (req, res, next) => {
  try {
    // Comercial vê só os números dos próprios leads; o ranking continua sendo da equipe
    const somenteProprios = req.user.role === "Comercial";
    const filtro = somenteProprios ? "(vendedor_id = ? OR criado_por = ?)" : "1=1";
    const p = somenteProprios ? [req.user.id, req.user.id] : [];
    const kpis = await db.executarQuery(`
      SELECT
        (SELECT COALESCE(SUM(valor_estimado), 0) FROM leads WHERE ${filtro} AND status NOT IN ('Ganho', 'Perdido')) AS total_negociando,
        (SELECT COALESCE(SUM(valor_estimado), 0) FROM leads WHERE ${filtro} AND status = 'Ganho') AS total_ganho,
        (SELECT COALESCE(SUM(valor_estimado), 0) FROM leads WHERE ${filtro} AND status = 'Perdido') AS total_perdido,
        (SELECT COUNT(*) FROM leads WHERE ${filtro}) AS total_leads,
        (SELECT COUNT(*) FROM leads WHERE ${filtro} AND status = 'Ganho') AS leads_ganhos,
        (SELECT COUNT(*) FROM leads WHERE ${filtro} AND status = 'Perdido') AS leads_perdidos
    `, [...p, ...p, ...p, ...p, ...p, ...p]);

    const statsEtapas = await db.executarQuery(`
      SELECT status, COUNT(*) AS count, COALESCE(SUM(valor_estimado), 0) AS valor
      FROM leads
      WHERE ${filtro}
      GROUP BY status
    `, p);

    const statsOrigens = await db.executarQuery(`
      SELECT origem, COUNT(*) AS count, COALESCE(SUM(valor_estimado), 0) AS valor
      FROM leads
      WHERE ${filtro}
      GROUP BY origem
    `, p);

    const motivosPerda = await db.executarQuery(`
      SELECT motivo_perda, COUNT(*) AS count, COALESCE(SUM(valor_estimado), 0) AS valor
      FROM leads
      WHERE ${filtro} AND status = 'Perdido' AND motivo_perda IS NOT NULL AND motivo_perda <> ''
      GROUP BY motivo_perda
      ORDER BY count DESC
    `, p);

    // 1. Leaderboard: Performance dos vendedores comerciales e diretores ativos
    const rankingVendedores = await db.executarQuery(`
      SELECT 
        u.nome AS vendedor_nome,
        u.role AS vendedor_role,
        COUNT(l.id) AS leads_total,
        SUM(CASE WHEN l.status = 'Ganho' THEN 1 ELSE 0 END) AS leads_ganhos,
        COALESCE(SUM(CASE WHEN l.status = 'Ganho' THEN l.valor_estimado ELSE 0 END), 0) AS faturamento_ganho
      FROM usuarios u
      LEFT JOIN leads l ON u.id = l.vendedor_id
      WHERE u.role IN ('Comercial', 'Diretor') AND u.ativo = 1
      GROUP BY u.id, u.nome, u.role
      ORDER BY faturamento_ganho DESC, leads_ganhos DESC
    `);

    // 2. Feed Global de Atividades Recentes
    const atividadesRecentes = await db.executarQuery(`
      SELECT 
        lc.*, 
        l.nome_cliente, 
        u.nome AS usuario_nome
      FROM lead_comentarios lc
      JOIN leads l ON lc.lead_id = l.id
      JOIN usuarios u ON lc.usuario_id = u.id
      WHERE ${somenteProprios ? "(l.vendedor_id = ? OR l.criado_por = ?)" : "1=1"}
      ORDER BY lc.id DESC
      LIMIT 8
    `, p);

    res.json({
      kpis: kpis[0],
      etapas: statsEtapas,
      origens: statsOrigens,
      motivosPerda,
      rankingVendedores,
      atividadesRecentes
    });
  } catch (error) {
    next(error);
  }
});

// --- GET SINGLE LEAD DETAILS AND TIMELINE ---
router.get("/api/leads/:id", verificarToken, donoLead, async (req, res, next) => {
  try {
    const { id } = req.params;

    const leads = await db.executarQuery(`
      SELECT 
        l.*,
        u_criador.nome AS criador_nome,
        u_vendedor.nome AS vendedor_nome,
        p.numero_proposta AS proposta_numero,
        p.token_acesso AS token_acesso,
        p.status AS proposta_status,
        p.ip_assinatura AS d4sign_uuid,
        p.valor_total AS proposta_valor_total,
        p.faturamento AS proposta_faturamento
      FROM leads l
      LEFT JOIN usuarios u_criador ON l.criado_por = u_criador.id
      LEFT JOIN usuarios u_vendedor ON l.vendedor_id = u_vendedor.id
      LEFT JOIN propostas p ON l.proposta_id = p.id
      WHERE l.id = ?
    `, [id]);

    if (leads.length === 0) {
      return res.status(404).json({ error: "Lead não encontrado." });
    }

    const timeline = await db.executarQuery(`
      SELECT 
        lc.*,
        u.nome AS usuario_nome
      FROM lead_comentarios lc
      LEFT JOIN usuarios u ON lc.usuario_id = u.id
      WHERE lc.lead_id = ?
      ORDER BY lc.criado_em DESC
    `, [id]);

    res.json({
      lead: leads[0],
      timeline
    });
  } catch (error) {
    next(error);
  }
});

// --- CONSULTAR STATUS D4SIGN & SIGNATÁRIOS DO LEAD ---
router.get("/api/leads/:id/d4sign-status", verificarToken, donoLead, async (req, res, next) => {
  try {
    const { id } = req.params;
    const leads = await db.executarQuery(
      `SELECT l.id, l.nome_cliente, l.nome_clinica, l.proposta_id, p.numero_proposta, p.status as proposta_status, p.ip_assinatura as d4sign_uuid, p.token_acesso 
       FROM leads l
       LEFT JOIN propostas p ON l.proposta_id = p.id
       WHERE l.id = ? LIMIT 1`,
      [id]
    );

    if (leads.length === 0) {
      return res.status(404).json({ error: "Lead não encontrado." });
    }

    const lead = leads[0];
    if (!lead.proposta_id) {
      return res.json({
        temProposta: false,
        mensagem: "Lead não possui proposta comercial vinculada.",
      });
    }

    const d4signService = require("../services/d4signService");
    const uuid = lead.d4sign_uuid;

    if (!uuid) {
      return res.json({
        temProposta: true,
        temDocumento: false,
        propostaId: lead.proposta_id,
        numeroProposta: lead.numero_proposta,
        statusProposta: lead.proposta_status,
        tokenAcesso: lead.token_acesso,
        mensagem: "Contrato ainda não enviado para assinatura no D4Sign.",
        signatarios: [],
      });
    }

    const d4status = await d4signService.consultarSignatariosDocumento(uuid);

    res.json({
      temProposta: true,
      temDocumento: true,
      propostaId: lead.proposta_id,
      numeroProposta: lead.numero_proposta,
      statusProposta: lead.proposta_status,
      tokenAcesso: lead.token_acesso,
      ...d4status,
    });
  } catch (error) {
    next(error);
  }
});

// --- UPDATE LEAD ---
router.put("/api/leads/:id", verificarToken, donoLead, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verificar se o lead existe
    const leadExistente = await db.executarQuery("SELECT * FROM leads WHERE id = ?", [id]);
    if (leadExistente.length === 0) {
      return res.status(404).json({ error: "Lead não encontrado." });
    }

    const anterior = leadExistente[0];

    // Extrair os campos enviados na requisição
    const camposPermitidos = [
      "nome_cliente", "nome_clinica", "cnpj", "area_m2", "posicoes_coworking", "tipo_espaco", "marca", "email", "telefone", "status",
      "cadeiras", "faturamento", "valor_estimado", "vendedor_id", "campos_personalizados", "cargo",
      "motivo_perda", "detalhes_perda", "proposta_id"
    ];

    // Se for comercial, não pode alterar o responsável do lead (vendedor_id)
    if (req.user.role === "Comercial") {
      const index = camposPermitidos.indexOf("vendedor_id");
      if (index > -1) {
        camposPermitidos.splice(index, 1);
      }
    }

    // Vínculo lead → proposta (feito pela tela de proposta ao salvar): proposta precisa existir e, para Comercial, ser dele
    if (req.body.proposta_id !== undefined && req.body.proposta_id !== null) {
      const propostaId = Number(req.body.proposta_id);
      const [proposta] = Number.isInteger(propostaId)
        ? await db.executarQuery("SELECT criado_por FROM propostas WHERE id = ?", [propostaId])
        : [];
      if (!proposta) return res.status(400).json({ error: "Proposta inválida." });
      if (req.user.role === "Comercial" && Number(proposta.criado_por) !== Number(req.user.id)) {
        return res.status(403).json({ error: "Acesso negado a esta proposta." });
      }
      req.body.proposta_id = propostaId;
    }

    const queryPartes = [];
    const params = [];

    camposPermitidos.forEach(campo => {
      if (req.body[campo] !== undefined) {
        queryPartes.push(`${campo} = ?`);
        if (campo === "campos_personalizados" && req.body[campo] !== null) {
          params.push(JSON.stringify(req.body[campo]));
        } else if (
          campo === "vendedor_id" || 
          campo === "cadeiras" || 
          campo === "faturamento" || 
          campo === "valor_estimado" || 
          campo === "area_m2" || 
          campo === "posicoes_coworking"
        ) {
          params.push(req.body[campo] !== null ? Number(req.body[campo]) : null);
        } else if (typeof req.body[campo] === "string") {
          params.push(req.body[campo].trim());
        } else {
          params.push(req.body[campo]);
        }
      }
    });

    if (queryPartes.length === 0) {
      return res.status(400).json({ error: "Nenhum dado fornecido para atualização." });
    }

    params.push(id);

    // Executar update dinâmico
    await db.executarQuery(
      `UPDATE leads SET ${queryPartes.join(", ")}, atualizado_em = NOW() WHERE id = ?`,
      params
    );

    const { status, vendedor_id } = req.body;

    // Registra alteração de status na timeline se houver alteração
    if (status && status !== anterior.status) {
      await db.executarQuery(
        `INSERT INTO lead_comentarios (lead_id, usuario_id, tipo, comentario) VALUES (?, ?, 'sistema', ?)`,
        [id, req.user.id, `Status alterado de "${anterior.status}" para "${status}" por ${req.user.nome}.`]
      );
    }

    // Registra alteração de vendedor na timeline se houver alteração
    if (vendedor_id !== undefined && Number(vendedor_id) !== Number(anterior.vendedor_id)) {
      const nomeVend = vendedor_id
        ? (await db.executarQuery("SELECT nome FROM usuarios WHERE id = ?", [vendedor_id]))[0]?.nome || "Ninguém"
        : "Sem responsável";
      await db.executarQuery(
        `INSERT INTO lead_comentarios (lead_id, usuario_id, tipo, comentario) VALUES (?, ?, 'sistema', ?)`,
        [id, req.user.id, `Responsável alterado para "${nomeVend}" por ${req.user.nome}.`]
      );
    }

    res.json({ success: true, message: "Lead atualizado com sucesso." });
  } catch (error) {
    next(error);
  }
});

// --- CREATE LEAD ---
router.post("/api/leads", verificarToken, async (req, res, next) => {
  // Dentro do try: falha ao pegar conexão vira erro tratado, não promise rejeitada sem resposta
  let connection;
  try {
    connection = await db.getConnection();
    const validacao = leadSchema.safeParse(req.body);
    if (!validacao.success) {
      connection.release();
      return res.status(400).json({
        error: "Dados inválidos para cadastrar lead.",
        detalhes: validacao.error.issues,
      });
    }

    const dados = validacao.data;
    const criado_por = req.user.id;

    // Comercial não atribui lead a colega nem liga lead a proposta alheia (mesma regra do PUT)
    if (req.user.role === "Comercial") {
      if (dados.vendedor_id && Number(dados.vendedor_id) !== Number(req.user.id)) dados.vendedor_id = null;
      if (dados.proposta_id) {
        const [proposta] = await db.executarQuery("SELECT criado_por FROM propostas WHERE id = ?", [dados.proposta_id]);
        if (!proposta || Number(proposta.criado_por) !== Number(req.user.id)) {
          connection.release();
          connection = null;
          return res.status(403).json({ error: "Acesso negado a esta proposta." });
        }
      }
    }

    await connection.beginTransaction();

    let vendedor_id = dados.vendedor_id;
    let logAtribuicao = null;

    // Sem vendedor informado: distribuição automática pela fila do banco
    if (!vendedor_id) {
      const vendedor = await proximoVendedorDaFila(connection);
      if (vendedor) {
        vendedor_id = vendedor.id;
        logAtribuicao = `Lead atribuído automaticamente via fila (Round-Robin) para o vendedor ${vendedor.nome}`;
      }
    }

    const funil_id = req.body.funil_id || 1;

    const [queryResult] = await connection.execute(
      `INSERT INTO leads (
        funil_id, nome_cliente, nome_clinica, cnpj, cadeiras, faturamento, area_m2, posicoes_coworking, tipo_espaco, marca, email, telefone, origem, status, 
        valor_estimado, cargo, criado_por, vendedor_id, proposta_id, motivo_perda, detalhes_perda, criado_em, atualizado_em
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        funil_id,
        dados.nome_cliente,
        dados.nome_clinica ?? "",
        dados.cnpj ?? "",
        dados.cadeiras ?? null,
        dados.faturamento ?? null,
        dados.area_m2 ?? null,
        dados.posicoes_coworking ?? null,
        dados.tipo_espaco ?? "",
        dados.marca ?? "finora",
        dados.email ?? "",
        dados.telefone ?? "",
        dados.origem ?? "Outro",
        dados.status ?? "Novo",
        dados.valor_estimado ?? 0,
        dados.cargo ?? "",
        criado_por,
        vendedor_id ?? null,
        dados.proposta_id ?? null,
        dados.motivo_perda || "",
        dados.detalhes_perda || ""
      ]
    );

    const newLeadId = queryResult.insertId;

    // Registrar histórico inicial
    await connection.execute(
      "INSERT INTO lead_comentarios (lead_id, usuario_id, comentario, tipo, criado_em) VALUES (?, ?, ?, 'historico', NOW())",
      [newLeadId, criado_por, `Lead cadastrado por ${req.user.nome}`]
    );

    if (logAtribuicao) {
      await connection.execute(
        "INSERT INTO lead_comentarios (lead_id, usuario_id, comentario, tipo, criado_em) VALUES (?, ?, ?, 'historico', NOW())",
        [newLeadId, criado_por, logAtribuicao]
      );
    }

    await connection.commit();
    connection.release();
    connection = null; // catch abaixo não pode liberar de novo

    // Enviar SSE
    notificationService.enviarNotificacao("lead_criado", {
      id: newLeadId,
      nome_cliente: dados.nome_cliente,
      status: dados.status,
      por: req.user.nome
    }, [criado_por, vendedor_id]);

    res.status(201).json({
      success: true,
      message: "Lead cadastrado com sucesso!",
      leadId: newLeadId
    });
  } catch (error) {
    await connection?.rollback().catch(() => {});
    connection?.release();
    next(error);
  }
});

// --- TRANSFERIR LEAD ---
router.put("/api/leads/:id/transferir", verificarToken, donoLead, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { novo_usuario_id } = req.body;

    if (!novo_usuario_id) {
      return res.status(400).json({ error: "O novo responsável é obrigatório." });
    }

    const leadsExistentes = await db.executarQuery("SELECT l.*, u.nome as vendedor_atual FROM leads l LEFT JOIN usuarios u ON l.vendedor_id = u.id WHERE l.id = ?", [id]);
    if (leadsExistentes.length === 0) {
      return res.status(404).json({ error: "Lead não encontrado." });
    }
    const leadAntigo = leadsExistentes[0];

    // Só para usuário ativo: lead transferido para conta desativada ficaria órfão
    const novosUsuarios = await db.executarQuery("SELECT nome FROM usuarios WHERE id = ? AND ativo = 1", [novo_usuario_id]);
    if (novosUsuarios.length === 0) {
      return res.status(404).json({ error: "Novo responsável não encontrado." });
    }
    const nomeNovoUsuario = novosUsuarios[0].nome;
    const nomeAntigoUsuario = leadAntigo.vendedor_atual || "Sem responsável";

    await db.executarQuery("UPDATE leads SET vendedor_id = ?, atualizado_em = NOW() WHERE id = ?", [novo_usuario_id, id]);

    const comentario = `${req.user.nome} transferiu a responsabilidade de ${nomeAntigoUsuario} para ${nomeNovoUsuario}.`;
    await db.executarQuery(
      "INSERT INTO lead_comentarios (lead_id, usuario_id, comentario, tipo, criado_em) VALUES (?, ?, ?, 'historico', NOW())",
      [id, req.user.id, comentario]
    );

    notificationService.enviarNotificacao("lead_atualizado", {
      id,
      nome_cliente: leadAntigo.nome_cliente,
      status: leadAntigo.status,
      por: req.user.nome
    }, [leadAntigo.criado_por, leadAntigo.vendedor_id, novo_usuario_id]);

    res.json({ success: true, message: "Lead transferido com sucesso!" });
  } catch (error) {
    next(error);
  }
});

// --- DELETE LEAD ---
router.delete("/api/leads/:id", verificarToken, verificarRole(['Diretor']), async (req, res, next) => {
  try {
    const { id } = req.params;

    const leadsExistentes = await db.executarQuery("SELECT * FROM leads WHERE id = ?", [id]);
    if (leadsExistentes.length === 0) {
      return res.status(404).json({ error: "Lead não encontrado." });
    }

    // Tudo ou nada; atividades saem junto (sem FK, ficavam órfãs e o lembrete disparava para lead excluído)
    await db.transacao(async (conexao) => {
      await conexao.query("DELETE FROM lead_comentarios WHERE lead_id = ?", [id]);
      await conexao.query("DELETE FROM lead_atividades WHERE lead_id = ?", [id]);
      await conexao.query("DELETE FROM leads WHERE id = ?", [id]);
    });

    // Enviar SSE
    notificationService.enviarNotificacao("lead_deletado", {
      id,
      nome_cliente: leadsExistentes[0].nome_cliente,
      por: req.user.nome
    }, [leadsExistentes[0].criado_por, leadsExistentes[0].vendedor_id]);

    res.json({
      success: true,
      message: "Lead excluído com sucesso!"
    });
  } catch (error) {
    next(error);
  }
});

// --- ADD COMMENT MANUAL ---
router.post("/api/leads/:id/comentarios", verificarToken, donoLead, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { comentario } = req.body;

    if (!comentario || comentario.trim() === "") {
      return res.status(400).json({ error: "O comentário não pode ser vazio." });
    }

    const leadsExistentes = await db.executarQuery("SELECT id, nome_cliente, criado_por, vendedor_id FROM leads WHERE id = ?", [id]);
    if (leadsExistentes.length === 0) {
      return res.status(404).json({ error: "Lead não encontrado." });
    }

    const usuario_id = req.user.id;

    await db.executarQuery(
      "INSERT INTO lead_comentarios (lead_id, usuario_id, comentario, tipo, criado_em) VALUES (?, ?, ?, 'comentario', NOW())",
      [id, usuario_id, comentario.trim()]
    );

    // Forçar atualização do carimbo 'atualizado_em' do Lead correspondente
    await db.executarQuery("UPDATE leads SET atualizado_em = NOW() WHERE id = ?", [id]);

    // Enviar SSE
    notificationService.enviarNotificacao("lead_comentado", {
      id,
      nome_cliente: leadsExistentes[0].nome_cliente,
      comentario: comentario.trim(),
      por: req.user.nome
    }, [leadsExistentes[0].criado_por, leadsExistentes[0].vendedor_id]);

    res.status(201).json({
      success: true,
      message: "Comentário adicionado com sucesso!"
    });
  } catch (error) {
    next(error);
  }
});

// --- GET ACTIVITIES FOR A LEAD ---
router.get("/api/leads/:id/atividades", verificarToken, donoLead, async (req, res, next) => {
  try {
    const { id } = req.params;
    const atividades = await db.executarQuery(`
      SELECT la.*, u.nome AS usuario_nome
      FROM lead_atividades la
      LEFT JOIN usuarios u ON la.usuario_id = u.id
      WHERE la.lead_id = ?
      ORDER BY la.concluido ASC, la.data_hora ASC
    `, [id]);
    res.json(atividades);
  } catch (error) {
    next(error);
  }
});

// --- SCHEDULE NEW ACTIVITY ---
const atividadeSchema = z.object({
  tipo: z.string().min(1, "O tipo de atividade é obrigatório"),
  data_hora: z.string().min(1, "Data e hora são obrigatórias"),
  descricao: z.string().optional().nullable().default("")
});

router.post("/api/leads/:id/atividades", verificarToken, donoLead, async (req, res, next) => {
  try {
    const { id } = req.params;
    const validacao = atividadeSchema.safeParse(req.body);
    if (!validacao.success) {
      return res.status(400).json({ error: "Dados inválidos", detalhes: validacao.error.issues });
    }

    const { tipo, data_hora, descricao } = validacao.data;
    const usuario_id = req.user.id;

    const queryResult = await db.executarQuery(
      `INSERT INTO lead_atividades (lead_id, usuario_id, tipo, data_hora, descricao, concluido, alerta_enviado, criado_em)
       VALUES (?, ?, ?, ?, ?, 0, 0, NOW())`,
      [id, usuario_id, tipo, data_hora, descricao]
    );

    const newActId = queryResult.insertId;

    // Log no histórico do lead
    const dataObj = new Date(data_hora);
    const dataFormatada = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(dataObj);
    
    await db.executarQuery(
      "INSERT INTO lead_comentarios (lead_id, usuario_id, comentario, tipo, criado_em) VALUES (?, ?, ?, 'historico', NOW())",
      [id, usuario_id, `${req.user.nome} agendou a atividade "${tipo}" para o dia ${dataFormatada}`]
    );

    // Notificar via SSE
    notificationService.enviarNotificacao("lead_atividade_agendada", {
      lead_id: id,
      tipo,
      data_hora,
      usuario_id: req.user.id
    }, [req.user.id]);

    res.status(201).json({
      success: true,
      message: "Atividade agendada com sucesso!",
      atividadeId: newActId
    });
  } catch (error) {
    next(error);
  }
});

// --- TOGGLE ACTIVITY COMPLETION ---
router.put("/api/atividades/:id/concluir", verificarToken, donoAtividade, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { concluido } = req.body;
    const concluidoVal = concluido ? 1 : 0;

    const atividades = await db.executarQuery("SELECT * FROM lead_atividades WHERE id = ?", [id]);
    if (atividades.length === 0) {
      return res.status(404).json({ error: "Atividade não encontrada." });
    }

    const atividade = atividades[0];

    await db.executarQuery(
      "UPDATE lead_atividades SET concluido = ? WHERE id = ?",
      [concluidoVal, id]
    );

    // Log no histórico
    const statusTxt = concluidoVal === 1 ? "concluiu" : "reabriu";
    await db.executarQuery(
      "INSERT INTO lead_comentarios (lead_id, usuario_id, comentario, tipo, criado_em) VALUES (?, ?, ?, 'historico', NOW())",
      [atividade.lead_id, req.user.id, `${req.user.nome} ${statusTxt} a atividade "${atividade.tipo}"`]
    );

    res.json({ success: true, message: `Atividade marcada como ${concluidoVal === 1 ? 'concluída' : 'pendente'}!` });
  } catch (error) {
    next(error);
  }
});

// --- DELETE SCHEDULED ACTIVITY ---
router.delete("/api/atividades/:id", verificarToken, donoAtividade, async (req, res, next) => {
  try {
    const { id } = req.params;

    const atividades = await db.executarQuery("SELECT * FROM lead_atividades WHERE id = ?", [id]);
    if (atividades.length === 0) {
      return res.status(404).json({ error: "Atividade não encontrada." });
    }

    const atividade = atividades[0];
    await db.executarQuery("DELETE FROM lead_atividades WHERE id = ?", [id]);

    // Log no histórico
    await db.executarQuery(
      "INSERT INTO lead_comentarios (lead_id, usuario_id, comentario, tipo, criado_em) VALUES (?, ?, ?, 'historico', NOW())",
      [atividade.lead_id, req.user.id, `${req.user.nome} removeu a atividade agendada "${atividade.tipo}"`]
    );

    res.json({ success: true, message: "Atividade agendada excluída com sucesso!" });
  } catch (error) {
    next(error);
  }
});

// --- BULK IMPORT LEADS FROM CSV ---
router.post("/api/leads/importar", verificarToken, async (req, res, next) => {
  // Dentro do try: falha ao pegar conexão vira erro tratado, não promise rejeitada sem resposta
  let connection;
  try {
    connection = await db.getConnection();
    const { leadsList } = req.body;
    if (!leadsList || !Array.isArray(leadsList)) {
      return res.status(400).json({ error: "Payload inválido. É esperado uma lista de leads." });
    }

    // Valida cada linha com o mesmo schema do cadastro manual; linha sem nome (em branco) é ignorada
    const linhas = [];
    const invalidas = [];
    leadsList.forEach((bruto, indice) => {
      const nome = bruto && (bruto.nome_cliente || bruto.nome);
      if (!nome || String(nome).trim() === "") return;
      const validacao = leadSchema.safeParse({ ...bruto, nome_cliente: String(nome).trim() });
      if (validacao.success) linhas.push(validacao.data);
      else invalidas.push({ linha: indice + 1, erros: validacao.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) });
    });
    if (invalidas.length > 0) {
      return res.status(400).json({ error: `${invalidas.length} linha(s) inválida(s). Nada foi importado.`, invalidas });
    }

    await connection.beginTransaction();

    const importados = [];
    const criado_por = req.user.id;

    for (const lead of linhas) {
      const { nome_cliente, nome_clinica, email, telefone, origem, status, valor_estimado, cargo } = lead;

      // Comercial não escolhe vendedor: sem vendedor (ou Comercial) cai no Round-Robin
      let vendedor_id = req.user.role === "Comercial" ? null : lead.vendedor_id || null;
      let logAtribuicao = null;

      // Antes: rodízio por cache em memória que ignorava "recebe leads" e divergia da fila do cadastro manual
      if (!vendedor_id) {
        const vendedor = await proximoVendedorDaFila(connection);
        if (vendedor) {
          vendedor_id = vendedor.id;
          logAtribuicao = `Lead atribuído automaticamente via fila (Round-Robin) para o vendedor ${vendedor.nome}`;
        }
      }

      const [resIns] = await connection.execute(
        `INSERT INTO leads (
          nome_cliente, nome_clinica, email, telefone, origem, status,
          valor_estimado, cargo, criado_por, vendedor_id, criado_em, atualizado_em
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [nome_cliente, nome_clinica ?? "", email ?? "", telefone ?? "", origem ?? "Outro", status, valor_estimado, cargo ?? "", criado_por, vendedor_id]
      );

      const insId = resIns.insertId;

      await connection.execute(
        "INSERT INTO lead_comentarios (lead_id, usuario_id, comentario, tipo, criado_em) VALUES (?, ?, ?, 'historico', NOW())",
        [insId, criado_por, `Lead importado via CSV por ${req.user.nome}`]
      );

      if (logAtribuicao) {
        await connection.execute(
          "INSERT INTO lead_comentarios (lead_id, usuario_id, comentario, tipo, criado_em) VALUES (?, ?, ?, 'historico', NOW())",
          [insId, criado_por, logAtribuicao]
        );
      }

      importados.push(insId);
    }

    await connection.commit();

    // Enviar SSE
    notificationService.enviarNotificacao("leads_importados", {
      quantidade: importados.length,
      por: req.user.nome
    }, [req.user.id]);

    res.json({
      success: true,
      message: `${importados.length} leads importados com sucesso!`,
      count: importados.length
    });
  } catch (error) {
    await connection?.rollback().catch(() => {});
    next(error);
  } finally {
    connection?.release();
  }
});

// --- GET COMERCIAIS & FILA ROUND-ROBIN (Admin / Comercial) ---
router.get("/api/comerciais/fila", verificarToken, async (req, res, next) => {
  try {
    if (req.user.role !== "Diretor" && req.user.role !== "Comercial") {
      return res.status(403).json({ error: "Acesso negado. Apenas diretores e comerciais podem ver as configurações do CRM." });
    }

    const fila = await db.executarQuery(`
      SELECT 
        u.id, 
        u.nome, 
        u.email, 
        u.role, 
        u.telefone, 
        u.recebe_leads, 
        u.ultimo_lead_recebido_em,
        u.ativo,
        (SELECT COUNT(*) FROM leads l WHERE l.vendedor_id = u.id) AS total_leads
      FROM usuarios u
      WHERE u.role = 'Comercial' OR u.role = 'Diretor'
      ORDER BY u.nome ASC
    `);

    res.json(fila);
  } catch (error) {
    next(error);
  }
});

// --- UPDATE COMERCIAL FILA STATUS (Admin Only) ---
router.put("/api/comerciais/fila/:id", verificarToken, async (req, res, next) => {
  try {
    if (req.user.role !== "Diretor") {
      return res.status(403).json({ error: "Acesso negado." });
    }

    const { id } = req.params;
    const { recebe_leads } = req.body;

    if (recebe_leads === undefined) {
      return res.status(400).json({ error: "Parâmetro recebe_leads é obrigatório." });
    }

    const resUpdate = await db.executarQuery(
      "UPDATE usuarios SET recebe_leads = ? WHERE id = ?",
      [recebe_leads ? 1 : 0, id]
    );

    if (resUpdate.affectedRows === 0) {
      return res.status(404).json({ error: "Vendedor não encontrado." });
    }

    res.json({ success: true, message: "Status de recebimento de leads atualizado!" });
  } catch (error) {
    next(error);
  }
});

// --- GET CRM ETAPAS ---
router.get("/api/crm/etapas", verificarToken, async (req, res, next) => {
  try {
    const funil_id = req.query.funil_id || 1;
    const etapas = await db.executarQuery(
      "SELECT id, nome, cor, ordem, funil_id FROM crm_etapas WHERE ativo = 1 AND funil_id = ? ORDER BY ordem ASC, id ASC",
      [funil_id]
    );
    res.json(etapas);
  } catch (error) {
    next(error);
  }
});

// --- CREATE CRM ETAPA ---
router.post("/api/crm/etapas", verificarToken, verificarRole(["Diretor"]), async (req, res, next) => {
  try {
    const { nome, cor } = req.body;
    if (!nome) {
      return res.status(400).json({ error: "Nome da etapa é obrigatório." });
    }

    const funil_id = req.body.funil_id || 1;

    // Achar a maior ordem atual para colocar a nova etapa no fim da lista
    const rowMax = await db.executarQuery("SELECT MAX(ordem) AS max_ordem FROM crm_etapas WHERE ativo = 1 AND funil_id = ?", [funil_id]);
    const proximaOrdem = (rowMax && rowMax[0] && rowMax[0].max_ordem ? Number(rowMax[0].max_ordem) : 0) + 1;

    const resIns = await db.executarQuery(
      "INSERT INTO crm_etapas (nome, cor, ordem, ativo, funil_id) VALUES (?, ?, ?, 1, ?)",
      [nome.trim(), cor || "#94a3b8", proximaOrdem, funil_id]
    );

    res.json({
      success: true,
      message: "Etapa criada com sucesso.",
      id: resIns.insertId
    });
  } catch (error) {
    next(error);
  }
});

// --- UPDATE CRM ETAPA ---
router.put("/api/crm/etapas/:id", verificarToken, verificarRole(["Diretor"]), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nome, cor, ordem } = req.body;

    const queryPartes = [];
    const params = [];

    if (nome !== undefined) {
      queryPartes.push("nome = ?");
      params.push(nome.trim());
    }
    if (cor !== undefined) {
      queryPartes.push("cor = ?");
      params.push(cor.trim());
    }
    if (ordem !== undefined) {
      queryPartes.push("ordem = ?");
      params.push(Number(ordem));
    }

    if (queryPartes.length === 0) {
      return res.status(400).json({ error: "Nenhum dada fornecido para atualização." });
    }

    params.push(id);

    const resUpd = await db.executarQuery(
      `UPDATE crm_etapas SET ${queryPartes.join(", ")} WHERE id = ?`,
      params
    );

    if (resUpd.affectedRows === 0) {
      return res.status(404).json({ error: "Etapa não encontrada." });
    }

    res.json({ success: true, message: "Etapa atualizada com sucesso." });
  } catch (error) {
    next(error);
  }
});

// --- DELETE CRM ETAPA ---
router.delete("/api/crm/etapas/:id", verificarToken, verificarRole(["Diretor"]), async (req, res, next) => {
  try {
    const { id } = req.params;

    const resDel = await db.executarQuery(
      "UPDATE crm_etapas SET ativo = 0 WHERE id = ?",
      [id]
    );

    if (resDel.affectedRows === 0) {
      return res.status(404).json({ error: "Etapa não encontrada." });
    }

    res.json({ success: true, message: "Etapa removida com sucesso." });
  } catch (error) {
    next(error);
  }
});

// --- GET CRM PESQUISA CLIENTES (Autocomplete) ---
router.get("/api/crm/pesquisa-clientes", verificarToken, async (req, res, next) => {
  try {
    const { q } = req.query;
    // ?q=a&q=b chega como array
    if (typeof q !== "string" || q.trim().length < 2) {
      return res.json([]);
    }

    const busca = `%${q.trim().slice(0, 100)}%`;
    // Comercial só pesquisa os próprios leads (mesmo filtro da lista do CRM)
    const somenteProprios = req.user.role === "Comercial";
    const clientes = await db.executarQuery(
      `SELECT 
         nome_cliente, 
         nome_clinica, 
         email, 
         telefone, 
         origem, 
         cargo, 
         cadeiras, 
         faturamento, 
         valor_estimado
       FROM leads 
       WHERE (nome_cliente LIKE ? OR nome_clinica LIKE ?)
         ${somenteProprios ? "AND (vendedor_id = ? OR criado_por = ?)" : ""}
       ORDER BY id DESC LIMIT 10`,
      somenteProprios ? [busca, busca, req.user.id, req.user.id] : [busca, busca]
    );

    res.json(clientes);
  } catch (error) {
    next(error);
  }
});

module.exports = router;

const db = require("../config/db");
const loggerService = require("./loggerService");

let tabelaVerificada = false;

async function garantirTabelaLogs() {
  if (tabelaVerificada) return;
  try {
    await db.executarQuery(`
      CREATE TABLE IF NOT EXISTS proposta_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        proposta_id INT NOT NULL,
        usuario_id INT NULL,
        usuario_nome VARCHAR(255) NULL,
        usuario_role VARCHAR(50) NULL,
        acao VARCHAR(100) NOT NULL,
        titulo VARCHAR(255) NOT NULL,
        detalhes TEXT NULL,
        dados_anteriores_json LONGTEXT NULL,
        dados_novos_json LONGTEXT NULL,
        ip VARCHAR(50) NULL,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_proposta_logs_prop (proposta_id),
        INDEX idx_proposta_logs_acao (acao),
        INDEX idx_proposta_logs_criado (criado_em)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    tabelaVerificada = true;
  } catch (err) {
    console.warn("Aviso ao verificar tabela proposta_logs:", err.message);
  }
}

// Auto-inicializar ao carregar o serviço
garantirTabelaLogs().catch(() => {});

/**
 * Registra um evento de auditoria no histórico da proposta
 */
async function registrarLogProposta({
  proposta_id,
  usuario_id = null,
  usuario_nome = null,
  usuario_role = null,
  acao,
  titulo,
  detalhes = null,
  dados_anteriores = null,
  dados_novos = null,
  ip = null
}) {
  try {
    await garantirTabelaLogs();

    const antJson = dados_anteriores
      ? (typeof dados_anteriores === "string" ? dados_anteriores : JSON.stringify(dados_anteriores))
      : null;
    const novJson = dados_novos
      ? (typeof dados_novos === "string" ? dados_novos : JSON.stringify(dados_novos))
      : null;

    const [res] = await db.execute(
      `INSERT INTO proposta_logs (
        proposta_id, usuario_id, usuario_nome, usuario_role, acao, titulo,
        detalhes, dados_anteriores_json, dados_novos_json, ip, criado_em
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        proposta_id,
        usuario_id,
        usuario_nome || (usuario_role === "Cliente" ? "Cliente (Portal)" : "Sistema"),
        usuario_role || "Sistema",
        acao,
        titulo,
        detalhes,
        antJson,
        novJson,
        ip
      ]
    );

    loggerService.registrarLog(
      "info",
      "AuditoriaProposta",
      `[Proposta #${proposta_id}] ${titulo} (${usuario_nome || usuario_role || "Sistema"})`,
      { acao, detalhes }
    );

    return res ? res.insertId : null;
  } catch (err) {
    console.error(`Erro ao registrar log de proposta #${proposta_id}:`, err.message);
    return null;
  }
}

/**
 * Retorna o histórico completo de logs de uma proposta (incluindo observações e eventos legados)
 */
async function obterLogsProposta(propostaId) {
  await garantirTabelaLogs();

  // 1. Logs da tabela proposta_logs
  const logs = await db.executarQuery(
    `SELECT 
      id, proposta_id, usuario_id, usuario_nome, usuario_role, acao, titulo,
      detalhes, dados_anteriores_json, dados_novos_json, ip, criado_em
    FROM proposta_logs
    WHERE proposta_id = ?
    ORDER BY criado_em DESC, id DESC`,
    [propostaId]
  );

  // 2. Observações manuais legadas da proposta (se houver alguma não registrada em proposta_logs)
  const observacoes = await db.executarQuery(
    `SELECT 
      o.id, o.proposta_id, o.usuario_id, u.nome AS usuario_nome, u.role AS usuario_role,
      'OBSERVACAO' AS acao, 'Observação Comercial' AS titulo,
      o.observacao AS detalhes, NULL AS dados_anteriores_json, NULL AS dados_novos_json,
      NULL AS ip, o.criado_em
    FROM proposta_observacoes o
    LEFT JOIN usuarios u ON o.usuario_id = u.id
    WHERE o.proposta_id = ?
    ORDER BY o.criado_em DESC`,
    [propostaId]
  ).catch(() => []);

  // 3. Solicitações de desconto associadas
  const descontos = await db.executarQuery(
    `SELECT 
      s.id, s.proposta_id, s.solicitante_id AS usuario_id, u.nome AS usuario_nome,
      'Comercial' AS usuario_role, 'DESCONTO_SOLICITADO' AS acao,
      CONCAT('Solicitação de Desconto (', s.status, ')') AS titulo,
      CONCAT('Desconto: ', s.percentual_desconto, '% - Motivo: ', COALESCE(s.motivo, 'Sem justificativa')) AS detalhes,
      NULL AS dados_anteriores_json, NULL AS dados_novos_json, NULL AS ip, s.criado_em
    FROM solicitacoes_desconto_item s
    LEFT JOIN usuarios u ON s.solicitante_id = u.id
    WHERE s.proposta_id = ?
    ORDER BY s.criado_em DESC`,
    [propostaId]
  ).catch(() => []);

  // Mesclar registros, evitando duplicatas com texto idêntico
  const mapaUnico = new Set();
  const resultado = [];

  for (const log of logs) {
    const chave = `${log.acao}-${log.criado_em ? new Date(log.criado_em).getTime() : ''}-${(log.detalhes || '').slice(0, 30)}`;
    mapaUnico.add(chave);
    resultado.push(formatarLog(log));
  }

  for (const obs of observacoes) {
    const chave = `${obs.acao}-${obs.criado_em ? new Date(obs.criado_em).getTime() : ''}-${(obs.detalhes || '').slice(0, 30)}`;
    if (!mapaUnico.has(chave)) {
      mapaUnico.add(chave);
      resultado.push(formatarLog(obs));
    }
  }

  for (const desc of descontos) {
    const chave = `${desc.acao}-${desc.criado_em ? new Date(desc.criado_em).getTime() : ''}-${(desc.detalhes || '').slice(0, 30)}`;
    if (!mapaUnico.has(chave)) {
      mapaUnico.add(chave);
      resultado.push(formatarLog(desc));
    }
  }

  // Ordenar cronologicamente do mais recente para o mais antigo
  resultado.sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));

  return resultado;
}

/**
 * Retorna logs globais de propostas com filtros (para Diretor / Admin)
 */
async function obterLogsGlobais({ limite = 100, offset = 0, proposta_id, acao, usuario_id, busca } = {}) {
  await garantirTabelaLogs();

  const condicoes = [];
  const params = [];

  if (proposta_id) {
    condicoes.push("l.proposta_id = ?");
    params.push(proposta_id);
  }

  if (acao && acao !== "todos") {
    condicoes.push("l.acao = ?");
    params.push(acao);
  }

  if (usuario_id) {
    condicoes.push("l.usuario_id = ?");
    params.push(usuario_id);
  }

  if (busca && busca.trim()) {
    const termo = `%${busca.trim()}%`;
    condicoes.push("(p.numero_proposta LIKE ? OR p.nome_clinica LIKE ? OR l.usuario_nome LIKE ? OR l.titulo LIKE ? OR l.detalhes LIKE ?)");
    params.push(termo, termo, termo, termo, termo);
  }

  const whereSql = condicoes.length > 0 ? `WHERE ${condicoes.join(" AND ")}` : "";

  // Contagem total
  const [totalRow] = await db.executarQuery(
    `SELECT COUNT(*) AS total
     FROM proposta_logs l
     LEFT JOIN propostas p ON l.proposta_id = p.id
     ${whereSql}`,
    params
  );

  const total = totalRow ? totalRow.total : 0;

  // Consulta paginada com dados da proposta
  const limiteNum = Math.min(Math.max(parseInt(limite, 10) || 50, 1), 200);
  const offsetNum = Math.max(parseInt(offset, 10) || 0, 0);

  const sql = `
    SELECT 
      l.id, l.proposta_id, l.usuario_id, l.usuario_nome, l.usuario_role, l.acao, l.titulo,
      l.detalhes, l.dados_anteriores_json, l.dados_novos_json, l.ip, l.criado_em,
      p.numero_proposta, p.nome_clinica, p.empresa_proposta, p.valor_total, p.status AS proposta_status
    FROM proposta_logs l
    LEFT JOIN propostas p ON l.proposta_id = p.id
    ${whereSql}
    ORDER BY l.criado_em DESC, l.id DESC
    LIMIT ${limiteNum} OFFSET ${offsetNum}
  `;

  const rows = await db.executarQuery(sql, params);

  return {
    total,
    limite: limiteNum,
    offset: offsetNum,
    logs: rows.map(formatarLog)
  };
}

function formatarLog(log) {
  let dadosAnteriores = null;
  let dadosNovos = null;

  try {
    if (log.dados_anteriores_json) dadosAnteriores = JSON.parse(log.dados_anteriores_json);
  } catch (e) {
    dadosAnteriores = log.dados_anteriores_json;
  }

  try {
    if (log.dados_novos_json) dadosNovos = JSON.parse(log.dados_novos_json);
  } catch (e) {
    dadosNovos = log.dados_novos_json;
  }

  return {
    id: log.id,
    proposta_id: log.proposta_id,
    numero_proposta: log.numero_proposta || null,
    nome_clinica: log.nome_clinica || null,
    empresa_proposta: log.empresa_proposta || null,
    proposta_status: log.proposta_status || null,
    usuario_id: log.usuario_id,
    usuario_nome: log.usuario_nome || "Sistema",
    usuario_role: log.usuario_role || "Sistema",
    acao: log.acao,
    titulo: log.titulo,
    detalhes: log.detalhes,
    dados_anteriores: dadosAnteriores,
    dados_novos: dadosNovos,
    ip: log.ip,
    criado_em: log.criado_em
  };
}

module.exports = {
  garantirTabelaLogs,
  registrarLogProposta,
  obterLogsProposta,
  obterLogsGlobais
};

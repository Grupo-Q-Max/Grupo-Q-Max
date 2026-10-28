const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { verificarToken, verificarRole } = require("../middleware/auth");
const relatorioService = require("../services/relatorioService");
const notificationService = require("../services/notificationService");
const teamsService = require("../services/teamsService");
const { linkCurto } = require("../services/proposalHelpers");

/**
 * 📊 DISPARO DO RELATÓRIO EXECUTIVO DIÁRIO
 * Endpoint: POST /api/relatorios/executivo-diario
 */
router.post("/api/relatorios/executivo-diario", verificarToken, verificarRole(["Diretor"]), async (req, res, next) => {
  try {
    const resultado = await relatorioService.enviarResumoExecutivoDiario();
    res.json(resultado);
  } catch (error) {
    next(error);
  }
});

/**
 * 🔥 ALERTA DE LEITURA QUENTE (HOT LEAD ALERT BOT)
 * Disparado quando o cliente está lendo a proposta ativamente na tela
 * Endpoint: POST /api/propostas/:token/alerta-quente
 */
// Rota pública: um alerta por proposta a cada 10 min, senão qualquer um com o link enche Teams e SSE
// ponytail: memória do processo (PM2 fork, 1 instância); vai para o banco se houver mais instâncias
const ultimoAlertaQuente = new Map();
const INTERVALO_ALERTA_QUENTE_MS = 10 * 60 * 1000;

router.post("/api/propostas/:token/alerta-quente", async (req, res, next) => {
  try {
    const { token } = req.params;
    const agora = Date.now();
    if (agora - (ultimoAlertaQuente.get(token) || 0) < INTERVALO_ALERTA_QUENTE_MS) {
      return res.json({ success: true, message: "Alerta já enviado recentemente." });
    }
    for (const [t, quando] of ultimoAlertaQuente) {
      if (agora - quando >= INTERVALO_ALERTA_QUENTE_MS) ultimoAlertaQuente.delete(t);
    }
    const rows = await db.executarQuery(`
      SELECT p.*, u.nome AS vendedor_nome, u.email AS vendedor_email,
        (SELECT COUNT(*) FROM proposta_visualizacoes v WHERE v.proposta_id = p.id) AS visualizacoes
      FROM propostas p
      LEFT JOIN usuarios u ON p.criado_por = u.id
      WHERE p.token_acesso = ?
      LIMIT 1
    `, [token]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Proposta não encontrada." });
    }

    const p = rows[0];
    ultimoAlertaQuente.set(token, agora);
    const moedaFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
    const valorFmt = moedaFmt.format(p.valor_total);

    // Disparar evento SSE em tempo real para os consultores logados
    notificationService.enviarNotificacao("leitura_quente_alerta", {
      proposta_id: p.id,
      numero_proposta: p.numero_proposta,
      clinica: p.nome_clinica,
      cliente: p.nome_socio,
      valor: valorFmt,
      vendedor: p.vendedor_nome,
      telefone_cliente: p.telefone,
      link: linkCurto(p.token_acesso)
    }, [p.criado_por]);

    // Disparar alerta no Microsoft Teams
    if (typeof teamsService.enviarNotificacaoTeams === "function") {
      teamsService.enviarNotificacaoTeams("reaberta", {
        numeroProposta: p.numero_proposta,
        nomeClinica: p.nome_clinica,
        nomeSocio: p.nome_socio,
        telefone: p.telefone,
        tipoProposta: p.tipo_proposta || "FINORA",
        totalVisualizacoes: Number(p.visualizacoes || 1)
      }).catch(() => {});
    }

    console.log(`[Hot Lead Alert] Alerta de leitura ativa disparado para Proposta #${p.numero_proposta} (${p.nome_clinica})`);

    res.json({ success: true, message: "Alerta de leitura quente processado." });
  } catch (error) {
    next(error);
  }
});

/**
 * ⚡ SOLICITAR REATIVAÇÃO DE PROPOSTA EXPIRADA
 * Endpoint: POST /api/propostas/:token/reativar
 */
router.post("/api/propostas/:token/reativar", async (req, res, next) => {
  try {
    // Lock na linha: dois cliques simultâneos não passam os dois pela checagem de "uma vez só"
    const p = await db.transacao(async (conexao) => {
      const [rows] = await conexao.query(
        "SELECT * FROM propostas WHERE token_acesso = ? LIMIT 1 FOR UPDATE",
        [req.params.token]
      );
      const proposta = rows[0];
      if (!proposta) return { erro: 404, mensagem: "Proposta não encontrada." };

      // Só reativa proposta em aberto/expirada; recusada ou aprovada não volta para Pendente pelo link do cliente
      if (!["Pendente", "Expirada"].includes(proposta.status)) {
        return { erro: 409, mensagem: "Esta proposta não pode ser reativada. Fale com seu consultor." };
      }
      // Cliente reativa uma vez; depois disso só o consultor
      if (proposta.reativada_pelo_cliente_em) {
        return { erro: 409, mensagem: "Esta condição comercial já foi reativada uma vez. Fale com seu consultor para revalidá-la." };
      }

      // Renovar proposta para Pendente e atualizar data para hoje
      await conexao.query(
        "UPDATE propostas SET status = 'Pendente', data_proposta = CURDATE(), reativada_pelo_cliente_em = NOW(), validade_inicia_em = NOW() WHERE id = ?",
        [proposta.id]
      );

      // Registrar histórico
      await conexao.query(
        "INSERT INTO proposta_observacoes (proposta_id, usuario_id, observacao, criado_em) VALUES (?, ?, ?, NOW())",
        [proposta.id, proposta.criado_por || 1, `Solicitação de reativação de proposta recebida do cliente. Condição comercial revalidada.`]
      );
      return proposta;
    });

    if (p.erro) return res.status(p.erro).json({ success: false, error: p.mensagem });

    const [vendedor] = await db.executarQuery("SELECT nome FROM usuarios WHERE id = ?", [p.criado_por]);
    notificationService.enviarNotificacao("proposta_reativada", {
      proposta_id: p.id,
      numero_proposta: p.numero_proposta,
      clinica: p.nome_clinica,
      vendedor: vendedor ? vendedor.nome : null
    }, [p.criado_por]);

    res.json({
      success: true,
      message: "Proposta comercial reativada com sucesso! A tabela com desconto foi revalidada."
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

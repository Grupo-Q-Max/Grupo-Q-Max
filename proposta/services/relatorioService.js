const db = require("../config/db");

class RelatorioService {
  /**
   * Consolida e envia o Resumo Executivo Diário para os Diretores e Microsoft Teams
   */
  async enviarResumoExecutivoDiario() {
    try {
      const hoje = new Date().toISOString().split("T")[0];

      // 1. Propostas Criadas Hoje
      const [criadasHoje] = await db.executarQuery(`
        SELECT COUNT(*) AS total, COALESCE(SUM(valor_total), 0) AS valor
        FROM propostas 
        WHERE DATE(criado_em) = CURDATE()
      `);

      // 2. Propostas Fechadas Hoje
      const [fechadasHoje] = await db.executarQuery(`
        SELECT COUNT(*) AS total, COALESCE(SUM(valor_total), 0) AS valor
        FROM propostas 
        WHERE status = 'Aprovada' AND DATE(data_decisao) = CURDATE()
      `);

      // 3. Propostas Quentes Pendentes (com visualizações)
      const propostasQuentes = await db.executarQuery(`
        SELECT p.numero_proposta, p.nome_clinica, p.valor_total, u.nome AS vendedor, COUNT(v.id) AS visualizacoes
        FROM propostas p
        LEFT JOIN usuarios u ON p.criado_por = u.id
        LEFT JOIN proposta_visualizacoes v ON p.id = v.proposta_id
        WHERE p.status = 'Pendente'
        GROUP BY p.id
        HAVING visualizacoes > 0
        ORDER BY visualizacoes DESC, p.criado_em DESC
        LIMIT 3
      `);

      // 4. Performance por Vendedor
      const rankingVendedores = await db.executarQuery(`
        SELECT u.nome, COUNT(p.id) AS total_propostas, 
               SUM(CASE WHEN p.status = 'Aprovada' THEN 1 ELSE 0 END) AS fechadas,
               COALESCE(SUM(CASE WHEN p.status = 'Aprovada' THEN p.valor_total ELSE 0 END), 0) AS mrr_ganho
        FROM usuarios u
        LEFT JOIN propostas p ON u.id = p.criado_por AND DATE(p.criado_em) = CURDATE()
        WHERE u.ativo = 1 AND u.role IN ('Comercial', 'Diretor')
        GROUP BY u.id
        ORDER BY mrr_ganho DESC, total_propostas DESC
      `);

      const moedaFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
      const totalCriadas = criadasHoje?.total || 0;
      const valorCriadas = moedaFmt.format(criadasHoje?.valor || 0);
      const totalFechadas = fechadasHoje?.total || 0;
      const valorFechadas = moedaFmt.format(fechadasHoje?.valor || 0);

      let listaQuentesTexto = propostasQuentes.map(p => `• *${p.nome_clinica}* (Prop #${p.numero_proposta}) - ${moedaFmt.format(p.valor_total)}/mês [${p.visualizacoes} views | ${p.vendedor}]`).join("\n") || "Nenhuma proposta pendente no momento.";

      const mensagemResumo = `📊 *RESUMO EXECUTIVO DIÁRIO - FINORA*\n📅 *Data:* ${new Date().toLocaleDateString("pt-BR")}\n\n` +
        `💼 *Propostas Geradas Hoje:* ${totalCriadas} (${valorCriadas})\n` +
        `✍️ *Contratos Fechados Hoje:* ${totalFechadas} (${valorFechadas} MRR)\n\n` +
        `🔥 *Top Propostas Quentes em Negociação:*\n${listaQuentesTexto}\n\n` +
        `👉 Acesse o Dashboard Completo: ${process.env.BASE_URL || 'http://localhost:3005'}/proposta/dashboard.html`;

      
      console.log("[Relatório Diário] Resumo Executivo consolidado com sucesso!");

      return {
        success: true,
        data: hoje,
        resumo: {
          propostasCriadasHoje: totalCriadas,
          valorCriadasHoje: valorCriadas,
          contratosFechadosHoje: totalFechadas,
          mrrFechadoHoje: valorFechadas,
          propostasQuentes,
          rankingVendedores
        },
        mensagem: mensagemResumo
      };
    } catch (err) {
      console.error("[Relatório Diário] Erro ao consolidar resumo:", err);
      return { success: false, error: err.message };
    }
  }
}

module.exports = new RelatorioService();

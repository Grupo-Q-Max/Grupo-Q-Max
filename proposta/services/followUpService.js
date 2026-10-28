const db = require("../config/db");
const whatsappService = require("./whatsappService");
const notificationService = require("./notificationService");
const { linkCurto, DIAS_VALIDADE } = require("./proposalHelpers");

class FollowUpService {
  /**
   * Executa a varredura da régua de follow-up em todas as propostas pendentes
   * (tabela proposta_followups criada pela migration 20261015120000)
   */
  async processarReguaFollowUp() {
    // Varredura a cada 15 min: se a anterior ainda roda (WhatsApp lento), a nova pegaria as mesmas propostas e mandaria em dobro
    // ponytail: trava em memória, vale com PM2 fork de 1 instância; com várias instâncias usar lock no banco
    if (this.rodando) return { ignorado: "varredura anterior em andamento" };
    this.rodando = true;
    try {
      // Só propostas em aberto e dentro da validade de 10 dias: vencida não recebe mais mensagem
      const propostas = await db.executarQuery(`
        SELECT 
          p.id, p.numero_proposta, p.nome_clinica, p.nome_socio, p.email, p.telefone,
          p.valor_total, p.token_acesso, p.empresa_proposta, p.tipo_proposta, p.faturamento,
          -- Prazos contam do início da validade atual (reativação do cliente ou renovação do consultor)
          COALESCE(p.validade_inicia_em, p.criado_em) AS criado_em,
          p.criado_por, u.nome AS vendedor_nome, u.email AS vendedor_email,
          COUNT(v.id) AS total_visualizacoes,
          MAX(v.visualizado_em) AS ultima_visualizacao
        FROM propostas p
        LEFT JOIN usuarios u ON p.criado_por = u.id
        LEFT JOIN proposta_visualizacoes v ON p.id = v.proposta_id
        WHERE p.status = 'Pendente' 
          AND COALESCE(p.validade_inicia_em, p.criado_em) >= DATE_SUB(NOW(), INTERVAL ${DIAS_VALIDADE} DAY)
        GROUP BY p.id
      `);

      if (!propostas || propostas.length === 0) return { totalAnalisadas: 0, disparosRealizados: 0 };

      let disparos = 0;
      const agora = new Date();

      for (const p of propostas) {
        // Erro em uma proposta (ex.: WhatsApp fora) não interrompe o lote
        try {
          disparos += await this.processarProposta(p, agora);
        } catch (err) {
          console.error(`[FollowUp Engine] Erro na proposta #${p.numero_proposta}:`, err.message);
        }
      }

      return { totalAnalisadas: propostas.length, disparosRealizados: disparos };
    } catch (err) {
      console.error("[FollowUp Engine] Erro ao processar régua:", err);
      return { erro: err.message };
    } finally {
      this.rodando = false;
    }
  }

  async processarProposta(p, agora) {
    const criadoEm = new Date(p.criado_em);
    const horasDesdeCriacao = (agora - criadoEm) / (1000 * 60 * 60);
    const totalVis = Number(p.total_visualizacoes || 0);
    const link = linkCurto(p.token_acesso);
    const nomeCliente = p.nome_socio || p.nome_clinica || "Doutor(a)";
    const clinica = p.nome_clinica || "sua clínica";
    const etapas = [];

    // 1. ETAPA 1: 24h sem visualização (Proposta não aberta)
    if (horasDesdeCriacao >= 24 && totalVis === 0) {
      etapas.push(["24h_sem_abertura", this.dispararLembreteNaoAberta]);
    }

    // 2. ETAPA 2: 48h após visualização sem assinatura (Lead Engajado que esfriou)
    if (totalVis > 0 && p.ultima_visualizacao) {
      const horasDesdeUltimaVis = (agora - new Date(p.ultima_visualizacao)) / (1000 * 60 * 60);
      if (horasDesdeUltimaVis >= 48) etapas.push(["48h_pos_abertura_fator_r", this.dispararDestaqueFatorR]);
    }

    // 3. ETAPA 3: no 9º dia, véspera do fim da validade de 10 dias (antes saía no 6º dia dizendo "expira em 24h")
    if (horasDesdeCriacao >= (DIAS_VALIDADE - 1) * 24 && horasDesdeCriacao < DIAS_VALIDADE * 24) {
      etapas.push(["aviso_expiracao_9d", this.dispararAvisoExpiracao]);
    }

    let disparos = 0;
    for (const [tipoEtapa, disparar] of etapas) {
      if (await this.verificarSeEnviado(p.id, tipoEtapa)) continue;
      const enviado = await disparar.call(this, p, link, nomeCliente, clinica);
      // Só registra quando a mensagem saiu; sem telefone ou com falha, tenta de novo na próxima varredura
      if (!enviado) continue;
      await this.registrarDisparo(p.id, tipoEtapa, "whatsapp", p.telefone);
      disparos++;
    }
    return disparos;
  }

  async enviarWhatsApp(telefone, msg) {
    if (!telefone) return false;
    const resultado = await whatsappService.enviarMensagemTexto(telefone, msg);
    return Boolean(resultado && resultado.sucesso);
  }

  async verificarSeEnviado(propostaId, tipoEtapa) {
    const rows = await db.executarQuery(
      "SELECT id FROM proposta_followups WHERE proposta_id = ? AND tipo_etapa = ? LIMIT 1",
      [propostaId, tipoEtapa]
    );
    return rows.length > 0;
  }

  async registrarDisparo(propostaId, tipoEtapa, canal, destinatario) {
    await db.executarQuery(
      "INSERT INTO proposta_followups (proposta_id, tipo_etapa, canal, destinatario, sucesso, enviado_em) VALUES (?, ?, ?, ?, 1, NOW())",
      [propostaId, tipoEtapa, canal, destinatario]
    );
  }

  async dispararLembreteNaoAberta(p, link, nomeCliente, clinica) {
    const msg = `Olá, ${nomeCliente}! Tudo bem?\n\nPassando para confirmar se você conseguiu acessar a proposta comercial personalizada da *${clinica}* que preparamos com condições especiais de gestão fiscal.\n\n🔗 Você pode acessar com 1 clique aqui: ${link}\n\nFicou com alguma dúvida sobre o escopo ou enquadramento? Estou à disposição!`;
    const enviado = await this.enviarWhatsApp(p.telefone, msg);
    if (enviado) {
      notificationService.enviarNotificacao("followup_enviado", {
        proposta_id: p.id,
        tipo: "24h_sem_abertura",
        cliente: clinica,
        vendedor: p.vendedor_nome
      }, [p.criado_por]);
    }
    return enviado;
  }

  async dispararDestaqueFatorR(p, link, nomeCliente, clinica) {
    // Economia estimada da própria clínica (faturamento anual × diferença 13,3% → 6,0%); antes era "R$ 35.000" fixo para todos
    const economiaAnual = Number(p.faturamento || 0) * (0.133 - 0.06);
    const trechoEconomia = economiaAnual > 0
      ? `, com economia estimada de *${economiaAnual.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} por ano* para sua clínica`
      : "";
    const msg = `Olá, ${nomeCliente}! Notei que você analisou nossa proposta para a *${clinica}*.\n\nQuero reforçar que trabalhamos a redução tributária de *13,3% para 6,0% via Fator R* com total blindagem fiscal pelo CRC${trechoEconomia}.\n\n✍️ Você pode assinar e garantir essa condição diretamente no link: ${link}\n\nPodemos alinhar o início da implantação esta semana?`;
    return this.enviarWhatsApp(p.telefone, msg);
  }

  async dispararAvisoExpiracao(p, link, nomeCliente, clinica) {
    const msg = `⚠️ *Último aviso de validade da condição comercial* - ${clinica}\n\nOlá, ${nomeCliente}! A condição comercial exclusiva apresentada na Proposta #${p.numero_proposta} vence amanhã.\n\nPara manter a isenção de taxa de implantação e a tabela de honorários com desconto, basta aprovar digitalmente no link:\n🔗 ${link}\n\nQualquer ajuste que precisar, me avise agora mesmo!`;
    return this.enviarWhatsApp(p.telefone, msg);
  }
}

module.exports = new FollowUpService();

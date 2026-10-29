const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { verificarToken, verificarRole } = require("../middleware/auth");
const { responderSolicitacaoSchema, alterarDescontoSchema } = require("../validations/solicitacaoValidation");
const notificationService = require("../services/notificationService");
const {
  enviarEmailLink,
} = require("../services/emailService");
const {
  buscarTopicosPdfPorItens,
  criarPropostaFilhaComDesconto,
  gerarMidiaESenharProposta,
  linkCurto,
  extrairBaseUrl,
  lerJson
} = require("../services/proposalHelpers");
const { gerarPDFProposta } = require("../services/pdfService");
const path = require("path");
const fs = require("fs");

const pdfFolder = path.join(__dirname, "../storage/propostas_pdf");

// --- GET SOLICITACOES ---
router.get(
  "/api/solicitacoes",
  verificarToken,
  verificarRole(["Diretor"]),
  async (req, res, next) => {
    try {
      const solicitacoes = await db.executarQuery(`
        SELECT 
          'global' AS tipo_solicitacao,
          s.id,
          s.proposta_id,
          s.solicitado_por,
          s.percentual_solicitado,
          s.justificativa,
          s.status,
          s.aprovado_por,
          s.data_resposta,
          s.data_solicitacao AS criado_em,
          p.numero_proposta, p.nome_clinica, p.razao_social, p.cnpj, 
          p.nome_socio, p.cpf_socio, p.email, p.telefone, p.endereco_clinica, 
          p.cadeiras, p.funcionarios, p.socios, p.faturamento, p.regime_fiscal, 
          p.regime_hibrido, p.distancia_km, p.metragem, p.valor_total, p.itens_json, 
          p.token_acesso,
          u.nome AS vendedor
        FROM solicitacoes_desconto s
        JOIN propostas p ON s.proposta_id = p.id
        JOIN usuarios u ON s.solicitado_por = u.id
        WHERE s.status = 'Pendente'

        UNION ALL

        SELECT 
          'item' AS tipo_solicitacao,
          s.id,
          s.proposta_id,
          s.solicitado_por,
          ROUND(((pai.valor_total - p.valor_total) / pai.valor_total) * 100, 2) AS percentual_solicitado,
          s.justificativa,
          s.status,
          s.aprovado_por,
          s.data_resposta,
          s.data_solicitacao AS criado_em,
          p.numero_proposta, p.nome_clinica, p.razao_social, p.cnpj, 
          p.nome_socio, p.cpf_socio, p.email, p.telefone, p.endereco_clinica, 
          p.cadeiras, p.funcionarios, p.socios, p.faturamento, p.regime_fiscal, 
          p.regime_hibrido, p.distancia_km, p.metragem, p.valor_total, p.itens_json, 
          p.token_acesso,
          u.nome AS vendedor
        FROM solicitacoes_desconto_item s
        JOIN propostas p ON s.proposta_id = p.id
        -- LEFT: proposta nova acima da alçada não tem pai e também precisa aparecer para o Diretor
        LEFT JOIN propostas pai ON p.proposta_pai_id = pai.id
        JOIN usuarios u ON s.solicitado_por = u.id
        WHERE s.status = 'Pendente'
        ORDER BY criado_em DESC
      `);
      // Sem pai: maior desconto real por item (gravado pelo servidor em itens_json na criação)
      for (const s of solicitacoes) {
        if (s.tipo_solicitacao === "item" && s.percentual_solicitado === null) {
          s.percentual_solicitado = Math.max(0, ...lerJson(s.itens_json).map((i) => Number(i.descontoPercentual || 0)));
        }
      }
      res.json(solicitacoes);
    } catch (error) {
      next(error);
    }
  },
);

// --- PUT ALTERAR ---
router.put(
  "/api/solicitacoes/:id/alterar",
  verificarToken,
  verificarRole(["Diretor"]),
  async (req, res, next) => {
    try {
      const parsed = alterarDescontoSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Percentual inválido.", detalhes: parsed.error.issues });
      }

      const percentualNum = parsed.data.percentual;

      const [result] = await db.execute(
        // Só pedido ainda pendente: alterar um já respondido mudaria o histórico da decisão
        `UPDATE solicitacoes_desconto SET percentual_solicitado = ? WHERE id = ? AND status = 'Pendente'`,
        [percentualNum, req.params.id],
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Solicitação não encontrada ou já respondida." });
      }

      return res.json({
        success: true,
        message: "Percentual de desconto alterado com sucesso!",
      });
    } catch (error) {
      next(error);
    }
  },
);

// --- POST RESPONDER --- (With Transaction)
router.post(
  "/api/solicitacoes/:id/responder",
  verificarToken,
  verificarRole(["Diretor"]),
  async (req, res, next) => {
    // Dentro do try: falha ao pegar conexão vira erro tratado, não promise rejeitada sem resposta
    let connection;
    try {
      connection = await db.getConnection();
      const parsed = responderSolicitacaoSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Ação inválida.", detalhes: parsed.error.issues });
      }

      const { acao, tipo } = parsed.data;

      await connection.beginTransaction();

      if (tipo === "item") {
        const sols = await connection.execute(
          "SELECT * FROM solicitacoes_desconto_item WHERE id = ? FOR UPDATE",
          [req.params.id]
        ).then(([r]) => r);
        if (sols.length === 0) {
          await connection.rollback();
          return res.status(404).json({ error: "Solicitação de item não encontrada." });
        }

        const solicitacao = sols[0];
        if (solicitacao.status !== "Pendente") {
          await connection.rollback();
          return res.status(409).json({ error: `Solicitação já respondida (${solicitacao.status}).` });
        }
        const props = await connection.execute(
          "SELECT * FROM propostas WHERE id = ? FOR UPDATE",
          [solicitacao.proposta_id]
        ).then(([r]) => r);
        const proposta = props.length > 0 ? props[0] : null;

        if (!proposta) {
          await connection.rollback();
          return res.status(404).json({ error: "Proposta associada não encontrada." });
        }

        if (acao === "Aprovar") {
          await connection.execute(
            `UPDATE propostas SET status = 'Pendente' WHERE id = ?`,
            [proposta.id],
          );

          await connection.execute(
            `UPDATE solicitacoes_desconto_item SET status = 'Aprovada', aprovado_por = ?, data_resposta = NOW() WHERE id = ?`,
            [req.user.id, solicitacao.id],
          );

          await connection.commit();

          // Aprovação já gravada: falha de PDF/e-mail não pode virar 500 (o retry aprovaria de novo)
          let emailEnviado = false;
          try {
          const topicosPdf = await buscarTopicosPdfPorItens(lerJson(proposta.itens_json));
          const itens = lerJson(proposta.itens_json);
          const totalMensal = itens.reduce((acc, item) => {
            const obs = (item.observacao || "").toLowerCase();
            const ehPontual = obs.includes("pontual") || obs.includes("taxas") || obs.includes("emissão") || obs.includes("renovação") || obs.includes("implanta");
            return ehPontual ? acc : acc + Number(item.valor || 0);
          }, 0);
          const totalPontual = itens.reduce((acc, item) => {
            const obs = (item.observacao || "").toLowerCase();
            const ehPontual = obs.includes("pontual") || obs.includes("taxas") || obs.includes("emissão") || obs.includes("renovação") || obs.includes("implanta");
            return ehPontual ? acc + Number(item.valor || 0) : acc;
          }, 0);

          let dataFormatadaStr = proposta.data_proposta;
          if (proposta.data_proposta instanceof Date) {
            const d = proposta.data_proposta;
            dataFormatadaStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          }

          const dadosNovaProposta = {
            numeroProposta: proposta.numero_proposta,
            dataProposta: dataFormatadaStr,
            nomeClinica: proposta.nome_clinica,
            razaoSocial: proposta.razao_social,
            cnpj: proposta.cnpj,
            nomeSocio: proposta.nome_socio,
            cpfSocio: proposta.cpf_socio,
            email: proposta.email,
            telefone: proposta.telefone,
            enderecoClinica: proposta.endereco_clinica,
            cadeiras: proposta.cadeiras,
            funcionarios: proposta.funcionarios,
            socios: proposta.socios,
            faturamento: proposta.faturamento,
            regimeFiscal: proposta.regime_fiscal,
            regimeHibrido: proposta.regime_hibrido,
            distanciaKm: proposta.distancia_km,
            metragem: proposta.metragem,
            totalMensal,
            totalPontual,
            total: Number(proposta.valor_total || 0),
            itens,
            topicosPdf,
            justificativaDesconto: solicitacao.justificativa || "",
          };

          const pdfBuffer = await gerarPDFProposta({ ...dadosNovaProposta, tokenAcesso: proposta.token_acesso });
          const pdfPath = path.join(pdfFolder, `${proposta.token_acesso}.pdf`);
          fs.writeFileSync(pdfPath, pdfBuffer);

          const linkAcesso = linkCurto(proposta.token_acesso, req);
          dadosNovaProposta.baseUrl = extrairBaseUrl(req);

          // Apenas enviar e-mail tradicional com link de acesso para visualização.
          // O contrato D4Sign será gerado na aprovação do cliente.
          emailEnviado = Boolean(await enviarEmailLink(dadosNovaProposta, linkAcesso));
          } catch (erroPosAprovacao) {
            console.error("Desconto por item aprovado, mas falhou PDF/e-mail:", erroPosAprovacao);
          }

          notificationService.enviarNotificacao("desconto_respondido", {
            id: solicitacao.id,
            propostaId: solicitacao.proposta_id,
            numeroProposta: proposta.numero_proposta,
            nomeClinica: proposta.nome_clinica,
            tipoProposta: proposta.tipo_proposta,
            acao: acao,
            solicitadoPor: solicitacao.solicitado_por,
          }, [solicitacao.solicitado_por]);

          return res.json({
            success: true,
            emailEnviado,
            message: emailEnviado
              ? "Desconto por item aprovado e proposta enviada ao cliente!"
              : "Desconto por item aprovado. Atenção: o e-mail para o cliente NÃO foi enviado. Envie o link manualmente.",
          });
        } else {
          await connection.execute(
            `UPDATE propostas SET status = 'Recusada' WHERE id = ?`,
            [proposta.id],
          );

          await connection.execute(
            `UPDATE solicitacoes_desconto_item SET status = 'Recusada', aprovado_por = ?, data_resposta = NOW() WHERE id = ?`,
            [req.user.id, solicitacao.id],
          );

          await connection.commit();

          notificationService.enviarNotificacao("desconto_respondido", {
            id: solicitacao.id,
            propostaId: solicitacao.proposta_id,
            numeroProposta: proposta.numero_proposta,
            nomeClinica: proposta.nome_clinica,
            tipoProposta: proposta.tipo_proposta,
            acao: acao,
            solicitadoPor: solicitacao.solicitado_por,
          }, [solicitacao.solicitado_por]);

          return res.json({ success: true, message: "Solicitação de desconto por item recusada." });
        }
      }

      const sols = await connection.execute(
        "SELECT * FROM solicitacoes_desconto WHERE id = ? FOR UPDATE",
        [req.params.id],
      ).then(([r]) => r);
      if (sols.length === 0) {
        await connection.rollback();
        return res.status(404).json({ error: "Solicitação não encontrada." });
      }

      const solicitacao = sols[0];
      if (solicitacao.status !== "Pendente") {
        await connection.rollback();
        return res.status(409).json({ error: `Solicitação já respondida (${solicitacao.status}).` });
      }
      const props = await connection.execute(
        "SELECT * FROM propostas WHERE id = ? FOR UPDATE",
        [solicitacao.proposta_id],
      ).then(([r]) => r);
      const proposta = props.length > 0 ? props[0] : null;

      if (acao === "Aprovar") {
        if (!proposta) {
          await connection.rollback();
          return res.status(404).json({ error: "Proposta associada não encontrada." });
        }

        const { token } = await criarPropostaFilhaComDesconto(
          proposta,
          parseFloat(solicitacao.percentual_solicitado),
          solicitacao.solicitado_por,
          connection
        );

        await connection.execute(
          `UPDATE solicitacoes_desconto SET status = 'Aprovada', aprovado_por = ?, data_resposta = NOW() WHERE id = ?`,
          [req.user.id, solicitacao.id],
        );

        await connection.commit();

        // Aprovação já gravada: falha de PDF/e-mail vira aviso; o retry daria 409 e o e-mail nunca sairia
        const { emailEnviado } = await gerarMidiaESenharProposta(token).catch((e) => {
          console.error("[Solicitação global] Erro ao gerar PDF/enviar e-mail:", e.message);
          return { emailEnviado: false };
        });

        notificationService.enviarNotificacao("desconto_respondido", {
          id: solicitacao.id,
          propostaId: solicitacao.proposta_id,
          numeroProposta: proposta.numero_proposta,
          nomeClinica: proposta.nome_clinica,
          tipoProposta: proposta.tipo_proposta,
          acao: acao,
          solicitadoPor: solicitacao.solicitado_por,
        }, [solicitacao.solicitado_por]);

        return res.json({
          success: true,
          emailEnviado,
          message: emailEnviado
            ? "Desconto aprovado e proposta gerada!"
            : "Desconto aprovado e proposta gerada. Atenção: o e-mail para o cliente NÃO foi enviado. Envie o link manualmente.",
        });
      } else {
        await connection.execute(
          `UPDATE solicitacoes_desconto SET status = 'Recusada', aprovado_por = ?, data_resposta = NOW() WHERE id = ?`,
          [req.user.id, solicitacao.id],
        );

        await connection.commit();

        notificationService.enviarNotificacao("desconto_respondido", {
          id: solicitacao.id,
          propostaId: solicitacao.proposta_id,
          numeroProposta: proposta ? proposta.numero_proposta : "",
          nomeClinica: proposta ? proposta.nome_clinica : "",
          tipoProposta: proposta ? proposta.tipo_proposta : "",
          acao: acao,
          solicitadoPor: solicitacao.solicitado_por,
        }, [solicitacao.solicitado_por]);

        return res.json({ success: true, message: "Solicitação recusada." });
      }
    } catch (error) {
      await connection?.rollback().catch(() => {});
      next(error);
    } finally {
      connection?.release();
    }
  },
);

module.exports = router;

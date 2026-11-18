const crypto = require("crypto");
const db = require("../config/db");
const notificationService = require("./notificationService");
const auditService = require("./auditService");
const crmPipelineService = require("./crmPipelineService");

/**
 * Extrai dados e data de vencimento do Certificado Digital de uma proposta
 */
function extrairVencimentoCertificado(p) {
  if (!p) return null;
  
  if (p.socios_detalhados_json) {
    try {
      const obj = typeof p.socios_detalhados_json === "string" 
        ? JSON.parse(p.socios_detalhados_json) 
        : p.socios_detalhados_json;

      if (obj && typeof obj === "object") {
        const v = obj.vencimentosRegularizacoes || (obj.formState && obj.formState.vencimentosRegularizacoes) || null;
        if (v && v.certificado && v.certificado.dataVencimento) {
          return {
            status: v.certificado.status || "Sim",
            dataVencimento: v.certificado.dataVencimento
          };
        }
        if (obj.vencimentoCertificadoDigital) {
          return {
            status: obj.certificadoDigital || "Sim",
            dataVencimento: obj.vencimentoCertificadoDigital
          };
        }
      }
    } catch (_) {}
  }

  return null;
}

/**
 * Varre clientes com certificado a vencer em até 30 dias (1 mês antes),
 * cria automaticamente proposta em rascunho para renovação (se ainda não existir)
 * e notifica a equipe comercial.
 */
async function verificarVencimentosECriarRascunhos() {
  const alertas = [];
  try {
    const propostas = await db.executarQuery(`
      SELECT 
        p.id, p.numero_proposta, p.data_proposta, p.nome_clinica, p.razao_social, p.cnpj,
        p.nome_socio, p.cpf_socio, p.email, p.telefone, p.endereco_clinica, p.cadeiras, p.funcionarios,
        p.socios, p.faturamento, p.regime_fiscal, p.regime_hibrido, p.distancia_km, p.metragem, p.valor_total,
        p.itens_json, p.criado_por, p.proposta_pai_id, p.empresa_proposta, p.tipo_proposta,
        p.tipo_pessoa, p.pro_labore, p.dentistas_parceiros, p.quantidade_socios, p.socios_detalhados_json,
        p.certificado_status, p.status, u.nome AS vendedor_nome
      FROM propostas p
      LEFT JOIN usuarios u ON p.criado_por = u.id
      WHERE p.status NOT IN ('Recusada', 'Cancelada')
      ORDER BY p.id DESC
    `);

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    for (const p of propostas) {
      const certInfo = extrairVencimentoCertificado(p);
      if (!certInfo || !certInfo.dataVencimento) continue;

      const dataVenc = certInfo.dataVencimento;
      const venc = new Date(dataVenc + "T00:00:00");
      if (isNaN(venc.getTime())) continue;

      // Diferença em dias até o vencimento
      const diffDias = Math.ceil((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

      // Se vence em até 30 dias (ou venceu recentemente há no máximo 45 dias)
      if (diffDias <= 30 && diffDias >= -45) {
        const dataFmt = venc.toLocaleDateString("pt-BR");

        // 1. Verificar se já existe rascunho de renovação para este cliente
        let rascunhoExistente = null;
        try {
          const rows = await db.executarQuery(
            `SELECT id, numero_proposta, status, valor_total, criado_em 
             FROM propostas 
             WHERE status = 'Rascunho' 
               AND (
                 proposta_pai_id = ? 
                 OR (cnpj IS NOT NULL AND cnpj != '' AND cnpj = ? AND itens_json LIKE '%Renovação%Certificado%')
                 OR (email = ? AND itens_json LIKE '%Renovação%Certificado%')
               )
             ORDER BY id DESC LIMIT 1`,
            [p.id, p.cnpj || "", p.email || ""]
          );
          if (rows && rows.length > 0) {
            rascunhoExistente = rows[0];
          }
        } catch (e) {
          console.warn("[Renovação Certificado] Aviso ao verificar rascunho existente:", e.message);
        }

        let rascunhoId = rascunhoExistente ? rascunhoExistente.id : null;
        let rascunhoNumero = rascunhoExistente ? rascunhoExistente.numero_proposta : null;

        // 2. Se NÃO existe rascunho, cria automaticamente
        if (!rascunhoId) {
          try {
            const now = new Date();
            const ano = now.getFullYear();
            const mes = String(now.getMonth() + 1).padStart(2, "0");
            const rnd = Math.floor(1000 + Math.random() * 9000);
            const numeroProposta = `RASC-RENOV-${ano}${mes}-${rnd}`;
            const tokenAcesso = crypto.randomBytes(20).toString("hex");
            const dataProposta = now.toISOString().slice(0, 10);

            const itensRenovacao = [
              {
                codigo: "certificado",
                servico: "Renovação de Certificado Digital A1",
                valor: 220,
                tipo: "Pontual",
                observacao: `Renovação Automática - Certificado a vencer em ${dataFmt}`
              }
            ];

            const estadoJson = JSON.stringify({
              vencimentoCertificadoOriginal: dataVenc,
              propostaOriginalId: p.id,
              propostaOriginalNumero: p.numero_proposta,
              geradoAutomaticamente: true,
              motivo: `Certificado Digital a vencer em ${dataFmt} (faltam ${diffDias} dias)`,
              vencimentosRegularizacoes: {
                certificado: {
                  status: "Vencido",
                  dataVencimento: dataVenc
                }
              }
            });

            const [resultado] = await db.execute(
              `INSERT INTO propostas (
                token_acesso, numero_proposta, data_proposta, nome_clinica, razao_social, cnpj,
                nome_socio, cpf_socio, email, telefone, endereco_clinica, cadeiras, funcionarios,
                socios, faturamento, regime_fiscal, regime_hibrido, distancia_km, metragem,
                valor_total, itens_json, status, criado_por, empresa_proposta, tipo_proposta,
                tipo_pessoa, pro_labore, dentistas_parceiros, quantidade_socios,
                proposta_pai_id, socios_detalhados_json, certificado_status
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Rascunho', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Vencido')`,
              [
                tokenAcesso, numeroProposta, dataProposta, p.nome_clinica, p.razao_social || null, p.cnpj || null,
                p.nome_socio || null, p.cpf_socio || null, p.email, p.telefone || null, p.endereco_clinica || null,
                0, Number(p.funcionarios || 0), Number(p.socios || 1), Number(p.faturamento || 0),
                p.regime_fiscal || null, p.regime_hibrido || null, Number(p.distancia_km || 0), Number(p.metragem || 0),
                220.00, JSON.stringify(itensRenovacao), p.criado_por || 1, p.empresa_proposta || "FINORA", p.tipo_proposta || "finora",
                p.tipo_pessoa || "PJ", "Não", 0, Number(p.quantidade_socios || 0),
                p.id, estadoJson
              ]
            );

            rascunhoId = resultado.insertId;
            rascunhoNumero = numeroProposta;

            // Registrar log de auditoria
            await auditService.registrarLogProposta({
              proposta_id: rascunhoId,
              usuario_id: p.criado_por || 1,
              usuario_nome: "Sistema Autônomo Q-MAX",
              usuario_role: "Sistema",
              acao: "Criacao",
              descricao: `Proposta de renovação em rascunho (${numeroProposta}) gerada automaticamente 1 mês antes do vencimento do Certificado Digital (${dataFmt}). Time comercial notificado para contato.`
            });

            // Sincronizar na pipeline de propostas no CRM
            crmPipelineService.sincronizarPropostaNoCRM(rascunhoId, "Rascunho").catch(() => {});

            // Notificar via SSE em tempo real a equipe comercial e admin
            notificationService.enviarNotificacao(
              "alerta_renovacao_certificado",
              {
                tipo: "renovacao_certificado",
                cliente: p.nome_clinica || p.razao_social || "Cliente",
                cnpj: p.cnpj,
                dataVencimento: dataFmt,
                diasRestantes: diffDias,
                rascunhoId,
                rascunhoNumero,
                propostaOriginal: p.numero_proposta,
                mensagem: `Certificado Digital de ${p.nome_clinica || 'Cliente'} vence em ${diffDias} dia(s) (${dataFmt}). Rascunho de proposta ${numeroProposta} criado automaticamente.`
              },
              p.criado_por ? [p.criado_por] : []
            );

            console.log(`[Renovação Certificado] Rascunho ${numeroProposta} criado automaticamente para ${p.nome_clinica} (Vence em ${dataFmt}).`);
          } catch (createErr) {
            console.error("[Renovação Certificado] Erro ao criar rascunho de renovação:", createErr.message);
          }
        }

        alertas.push({
          propostaOriginalId: p.id,
          numeroPropostaOriginal: p.numero_proposta,
          cliente: p.nome_clinica || p.razao_social || "Cliente",
          cnpj: p.cnpj || "",
          nomeSocio: p.nome_socio || "",
          telefone: p.telefone || "",
          email: p.email || "",
          dataVencimento: dataVenc,
          dataVencimentoFmt: dataFmt,
          diasRestantes: diffDias,
          tipoAlerta: diffDias < 0 ? "vencido" : "a_vencer",
          mensagem: diffDias < 0 ? `Vencido há ${Math.abs(diffDias)} dia(s)` : (diffDias === 0 ? "Vence hoje!" : `Vence em ${diffDias} dia(s)`),
          rascunhoId,
          rascunhoNumero,
          vendedorNome: p.vendedor_nome || "Comercial",
          criadoPor: p.criado_por
        });
      }
    }
  } catch (error) {
    console.error("[Renovação Certificado] Erro ao varrer vencimentos:", error.message);
  }

  return alertas;
}

/**
 * Inicializa motor periódico em segundo plano para varredura diária/horária
 */
function inicializarMotorRenovacoes() {
  console.log("[Renovação Certificado] Motor autônomo inicializado com sucesso.");

  // Executa imediatamente na inicialização
  setTimeout(() => {
    verificarVencimentosECriarRascunhos().catch(() => {});
  }, 5000);

  // Executa verificação periódica a cada 1 hora
  setInterval(() => {
    verificarVencimentosECriarRascunhos().catch(() => {});
  }, 60 * 60 * 1000);
}

module.exports = {
  extrairVencimentoCertificado,
  verificarVencimentosECriarRascunhos,
  inicializarMotorRenovacoes
};

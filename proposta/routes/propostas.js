const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
const db = require("../config/db");

const { verificarToken, donoProposta, donoDocumento } = require("../middleware/auth");
const rateLimit = require("express-rate-limit");
const { gerarPDFProposta, gerarPDFEstudoTributario } = require("../services/pdfService");
const { gerarPDFContrato, gerarHTMLContrato } = require("../services/contratoService");
const { obterContratada } = require("../services/contratadaService");
const d4signService = require("../services/d4signService");
const notificationService = require("../services/notificationService");
const teamsService = require("../services/teamsService");
const emailService = require("../services/emailService");
const whatsappService = require("../services/whatsappService");
const discountService = require("../services/discountService");
const auditService = require("../services/auditService");
const { LIMITE_DESCONTO_COMERCIAL, calcularPrecosReferencia, aplicarDescontoReal } = require("../services/precoService");
const { z } = require("zod");
const { propostaSchema, itemPropostaSchema } = require("../validations/propostaValidation");
const {
  temDescontoAcimaDe20,
  buscarTopicosPdfPorItens,
  criarPropostaFilhaComDesconto,
  gerarMidiaESenharProposta,
  linkCurto,
  lerJson,
  proximoNumeroProposta,
  ehUuidD4Sign,
  propostaVencida,
  mascararCpf
} = require("../services/proposalHelpers");

const APP_BASE_PATH = process.env.APP_BASE_PATH || "/proposta";
const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3005}`;
const pdfFolder = path.join(__dirname, "../storage/propostas_pdf");
const certificadoFolder = path.join(__dirname, "../storage/certificados_digitais");
const documentosFolder = path.join(__dirname, "../storage/documentos_onboarding");
fs.mkdirSync(certificadoFolder, { recursive: true });
fs.mkdirSync(documentosFolder, { recursive: true });

function chaveCriptografiaCertificado() {
  const segredo = process.env.CERTIFICADO_ENCRYPTION_KEY;
  if (!segredo || segredo.length < 32) return null;
  return crypto.createHash("sha256").update(segredo).digest();
}

function criptografarSenhaCertificado(senha) {
  if (!senha) return null;
  const chave = chaveCriptografiaCertificado();
  if (!chave) {
    throw new Error("CERTIFICADO_ENCRYPTION_KEY não configurada ou menor que 32 caracteres.");
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", chave, iv);
  const encrypted = Buffer.concat([cipher.update(senha, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

function nomeSeguroCertificado(nomeOriginal) {
  const extensao = path.extname(nomeOriginal || "").toLowerCase();
  if (![".pfx", ".p12"].includes(extensao)) return null;
  return `${crypto.randomUUID()}${extensao}`;
}

// Status em que o link público do cliente não aceita aprovação
const AVISO_EMAIL_NAO_ENVIADO = "Atenção: o e-mail para o cliente NÃO foi enviado. Envie o link manualmente.";

const MENSAGEM_PROPOSTA_VENCIDA =
  "O prazo de validade desta proposta (10 dias) terminou. Use \"Reativar condição\" nesta página ou fale com seu consultor.";

const MENSAGEM_BLOQUEIO_APROVACAO = {
  "Recusada": "Esta proposta foi recusada e não pode mais ser aprovada por este link. Fale com seu consultor para receber uma nova proposta.",
  "Aguardando Aprovação": "Esta proposta ainda está em análise interna e não pode ser aprovada.",
};

// O schema propostaSchema é gerenciado centralizadamente em validations/propostaValidation.js

// --- GET ALL PROPOSTAS ---
router.get("/api/propostas", verificarToken, async (req, res, next) => {
  try {
    const somenteProprias = req.user.role === "Comercial";
    const propostas = await db.executarQuery(`
      SELECT 
        p.id, p.token_acesso, p.numero_proposta, p.data_proposta, p.nome_clinica, p.razao_social, p.cnpj,
        p.nome_socio, p.cpf_socio, p.email, p.telefone, p.endereco_clinica, p.cadeiras, p.funcionarios,
        p.socios, p.faturamento, p.regime_fiscal, p.regime_hibrido, p.distancia_km, p.metragem, p.valor_total,
        p.itens_json, p.criado_por, p.proposta_pai_id, p.percentual_desconto, p.valor_desconto,
        p.ip_assinatura, p.data_decisao, p.criado_em, p.empresa_proposta, p.tipo_proposta,
        p.tipo_pessoa, p.pro_labore, p.dentistas_parceiros, p.quantidade_socios, p.socios_detalhados_json,
        p.certificado_status, p.certificado_nome_original, p.certificado_enviado_em, p.validade_inicia_em,
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM solicitacoes_desconto_item sdi 
            WHERE sdi.proposta_id = p.id AND sdi.status = 'Pendente'
          ) THEN 'Aguardando Aprovação'
          ELSE p.status 
        END AS status,
        u.nome AS criador,
        COUNT(v.id) AS total_visualizacoes,
        MAX(v.visualizado_em) AS ultima_visualizacao,
        (
          SELECT po.observacao
          FROM proposta_observacoes po
          WHERE po.proposta_id = p.id
          ORDER BY po.criado_em DESC
          LIMIT 1
        ) AS ultima_observacao,
        (
          SELECT po.criado_em
          FROM proposta_observacoes po
          WHERE po.proposta_id = p.id
          ORDER BY po.criado_em DESC
          LIMIT 1
        ) AS ultima_observacao_data,
        (
          SELECT pv.user_agent
          FROM proposta_visualizacoes pv
          WHERE pv.proposta_id = p.id
          ORDER BY pv.visualizado_em DESC
          LIMIT 1
        ) AS ultimo_user_agent
      FROM propostas p
      LEFT JOIN usuarios u ON p.criado_por = u.id
      LEFT JOIN proposta_visualizacoes v ON v.proposta_id = p.id
      ${somenteProprias ? "WHERE p.criado_por = ?" : ""}
      GROUP BY 
        p.id, p.token_acesso, p.numero_proposta, p.data_proposta, p.nome_clinica, p.razao_social, p.cnpj,
        p.nome_socio, p.cpf_socio, p.email, p.telefone, p.endereco_clinica, p.cadeiras, p.funcionarios,
        p.socios, p.faturamento, p.regime_fiscal, p.regime_hibrido, p.distancia_km, p.metragem, p.valor_total,
        p.itens_json, p.criado_por, p.proposta_pai_id, p.percentual_desconto, p.valor_desconto,
        p.ip_assinatura, p.data_decisao, p.criado_em, p.empresa_proposta, p.tipo_proposta, p.status,
        p.tipo_pessoa, p.pro_labore, p.dentistas_parceiros, p.quantidade_socios, p.socios_detalhados_json,
        p.certificado_status, p.certificado_nome_original, p.certificado_enviado_em,
        u.nome
      ORDER BY p.id DESC
      LIMIT 100
    `, somenteProprias ? [req.user.id] : []);
    res.json(propostas);
  } catch (error) {
    next(error);
  }
});

// --- ALERTAS DE VENCIMENTO & RENOVAÇÃO AUTOMÁTICA (1 MÊS ANTES) ---
router.get("/api/propostas/alertas-vencimentos", verificarToken, async (req, res, next) => {
  try {
    const renovacaoCertificadoService = require("../services/renovacaoCertificadoService");
    const alertas = await renovacaoCertificadoService.verificarVencimentosECriarRascunhos();
    if (req.user.role === "Comercial") {
      const meusAlertas = alertas.filter(a => Number(a.criadoPor) === Number(req.user.id));
      return res.json(meusAlertas);
    }
    res.json(alertas);
  } catch (error) {
    next(error);
  }
});

// --- HISTÓRICO DE PROPOSTAS POR CNPJ ---
router.get("/api/propostas/historico-cnpj/:cnpj", verificarToken, async (req, res, next) => {
  try {
    const cnpjLimpo = (req.params.cnpj || "").replace(/\D/g, "");
    if (cnpjLimpo.length !== 14) {
      return res.json([]);
    }

    // Comercial só vê as próprias propostas (o token daria acesso de cliente às dos colegas)
    const somenteProprias = req.user.role === "Comercial";
    const propostas = await db.executarQuery(
      `SELECT 
        p.id, p.token_acesso, p.numero_proposta, p.data_proposta, p.nome_clinica, p.razao_social, p.cnpj,
        p.nome_socio, p.cpf_socio, p.email, p.telefone, p.endereco_clinica, p.cadeiras, p.funcionarios,
        p.socios, p.faturamento, p.regime_fiscal, p.regime_hibrido, p.distancia_km, p.metragem, p.valor_total,
        p.itens_json, p.tipo_proposta, p.status, p.criado_em,
        u.nome AS criador
       FROM propostas p
       LEFT JOIN usuarios u ON p.criado_por = u.id
       WHERE REPLACE(REPLACE(REPLACE(p.cnpj, '.', ''), '/', ''), '-', '') = ?
         ${somenteProprias ? "AND p.criado_por = ?" : ""}
       ORDER BY p.id DESC
       LIMIT 5`,
      somenteProprias ? [cnpjLimpo, req.user.id] : [cnpjLimpo]
    );

    res.json(propostas);
  } catch (error) {
    next(error);
  }
});

// --- PREVIEW ---
router.post("/api/propostas/preview", verificarToken, async (req, res, next) => {
  try {
    const dados = req.body;
    if (!dados || !dados.itens || !Array.isArray(dados.itens)) {
      return res.status(400).json({ error: "Payload inválido para preview." });
    }
    const agora = new Date();
    agora.setUTCHours(agora.getUTCHours() - 3);
    const ano = agora.getUTCFullYear();
    const mes = String(agora.getUTCMonth() + 1).padStart(2, "0");
    const dia = String(agora.getUTCDate()).padStart(2, "0");

    dados.dataProposta = dados.dataProposta || `${ano}-${mes}-${dia}`;
    dados.numeroProposta = dados.numeroProposta || "PREVIEW";

    if (!dados.topicosPdf || !dados.topicosPdf.length) {
      dados.topicosPdf = await buscarTopicosPdfPorItens(dados.itens);
    }

    const pdfBuffer = await gerarPDFProposta(dados);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=preview.pdf");
    res.setHeader("Content-Length", pdfBuffer.length);
    return res.end(pdfBuffer);
  } catch (error) {
    console.error('Erro ao gerar preview da proposta:', error);
    next(error);
  }
});

function calcularDiferencasProposta(antiga, novosDados) {
  const alteracoes = [];
  const anterior = {};
  const novo = {};

  const faturamentoAntigo = Number(antiga.faturamento || 0);
  const faturamentoNovo = Number(novosDados.faturamento || 0);
  if (faturamentoAntigo !== faturamentoNovo) {
    alteracoes.push(`Faturamento: R$ ${faturamentoAntigo.toLocaleString("pt-BR")} ➔ R$ ${faturamentoNovo.toLocaleString("pt-BR")}`);
    anterior.faturamento = faturamentoAntigo;
    novo.faturamento = faturamentoNovo;
  }

  const valorTotalAntigo = Number(antiga.valor_total || 0);
  const valorTotalNovo = Number(novosDados.valorTotal || novosDados.valor_total || 0);
  if (Math.abs(valorTotalAntigo - valorTotalNovo) > 0.01) {
    alteracoes.push(`Valor Total: R$ ${valorTotalAntigo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} ➔ R$ ${valorTotalNovo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
    anterior.valor_total = valorTotalAntigo;
    novo.valor_total = valorTotalNovo;
  }

  const cadeirasAntigas = Number(antiga.cadeiras || 0);
  const cadeirasNovas = Number(novosDados.cadeiras || 0);
  if (cadeirasAntigas !== cadeirasNovas) {
    alteracoes.push(`Cadeiras: ${cadeirasAntigas} ➔ ${cadeirasNovas}`);
    anterior.cadeiras = cadeirasAntigas;
    novo.cadeiras = cadeirasNovas;
  }

  const funcAntigos = Number(antiga.funcionarios || 0);
  const funcNovos = Number(novosDados.funcionarios || 0);
  if (funcAntigos !== funcNovos) {
    alteracoes.push(`Funcionários: ${funcAntigos} ➔ ${funcNovos}`);
    anterior.funcionarios = funcAntigos;
    novo.funcionarios = funcNovos;
  }

  const sociosAntigos = Number(antiga.socios || 0);
  const sociosNovos = Number(novosDados.socios || 0);
  if (sociosAntigos !== sociosNovos) {
    alteracoes.push(`Sócios: ${sociosAntigos} ➔ ${sociosNovos}`);
    anterior.socios = sociosAntigos;
    novo.socios = sociosNovos;
  }

  if (novosDados.regimeFiscal && antiga.regime_fiscal !== novosDados.regimeFiscal) {
    alteracoes.push(`Regime Fiscal: "${antiga.regime_fiscal || 'Não definido'}" ➔ "${novosDados.regimeFiscal}"`);
    anterior.regime_fiscal = antiga.regime_fiscal;
    novo.regime_fiscal = novosDados.regimeFiscal;
  }

  let itensAntigos = [];
  try {
    itensAntigos = typeof antiga.itens_json === "string" ? JSON.parse(antiga.itens_json) : (antiga.itens_json || []);
  } catch (e) { itensAntigos = []; }
  const itensNovos = Array.isArray(novosDados.itens) ? novosDados.itens : [];

  const nomesAntigos = itensAntigos.map(i => i.servico || i.nome || i.titulo || "").filter(Boolean);
  const nomesNovos = itensNovos.map(i => i.servico || i.nome || i.titulo || "").filter(Boolean);

  const adicionados = nomesNovos.filter(n => !nomesAntigos.includes(n));
  const removidos = nomesAntigos.filter(n => !nomesNovos.includes(n));

  if (adicionados.length > 0) {
    alteracoes.push(`Serviços adicionados: ${adicionados.join(", ")}`);
    novo.servicos_adicionados = adicionados;
  }
  if (removidos.length > 0) {
    alteracoes.push(`Serviços removidos: ${removidos.join(", ")}`);
    anterior.servicos_removidos = removidos;
  }

  return { alteracoes, anterior, novo };
}

// --- SALVAR RASCUNHO DA PROPOSTA (COMERCIAL E DIRETORIA) ---
router.post("/api/propostas/rascunho", verificarToken, async (req, res, next) => {
  try {
    const dados = req.body || {};
    const rascunhoId = dados.id || dados.rascunhoId;
    const nomeClinica = dados.nomeClinica || dados.nome_clinica || "Rascunho de Proposta";
    const email = dados.email || "rascunho@temp.com";
    const itens = Array.isArray(dados.itens) ? dados.itens : [];
    const valorTotal = Number(dados.valorTotal || dados.valor_total || 0);

    const agora = new Date();
    agora.setUTCHours(agora.getUTCHours() - 3);
    const ano = agora.getUTCFullYear();
    const mes = String(agora.getUTCMonth() + 1).padStart(2, "0");
    const dia = String(agora.getUTCDate()).padStart(2, "0");
    const dataProposta = `${ano}-${mes}-${dia}`;

    const estadoCompletoJson = JSON.stringify(dados);

    if (rascunhoId) {
      // Atualiza rascunho existente
      const [existente] = await db.executarQuery(
        "SELECT * FROM propostas WHERE id = ?",
        [rascunhoId]
      );

      if (existente) {
        if (req.user.role === "Comercial" && Number(existente.criado_por) !== Number(req.user.id)) {
          return res.status(403).json({ error: "Você só pode editar seus próprios rascunhos." });
        }

        const diff = calcularDiferencasProposta(existente, dados);

        const isFinora = String(dados.tipoProposta || existente.tipo_proposta || "finora").toLowerCase() === "finora";
        const cadeirasSalvar = isFinora ? Number(dados.cadeiras || 0) : 0;
        const dentistasSalvar = isFinora ? Number(dados.dentistasParceiros || 0) : 0;

        await db.executarQuery(
          `UPDATE propostas SET 
            nome_clinica = ?, razao_social = ?, cnpj = ?, nome_socio = ?, cpf_socio = ?,
            email = ?, telefone = ?, endereco_clinica = ?, cadeiras = ?, funcionarios = ?,
            socios = ?, faturamento = ?, regime_fiscal = ?, regime_hibrido = ?, distancia_km = ?,
            metragem = ?, valor_total = ?, itens_json = ?, empresa_proposta = ?, tipo_proposta = ?,
            tipo_pessoa = ?, pro_labore = ?, dentistas_parceiros = ?, quantidade_socios = ?,
            socios_detalhados_json = ?, video_pitch = ?, audio_pitch = ?
          WHERE id = ? AND status = 'Rascunho'`,
          [
            nomeClinica, dados.razaoSocial || null, dados.cnpj || null, dados.nomeSocio || null, dados.cpfSocio || null,
            email, dados.telefone || null, dados.enderecoClinica || null, cadeirasSalvar, Number(dados.funcionarios || 0),
            Number(dados.socios || 0), Number(dados.faturamento || 0), dados.regimeFiscal || null, dados.regimeHibrido || null, Number(dados.distanciaKm || 0),
            Number(dados.metragem || 0), valorTotal, JSON.stringify(itens), (dados.tipoProposta || "FINORA").toUpperCase(), dados.tipoProposta || "finora",
            dados.tipoPessoa || "PJ", dados.proLabore || "Não", dentistasSalvar, Number(dados.quantidadeSocios || 0),
            estadoCompletoJson, dados.videoPitch || dados.video_pitch || "", dados.audioPitch || dados.audio_pitch || "", rascunhoId
          ]
        );

        const descDetalhes = diff.alteracoes.length > 0
          ? diff.alteracoes.join(" • ")
          : "Rascunho atualizado sem modificações estruturais";

        await auditService.registrarLogProposta({
          proposta_id: rascunhoId,
          usuario_id: req.user.id,
          usuario_nome: req.user.nome || "Consultor",
          usuario_role: req.user.role || "Comercial",
          acao: "EDICAO_RASCUNHO",
          titulo: "Rascunho da Proposta Editado",
          detalhes: descDetalhes,
          dados_anteriores: diff.anterior,
          dados_novos: diff.novo,
          ip: req.ip
        });

        // Sincronizar na pipeline de propostas no CRM
        try {
          const crmPipelineService = require("../services/crmPipelineService");
          crmPipelineService.sincronizarPropostaNoCRM(rascunhoId, "Rascunho").catch(() => {});
        } catch (e) {}

        return res.json({
          success: true,
          id: rascunhoId,
          message: "Rascunho atualizado com sucesso!",
        });
      }
    }

    // Cria novo rascunho
    const tokenAcesso = crypto.randomBytes(20).toString("hex");
    const numRandom = Math.floor(1000 + Math.random() * 9000);
    const numeroProposta = `RASC-${ano}${mes}-${numRandom}`;

    const isFinora = String(dados.tipoProposta || "finora").toLowerCase() === "finora";
    const cadeirasSalvar = isFinora ? Number(dados.cadeiras || 0) : 0;
    const dentistasSalvar = isFinora ? Number(dados.dentistasParceiros || 0) : 0;

    const [resultado] = await db.execute(
      `INSERT INTO propostas (
        token_acesso, numero_proposta, data_proposta, nome_clinica, razao_social, cnpj,
        nome_socio, cpf_socio, email, telefone, endereco_clinica, cadeiras, funcionarios,
        socios, faturamento, regime_fiscal, regime_hibrido, distancia_km, metragem,
        valor_total, itens_json, status, criado_por, empresa_proposta, tipo_proposta,
        tipo_pessoa, pro_labore, dentistas_parceiros, quantidade_socios, socios_detalhados_json,
        video_pitch, audio_pitch
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Rascunho', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tokenAcesso, numeroProposta, dataProposta, nomeClinica, dados.razaoSocial || null, dados.cnpj || null,
        dados.nomeSocio || null, dados.cpfSocio || null, email, dados.telefone || null, dados.enderecoClinica || null,
        cadeirasSalvar, Number(dados.funcionarios || 0), Number(dados.socios || 0), Number(dados.faturamento || 0),
        dados.regimeFiscal || null, dados.regimeHibrido || null, Number(dados.distanciaKm || 0), Number(dados.metragem || 0),
        valorTotal, JSON.stringify(itens), req.user.id, (dados.tipoProposta || "FINORA").toUpperCase(),
        dados.tipoProposta || "finora", dados.tipoPessoa || "PJ", dados.proLabore || "Não",
        dentistasSalvar, Number(dados.quantidadeSocios || 0), estadoCompletoJson,
        dados.videoPitch || dados.video_pitch || "", dados.audioPitch || dados.audio_pitch || ""
      ]
    );

    await auditService.registrarLogProposta({
      proposta_id: resultado.insertId,
      usuario_id: req.user.id,
      usuario_nome: req.user.nome || "Consultor",
      usuario_role: req.user.role || "Comercial",
      acao: "CRIACAO_RASCUNHO",
      titulo: "Rascunho Iniciado",
      detalhes: `Rascunho #${numeroProposta} criado para "${nomeClinica}". Total: R$ ${valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (${itens.length} serviços).`,
      dados_novos: { numeroProposta, total: valorTotal, itens },
      ip: req.ip
    });

    // Sincronizar na pipeline de propostas no CRM
    try {
      const crmPipelineService = require("../services/crmPipelineService");
      crmPipelineService.sincronizarPropostaNoCRM(resultado.insertId, "Rascunho").catch(() => {});
    } catch (e) {}

    res.json({
      success: true,
      id: resultado.insertId,
      numero_proposta: numeroProposta,
      message: "Rascunho salvo com sucesso no sistema!",
    });
  } catch (error) {
    next(error);
  }
});

// --- OBTER DADOS DO RASCUNHO PARA CONTINUAR ---
router.get("/api/propostas/:id/rascunho", verificarToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const [prop] = await db.executarQuery(
      "SELECT * FROM propostas WHERE id = ? AND status = 'Rascunho'",
      [id]
    );

    if (!prop) {
      return res.status(404).json({ error: "Rascunho não encontrado." });
    }

    if (req.user.role === "Comercial" && Number(prop.criado_por) !== Number(req.user.id)) {
      return res.status(403).json({ error: "Você só pode abrir seus próprios rascunhos." });
    }

    let payload = null;
    try {
      payload = JSON.parse(prop.socios_detalhados_json);
    } catch {
      payload = null;
    }

    res.json({
      success: true,
      proposta: prop,
      dadosRestauracao: payload || prop,
    });
  } catch (error) {
    next(error);
  }
});

// --- EXCLUIR RASCUNHO ---
router.delete("/api/propostas/rascunho/:id", verificarToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const [prop] = await db.executarQuery(
      "SELECT id, criado_por, status FROM propostas WHERE id = ? AND status = 'Rascunho'",
      [id]
    );

    if (!prop) {
      return res.status(404).json({ error: "Rascunho não encontrado ou já finalizado." });
    }

    if (req.user.role === "Comercial" && Number(prop.criado_por) !== Number(req.user.id)) {
      return res.status(403).json({ error: "Você só pode excluir seus próprios rascunhos." });
    }

    await db.executarQuery("DELETE FROM propostas WHERE id = ?", [id]);
    res.json({ success: true, message: "Rascunho removido com sucesso." });
  } catch (error) {
    next(error);
  }
});

// --- CREATE --- (With Transaction)
router.post("/api/propostas", verificarToken, async (req, res, next) => {
  // Dentro do try: falha ao pegar conexão vira erro tratado, não promise rejeitada sem resposta
  let connection;
  try {
    const validacao = propostaSchema.safeParse(req.body);
    if (!validacao.success) {
      return res.status(400).json({
        error: "Dados inválidos para gerar proposta.",
        detalhes: validacao.error.issues,
      });
    }

    const dados = validacao.data;
    dados.topicosPdf = await buscarTopicosPdfPorItens(dados.itens);
    // Alçada calculada contra o preço de tabela do servidor (não confia em descontoPercentual do navegador)
    const maiorDescontoReal = aplicarDescontoReal(dados.itens, await calcularPrecosReferencia(dados));
    const precisaAprovacao =
      (temDescontoAcimaDe20(dados.itens) || maiorDescontoReal > LIMITE_DESCONTO_COMERCIAL) && req.user.role !== "Diretor";

    const tokenAcesso = crypto.randomBytes(20).toString("hex");
    dados.tokenAcesso = tokenAcesso; // rodapé do PDF usa o token no link de validação

    const agora = new Date();
    agora.setUTCHours(agora.getUTCHours() - 3);
    const ano = agora.getUTCFullYear();
    const mes = String(agora.getUTCMonth() + 1).padStart(2, "0");
    const dia = String(agora.getUTCDate()).padStart(2, "0");
    dados.dataProposta = `${ano}-${mes}-${dia}`;
const normalizarProLabore = (valor) => {
  if (
    valor === true ||
    valor === 1 ||
    valor === "1" ||
    String(valor).toLowerCase() === "sim"
  ) {
    return "Sim";
  }

  if (
    valor === false ||
    valor === 0 ||
    valor === "0" ||
    String(valor).toLowerCase() === "não" ||
    String(valor).toLowerCase() === "nao"
  ) {
    return "Não";
  }

  return valor ? String(valor).substring(0, 30) : "Não";
};

const proLaboreNormalizado = normalizarProLabore(
  dados.proLabore ?? dados.pro_labore
);

    // -- INÍCIO VALIDAÇÃO CNPJ/CPF --
    let cnpjSituacao = "ATIVA";
    let documentoStatus = "ATIVA";
    try {
      if (dados.cnpj) {
        const cnpjLimpo = dados.cnpj.replace(/\D/g, "");
        if (cnpjLimpo.length === 14) {
          const axios = require("axios");
          const resp = await axios.get(`https://receitaws.com.br/v1/cnpj/${cnpjLimpo}`, { timeout: 5000 });
          if (resp.data && resp.data.situacao) {
            cnpjSituacao = resp.data.situacao;
            documentoStatus = cnpjSituacao;
          }
        }
      } else if (dados.cpfSocio) {
        // Mock CPF status since there's no open public API
        documentoStatus = "REGULAR";
        cnpjSituacao = "REGULAR";
      }
    } catch (err) {
      console.warn("Falha ao checar documento na API:", err.message);
    }

    const irregular = ["INAPTA", "BAIXADA", "SUSPENSA", "IRREGULAR"].includes(cnpjSituacao.toUpperCase());

    if (irregular) {
      // Remove diagnostico from 'mensal' if present
      dados.itens = dados.itens.filter(i => !(String(i.servico || i.nome || "").toLowerCase().includes("diagnóstico") && i.tipo === "mensal"));
      
      // Adiciona como pontual
      // servico é obrigatório em proposta_itens; observacao "Pontual" classifica o item fora da mensalidade
      dados.itens.push({
        id: "serv_diag_reg",
        servico: "Diagnóstico de Obrigações e Serviço de Regularização",
        nome: "Diagnóstico de Obrigações e Serviço de Regularização",
        tipo: "pontual",
        observacao: "Pontual",
        valor: 950.00,
        detalhes: "Adicionado automaticamente devido ao status do documento: " + cnpjSituacao
      });
    }
    // -- FIM VALIDAÇÃO CNPJ/CPF --

    // Total sempre derivado dos itens (o "total" enviado pelo navegador não é confiável)
    dados.total = dados.itens.reduce((acc, i) => acc + Number(i.valor || 0), 0);

    // Conexão e transação só agora: a consulta à receitaws acima não segura conexão do pool
    connection = await db.getConnection();
    await connection.beginTransaction();
    dados.numeroProposta = await proximoNumeroProposta(connection);

    const querySQL = `
      INSERT INTO propostas (
        token_acesso, numero_proposta, data_proposta, nome_clinica, razao_social, cnpj, 
        nome_socio, cpf_socio, email, telefone, endereco_clinica, cadeiras, funcionarios, socios, faturamento, regime_fiscal, 
        regime_hibrido, distancia_km, metragem, valor_total, itens_json, status, criado_por, empresa_proposta, tipo_proposta,
        tipo_pessoa, pro_labore, dentistas_parceiros, quantidade_socios, socios_detalhados_json, certificado_status, certificado_nome_original,
        video_pitch, audio_pitch, documento_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const isFinora = String(dados.tipoProposta || "finora").toLowerCase() === "finora";
    const cadeirasSalvar = isFinora ? Number(dados.cadeiras || 0) : 0;
    const dentistasSalvar = isFinora ? Number(dados.dentistasParceiros || 0) : 0;

    const values = [
      tokenAcesso,
      dados.numeroProposta,
      dados.dataProposta,
      dados.nomeClinica,
      dados.razaoSocial || "",
      dados.cnpj || "",
      dados.nomeSocio || "",
      dados.cpfSocio || "",
      dados.email,
      dados.telefone || "",
      dados.enderecoClinica || "",
      cadeirasSalvar,
      dados.funcionarios || 0,
      dados.socios || 0,
      dados.faturamento || 0,
      dados.regimeFiscal || "",
      dados.regimeHibrido || "",
      dados.distanciaKm || 0,
      dados.metragem || 0,
      dados.total,
      JSON.stringify(dados.itens),
      precisaAprovacao ? "Aguardando Aprovação" : "Pendente",
      req.user.id,
      dados.empresaProposta || "FINORA",
      dados.tipoProposta || "finora",
      dados.tipoPessoa || "PJ",
      proLaboreNormalizado || "Não",
      dentistasSalvar,
      dados.quantidadeSocios || 0,
      JSON.stringify(dados.vencimentosRegularizacoes ? {
        socios: dados.sociosDetalhados || [],
        vencimentosRegularizacoes: dados.vencimentosRegularizacoes
      } : (dados.sociosDetalhados || [])),
      dados.certificadoDigitalStatus || "Não",
      dados.certificadoDigitalNomeArquivo || "",
      dados.videoPitch || dados.video_pitch || "",
      dados.audioPitch || dados.audio_pitch || "",
      documentoStatus
    ];

    const [resultadoProposta] = await connection.execute(querySQL, values);
    const propostaId = resultadoProposta.insertId;

    // LOG DE AUDITORIA COMERCIAL
    const logDesc = `Proposta #${dados.numeroProposta} criada por ${req.user.nome || 'Vendedor'} (Perfil: ${dados.tipoPessoa || 'PJ'}, Total: R$ ${Number(dados.total || 0).toFixed(2)})`;
    await connection.execute(
      `INSERT INTO proposta_observacoes (proposta_id, usuario_id, observacao) VALUES (?, ?, ?)`,
      [propostaId, req.user.id, logDesc]
    ).catch(e => console.warn('Erro ao gravar log de auditoria:', e));

    auditService.registrarLogProposta({
      proposta_id: propostaId,
      usuario_id: req.user.id,
      usuario_nome: req.user.nome || "Consultor",
      usuario_role: req.user.role || "Comercial",
      acao: "CRIACAO",
      titulo: `Proposta #${dados.numeroProposta} Criada`,
      detalhes: `Proposta oficial gerada para "${dados.nomeClinica}" (${dados.tipoPessoa || "PJ"}). Faturamento: R$ ${Number(dados.faturamento || 0).toLocaleString("pt-BR")}. Total: R$ ${Number(dados.total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} com ${dados.itens?.length || 0} serviços configurados.`,
      dados_novos: {
        numeroProposta: dados.numeroProposta,
        total: dados.total,
        faturamento: dados.faturamento,
        tipoPessoa: dados.tipoPessoa,
        itens: dados.itens
      },
      ip: req.ip
    }).catch(e => console.warn("Erro ao auditar criação de proposta:", e.message));

    for (const item of dados.itens) {
      const obs = (item.observacao || "").toLowerCase();
      const tipo =
        obs.includes("pontual") ||
        obs.includes("taxas") ||
        obs.includes("emissão") ||
        obs.includes("renovação") ||
        obs.includes("implanta")
          ? "Pontual"
          : "Mensal";

      await connection.execute(
        `INSERT INTO proposta_itens 
          (proposta_id, servico, observacao, tipo, valor) 
         VALUES (?, ?, ?, ?, ?)`,
        [
          propostaId,
          item.servico,
          item.observacao || "",
          tipo,
          Number(item.valor || 0),
        ],
      );
    }

    if (precisaAprovacao) {
      await connection.execute(
        `INSERT INTO solicitacoes_desconto_item 
          (proposta_id, solicitado_por, descontos_json, justificativa) 
         VALUES (?, ?, ?, ?)`,
        [
          propostaId,
          req.user.id,
          JSON.stringify(dados.itens),
          dados.justificativaDesconto || "",
        ],
      );

      await connection.commit();

      // Proposta já gravada: falha no aviso não pode virar 500 (o retry criaria proposta duplicada)
      try {
        const diretores = await db.executarQuery(
          `SELECT email FROM usuarios WHERE ativo = 1 AND role = 'Diretor'`
        );
        await emailService.notificarAdminsSolicitacaoDesconto(diretores.map((usuario) => usuario.email), dados);
      } catch (e) {
        console.error("[Criação] Erro ao avisar diretoria:", e.message);
      }

      return res.status(202).json({
        success: true,
        aguardandoAprovacao: true,
        message:
          "Proposta salva e enviada para aprovação da diretoria. Ela ainda não foi enviada ao cliente.",
        propostaId,
      });
    }

    await connection.commit();

    const linkAcesso = linkCurto(tokenAcesso);

    // Proposta já gravada: falha de PDF/e-mail vira aviso, não 500 (o retry criaria proposta duplicada)
    let emailEnviado = false;
    try {
      const pdfBuffer = await gerarPDFProposta(dados);
      fs.writeFileSync(path.join(pdfFolder, `${tokenAcesso}.pdf`), pdfBuffer);

      // Apenas enviar e-mail tradicional com link de acesso para visualização.
      // O documento D4Sign será gerado dinamicamente quando o cliente clicar em "De Acordo"
      // enviarEmailLink devolve null quando o envio falha
      emailEnviado = Boolean(await emailService.enviarEmailLink(dados, linkAcesso));
    } catch (e) {
      console.error("[Criação] Erro ao gerar PDF/enviar e-mail:", e.message);
    }

    // Disparo automático de WhatsApp se configurado no servidor
    whatsappService.enviarPropostaAutomatica(dados, linkAcesso).catch((e) => {
      console.warn("[WhatsApp Auto] Erro no envio automático:", e.message);
    });

    // Sincronizar na pipeline própria de propostas no CRM
    try {
      const crmPipelineService = require("../services/crmPipelineService");
      crmPipelineService.sincronizarPropostaNoCRM(propostaId).catch(() => {});
    } catch (e) {}

    return res.status(200).json({
      success: true,
      message: emailEnviado ? "Proposta gerada!" : `Proposta gerada! ${AVISO_EMAIL_NAO_ENVIADO}`,
      emailEnviado,
      link: linkAcesso,
      propostaId,
      tokenAcesso,
    });
  } catch (error) {
    await connection?.rollback().catch(() => {});
    next(error);
  } finally {
    connection?.release();
  }
});

// --- PUBLIC VIEW ---

// --- UPLOAD SEGURO DO CERTIFICADO DIGITAL ---
router.post(
  "/api/propostas/:id/certificado",
  verificarToken,
  express.raw({ type: "application/octet-stream", limit: "10mb" }),
  async (req, res, next) => {
    try {
      const propostaId = Number(req.params.id);
      if (!Number.isInteger(propostaId) || propostaId <= 0) {
        return res.status(400).json({ error: "Identificador de proposta inválido." });
      }

      const propostas = await db.executarQuery(
        "SELECT id, criado_por, certificado_caminho FROM propostas WHERE id = ? LIMIT 1",
        [propostaId]
      );
      if (!propostas.length) return res.status(404).json({ error: "Proposta não encontrada." });

      const proposta = propostas[0];
      const papel = String(req.user.role || "").toLowerCase();
      const podeGerenciar = Number(proposta.criado_por) === Number(req.user.id) || ["diretor", "admin", "administrador"].includes(papel);
      if (!podeGerenciar) return res.status(403).json({ error: "Você não pode anexar certificado a esta proposta." });

      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({ error: "Arquivo de certificado não enviado." });
      }

      const nomeOriginal = decodeURIComponent(String(req.headers["x-certificado-nome"] || "certificado.pfx"));
      const nomeArmazenado = nomeSeguroCertificado(nomeOriginal);
      if (!nomeArmazenado) return res.status(400).json({ error: "Somente arquivos .PFX ou .P12 são permitidos." });

      const senhaCodificada = String(req.headers["x-certificado-senha"] || "");
      const senha = senhaCodificada ? Buffer.from(senhaCodificada, "base64").toString("utf8") : "";
      const senhaCriptografada = criptografarSenhaCertificado(senha);
      const caminho = path.join(certificadoFolder, nomeArmazenado);

      await fs.promises.writeFile(caminho, req.body, { flag: "wx", mode: 0o600 });
      try {
        await db.executarQuery(
          `UPDATE propostas
           SET certificado_status = 'Sim', certificado_nome_original = ?, certificado_caminho = ?,
               certificado_senha_criptografada = ?, certificado_enviado_em = NOW()
           WHERE id = ?`,
          [nomeOriginal.slice(0, 255), nomeArmazenado, senhaCriptografada, propostaId]
        );
      } catch (dbError) {
        await fs.promises.unlink(caminho).catch(() => {});
        throw dbError;
      }

      if (proposta.certificado_caminho) {
        const anterior = path.join(certificadoFolder, path.basename(proposta.certificado_caminho));
        await fs.promises.unlink(anterior).catch(() => {});
      }

      return res.json({ success: true, nomeArquivo: nomeOriginal });
    } catch (error) {
      next(error);
    }
  }
);

router.get("/api/propostas/:token/publica", async (req, res, next) => {
  try {
    const { token } = req.params;
    // consultor_*: contato do vendedor no cartão (vCard) da página; antes a página usava o e-mail/telefone do próprio cliente
    const propostas = await db.executarQuery(
      `SELECT p.*, u.nome AS consultor_nome, u.email AS consultor_email, u.telefone AS consultor_telefone
       FROM propostas p LEFT JOIN usuarios u ON u.id = p.criado_por
       WHERE p.token_acesso = ? LIMIT 1`,
      [token],
    );

    if (propostas.length === 0) {
      return res.status(404).json({
        error: "Proposta não encontrada ou link inválido.",
      });
    }

    const proposta = propostas[0];

    const insertResult = await db.execute(
      `INSERT INTO proposta_visualizacoes (proposta_id, ip, user_agent) VALUES (?, ?, ?)`,
      [
        proposta.id,
        req.ip || req.socket?.remoteAddress || "",
        req.headers["user-agent"] || "",
      ],
    );

    const visualizacaoId = insertResult[0]?.insertId || insertResult?.insertId || 0;

    const ua = req.headers["user-agent"] || "";
    let dispositivo = "💻 Computador";
    if (/iphone/i.test(ua)) dispositivo = "📱 iPhone";
    else if (/ipad/i.test(ua)) dispositivo = "📱 iPad";
    else if (/android/i.test(ua)) dispositivo = "📱 Android";
    else if (/macintosh|mac os x/i.test(ua)) dispositivo = "💻 Mac";

    notificationService.enviarNotificacao("visualizada", {
      id: proposta.id,
      numeroProposta: proposta.numero_proposta,
      nomeClinica: proposta.nome_clinica,
      nomeSocio: proposta.nome_socio || "Cliente",
      telefone: proposta.telefone || "",
      tipoProposta: proposta.tipo_proposta,
      criadoPor: proposta.criado_por,
      dispositivo,
      tokenAcesso: proposta.token_acesso,
      ip: req.ip || req.socket?.remoteAddress || ""
    }, [proposta.criado_por]);

    const viewsAnteriores = await db.executarQuery(
      `SELECT COUNT(id) AS total FROM proposta_visualizacoes WHERE proposta_id = ?`,
      [proposta.id]
    );
    // A visualização atual já foi gravada acima: total inclui esta abertura (antes "> 0" marcava toda abertura como reabertura)
    const totalViews = Number(viewsAnteriores[0]?.total || 0);
    const ehReabertura = totalViews > 1;

    const tipoEventoTeams = ehReabertura ? "reaberta" : "visualizada";

    auditService.registrarLogProposta({
      proposta_id: proposta.id,
      usuario_nome: "Cliente (Portal)",
      usuario_role: "Cliente",
      acao: ehReabertura ? "REABERTURA_CLIENTE" : "VISUALIZACAO_CLIENTE",
      titulo: ehReabertura ? "Proposta Reaberta pelo Cliente" : "Proposta Visualizada pelo Cliente",
      detalhes: `Acesso realizado via ${dispositivo}. IP: ${req.ip || "não identificado"}. Total de acessos: ${totalViews}.`,
      ip: req.ip || ""
    }).catch(e => console.warn("Erro ao registrar visualização no audit log:", e.message));

    teamsService.enviarNotificacaoTeams(tipoEventoTeams, {
      id: proposta.id,
      numeroProposta: proposta.numero_proposta,
      nomeClinica: proposta.nome_clinica,
      nomeSocio: proposta.nome_socio,
      telefone: proposta.telefone,
      tipoProposta: proposta.tipo_proposta,
      totalVisualizacoes: totalViews,
      dispositivo,
      ip: req.ip || req.socket?.remoteAddress || ""
    }).catch(() => {});

    // Gatilho automático no CRM: move o card para 'Visualizada / Em Análise'
    try {
      const crmPipelineService = require("../services/crmPipelineService");
      crmPipelineService.tratarAberturaProposta(proposta.id, req.ip || "", req.headers["user-agent"] || "").catch(() => {});
    } catch (e) {}

    let itens = [];
    if (proposta.itens_json) {
      try {
        itens = typeof proposta.itens_json === "string" ? JSON.parse(proposta.itens_json) : proposta.itens_json;
      } catch (e) {}
    }
    if (!Array.isArray(itens) || itens.length === 0) {
      const rowsItens = await db.executarQuery(
        `SELECT servico, observacao, tipo, valor FROM proposta_itens WHERE proposta_id = ?`,
        [proposta.id]
      );
      itens = rowsItens;
    }

    // Rota pública: nunca expor dados internos do certificado digital nem o IP do aceite / UUID do D4Sign
    const { certificado_caminho, certificado_senha_criptografada, ip_assinatura, ...propostaPublica } = proposta;
    res.json({ ...propostaPublica, itens, visualizacao_id: visualizacaoId });
  } catch (error) {
    next(error);
  }
});

// --- HEARTBEAT TEMPO DE LEITURA ---
router.post("/api/propostas/:token/heartbeat", async (req, res, next) => {
  try {
    const { visualizacao_id, segundos } = req.body || {};
    if (visualizacao_id && segundos) {
      // Só soma na visualização da própria proposta do token, entre 1 e 60 s por batida
      await db.executarQuery(
        `UPDATE proposta_visualizacoes v
         JOIN propostas p ON p.id = v.proposta_id
         SET v.duracao_segundos = COALESCE(v.duracao_segundos, 0) + ?
         WHERE v.id = ? AND p.token_acesso = ?`,
        [Math.max(1, Math.min(Number(segundos) || 15, 60)), visualizacao_id, req.params.token]
      ).catch(() => {});
    }
    return res.json({ success: true });
  } catch (e) {
    return res.json({ success: false });
  }
});

// --- SECURE PUBLIC PDF ---
router.get("/api/propostas/:token/pdf", async (req, res, next) => {
  try {
    const { token } = req.params;

    if (!/^[A-Za-z0-9_-]{20,128}$/.test(token)) {
      return res.status(400).json({ error: "Token de proposta inválido." });
    }

    const propostas = await db.executarQuery(
      `SELECT id, numero_proposta FROM propostas WHERE token_acesso = ? LIMIT 1`,
      [token],
    );

    if (propostas.length === 0) {
      return res.status(404).json({ error: "Proposta não encontrada ou link inválido." });
    }

    const pdfPath = path.join(pdfFolder, `${token}.pdf`);

    if (!fs.existsSync(pdfPath)) {
      try {
        const fullProps = await db.executarQuery(
          `SELECT * FROM propostas WHERE token_acesso = ? LIMIT 1`,
          [token],
        );
        if (fullProps.length > 0) {
          const prop = fullProps[0];
          const itens = JSON.parse(prop.itens_json || "[]");
          const topicosPdf = await buscarTopicosPdfPorItens(itens);

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

          let dataFormatadaStr = prop.data_proposta;
          if (prop.data_proposta instanceof Date) {
            const d = prop.data_proposta;
            dataFormatadaStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          }

          const dadosPdf = {
            isContrato: false,
            numeroProposta: prop.numero_proposta,
            dataProposta: dataFormatadaStr,
            nomeClinica: prop.nome_clinica,
            razaoSocial: prop.razao_social || "",
            cnpj: prop.cnpj || "",
            nomeSocio: prop.nome_socio || "",
            cpfSocio: prop.cpf_socio || "",
            email: prop.email,
            telefone: prop.telefone || "",
            enderecoClinica: prop.endereco_clinica || "",
            cadeiras: prop.cadeiras || 0,
            funcionarios: prop.funcionarios || 0,
            socios: prop.socios || 0,
            faturamento: prop.faturamento || 0,
            regimeFiscal: prop.regime_fiscal || "",
            regimeHibrido: prop.regime_hibrido || "",
            distanciaKm: prop.distancia_km || 0,
            metragem: prop.metragem || 0,
            totalMensal,
            totalPontual,
            total: Number(prop.valor_total || 0),
            tipoProposta: prop.tipo_proposta || "finora",
            empresaProposta: prop.empresa_proposta || "FINORA",
            itens,
            topicosPdf,
            justificativaDesconto: prop.justificativa_desconto || "",
            documentoStatus: prop.documento_status,
            tokenAcesso: token,
            contratada: await obterContratada(prop.tipo_proposta),
          };

          const novoBuffer = await gerarPDFProposta(dadosPdf);
          fs.writeFileSync(pdfPath, novoBuffer);
        }
      } catch (genErr) {
        console.error("[PDF Route] Erro ao regenerar PDF sob demanda:", genErr.message);
      }
    }

    if (!fs.existsSync(pdfPath)) {
      return res.status(404).json({
        error: "O PDF desta proposta não está disponível. Solicite um novo link ao responsável.",
      });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="proposta-${propostas[0].numero_proposta || token}.pdf"`,
    );
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("Pragma", "no-cache");

    return res.sendFile(pdfPath, (error) => {
      if (error && !res.headersSent) {
        next(error);
      }
    });
  } catch (error) {
    next(error);
  }
});

// --- MINUTA DE CONTRATO (HTML) ---
router.get("/api/propostas/:token/contrato", async (req, res, next) => {
  try {
    const { token } = req.params;
    const propostas = await db.executarQuery(
      `SELECT * FROM propostas WHERE token_acesso = ? LIMIT 1`,
      [token],
    );

    if (propostas.length === 0) {
      return res.status(404).send("<h3>Proposta não encontrada.</h3>");
    }

    const html = gerarHTMLContrato({ ...propostas[0], contratada: await obterContratada(propostas[0].tipo_proposta) });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(html);
  } catch (error) {
    next(error);
  }
});

// --- MINUTA DE CONTRATO (PDF) ---
router.get("/api/propostas/:token/contrato/pdf", async (req, res, next) => {
  try {
    const { token } = req.params;
    const propostas = await db.executarQuery(
      `SELECT * FROM propostas WHERE token_acesso = ? LIMIT 1`,
      [token],
    );

    if (propostas.length === 0) {
      return res.status(404).json({ error: "Proposta não encontrada." });
    }

    const pdfBuffer = await gerarPDFContrato({ ...propostas[0], contratada: await obterContratada(propostas[0].tipo_proposta) });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="contrato-prestacao-servicos-${propostas[0].numero_proposta || token}.pdf"`,
    );
    return res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
});

// --- ONBOARDING: UPLOAD DE DOCUMENTOS (OPCIONAL) ---
// Binário cru (application/octet-stream) para não esbarrar no express.json de 2mb nem no overhead do base64.
const TIPOS_DOCUMENTO_ONBOARDING = ["Contrato Social", "Certificado Digital A1", "Alvará Sanitário", "Folha de Pagamento"];
// Rota pública (só o token): teto por proposta para ninguém encher o disco com o link
const MAX_DOCUMENTOS_POR_PROPOSTA = 30;
const MAX_BYTES_POR_PROPOSTA = 150 * 1024 * 1024;
const EXTENSOES_DOCUMENTO_ONBOARDING = [".pdf", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".heic", ".pfx", ".p12", ".xlsx", ".xls", ".csv"];

router.post(
  "/api/propostas/:token/documentos",
  express.raw({ type: "application/octet-stream", limit: "25mb" }),
  async (req, res, next) => {
  try {
    const { token } = req.params;
    let tipo_documento, nome_arquivo;
    try {
      tipo_documento = decodeURIComponent(String(req.headers["x-tipo-documento"] || ""));
      nome_arquivo = decodeURIComponent(String(req.headers["x-nome-arquivo"] || "")).slice(0, 255);
    } catch {
      return res.status(400).json({ error: "Nome de arquivo inválido." });
    }

    if (!TIPOS_DOCUMENTO_ONBOARDING.includes(tipo_documento) || !nome_arquivo) {
      return res.status(400).json({ error: "Arquivo ou tipo de documento inválido." });
    }
    if (!EXTENSOES_DOCUMENTO_ONBOARDING.includes(path.extname(nome_arquivo).toLowerCase())) {
      return res.status(400).json({ error: "Formato não permitido. Envie PDF, imagem, planilha ou certificado (.pfx/.p12)." });
    }
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ error: "Arquivo vazio ou não enviado." });
    }

    const propostas = await db.executarQuery(
      `SELECT id, numero_proposta, nome_clinica, status FROM propostas WHERE token_acesso = ? LIMIT 1`,
      [token],
    );

    if (propostas.length === 0) {
      return res.status(404).json({ error: "Proposta não encontrada." });
    }

    const proposta = propostas[0];
    const buffer = req.body;
    if (proposta.status === "Recusada") {
      return res.status(409).json({ error: "Esta proposta foi recusada e não recebe mais documentos." });
    }
    const [uso] = await db.executarQuery(
      "SELECT COUNT(*) AS qtd, COALESCE(SUM(tamanho_bytes), 0) AS bytes FROM proposta_documentos WHERE proposta_id = ?",
      [proposta.id],
    );
    if (Number(uso.qtd) >= MAX_DOCUMENTOS_POR_PROPOSTA || Number(uso.bytes) + buffer.length > MAX_BYTES_POR_PROPOSTA) {
      return res.status(413).json({ error: "Limite de documentos desta proposta atingido. Fale com seu consultor." });
    }

    const safeName = nome_arquivo.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileId = `${Date.now()}_${crypto.randomBytes(4).toString("hex")}_${safeName}`;
    const filePath = path.join(documentosFolder, fileId);

    await fs.promises.writeFile(filePath, buffer, { flag: "wx", mode: 0o600 });

    let insertRes;
    try {
      insertRes = await db.execute(
        `INSERT INTO proposta_documentos (proposta_id, nome_original, tipo_documento, caminho_arquivo, tamanho_bytes, enviado_em)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [proposta.id, nome_arquivo, tipo_documento, fileId, buffer.length]
      );
    } catch (dbError) {
      await fs.promises.unlink(filePath).catch(() => {});
      throw dbError;
    }

    return res.json({
      success: true,
      documento: {
        id: insertRes[0]?.insertId || insertRes?.insertId,
        nome_original: nome_arquivo,
        tipo_documento,
        tamanho_bytes: buffer.length,
        enviado_em: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

// --- ONBOARDING: LISTAR DOCUMENTOS PÚBLICOS ---
router.get("/api/propostas/:token/documentos", async (req, res, next) => {
  try {
    const { token } = req.params;
    const propostas = await db.executarQuery(
      `SELECT id FROM propostas WHERE token_acesso = ? LIMIT 1`,
      [token],
    );

    if (propostas.length === 0) {
      return res.status(404).json({ error: "Proposta não encontrada." });
    }

    const docs = await db.executarQuery(
      `SELECT id, nome_original, tipo_documento, tamanho_bytes, enviado_em FROM proposta_documentos WHERE proposta_id = ? ORDER BY enviado_em DESC`,
      [propostas[0].id]
    );

    return res.json(docs);
  } catch (error) {
    next(error);
  }
});

// --- ONBOARDING: LISTAR DOCUMENTOS (DASHBOARD) ---
// Path distinto: "/api/propostas/:id/documentos" era capturado pela rota pública "/:token/documentos" acima.
router.get("/api/propostas/:id/documentos-internos", verificarToken, donoProposta, async (req, res, next) => {
  try {
    const { id } = req.params;
    const docs = await db.executarQuery(
      `SELECT id, nome_original, tipo_documento, tamanho_bytes, enviado_em FROM proposta_documentos WHERE proposta_id = ? ORDER BY enviado_em DESC`,
      [id]
    );
    return res.json(docs);
  } catch (error) {
    next(error);
  }
});

async function enviarDocumentoOnboarding(res, doc) {
  const filePath = path.join(documentosFolder, path.basename(doc.caminho_arquivo));
  if (!fs.existsSync(filePath)) {
    return res.status(404).send("Arquivo físico não encontrado no servidor.");
  }
  res.download(filePath, doc.nome_original);
}

// --- ONBOARDING: DOWNLOAD PÚBLICO (cliente, validado pelo token da proposta) ---
router.get("/api/propostas/:token/documentos/:docId/download", async (req, res, next) => {
  try {
    const docs = await db.executarQuery(
      `SELECT d.* FROM proposta_documentos d
       JOIN propostas p ON p.id = d.proposta_id
       WHERE d.id = ? AND p.token_acesso = ? LIMIT 1`,
      [req.params.docId, req.params.token]
    );
    if (docs.length === 0) return res.status(404).send("Documento não encontrado.");
    return enviarDocumentoOnboarding(res, docs[0]);
  } catch (error) {
    next(error);
  }
});

// --- ONBOARDING: DOWNLOAD INTERNO (dashboard, exige JWT) ---
router.get("/api/documentos/:id/download", verificarToken, donoDocumento, async (req, res, next) => {
  try {
    const docs = await db.executarQuery(
      `SELECT * FROM proposta_documentos WHERE id = ? LIMIT 1`,
      [req.params.id]
    );
    if (docs.length === 0) return res.status(404).send("Documento não encontrado.");
    return enviarDocumentoOnboarding(res, docs[0]);
  } catch (error) {
    next(error);
  }
});

// --- D4SIGN SIGNATURE LINK ---
router.get("/api/propostas/:token/link-assinatura", async (req, res, next) => {
  try {
    const { token } = req.params;
    const propostas = await db.executarQuery(
      `SELECT p.*, u.email AS criador_email, u.nome AS criador_nome 
       FROM propostas p 
       LEFT JOIN usuarios u ON p.criado_por = u.id 
       WHERE p.token_acesso = ? LIMIT 1`,
      [token]
    );

    if (propostas.length === 0) {
      return res.status(404).json({ error: "Proposta não encontrada." });
    }

    const proposta = propostas[0];
    // Contrato só depois do aceite: recusada ou em análise interna não pode gerar documento no D4Sign
    if (proposta.status !== "Aprovada") {
      return res.status(409).json({
        error: MENSAGEM_BLOQUEIO_APROVACAO[proposta.status] || "Aprove a proposta antes de assinar o contrato.",
      });
    }
    let uuidDocumento = proposta.ip_assinatura;

    // Se ainda não foi gerado o documento na D4Sign (não tem formato de UUID válido), geramos agora dinamicamente!
    if (!ehUuidD4Sign(uuidDocumento)) {
      console.log(`[Link Assinatura] Proposta #${proposta.numero_proposta} não tem D4Sign cadastrado. Gerando contrato agora...`);

      // 1. Carregar itens e tópicos do PDF
      const itens = lerJson(proposta.itens_json);
      const topicosPdf = await buscarTopicosPdfPorItens(itens);

      // Separar mensal de pontual para a estrutura do PDF
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

      // Formatando data para o PDF
      let dataFormatadaStr = proposta.data_proposta;
      if (proposta.data_proposta instanceof Date) {
        const d = proposta.data_proposta;
        dataFormatadaStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      }

      const dadosContrato = {
        // camelCase para gerarPDFProposta
        isContrato: true,
        numeroProposta: proposta.numero_proposta,
        dataProposta: dataFormatadaStr,
        nomeClinica: proposta.nome_clinica,
        razaoSocial: proposta.razao_social || "",
        cnpj: proposta.cnpj || "",
        nomeSocio: proposta.nome_socio || "",
        cpfSocio: proposta.cpf_socio || "",
        email: proposta.email,
        telefone: proposta.telefone || "",
        enderecoClinica: proposta.endereco_clinica || "",
        cadeiras: proposta.cadeiras || 0,
        dentistasParceiros: proposta.dentistas_parceiros || 0,
        funcionarios: proposta.funcionarios || 0,
        socios: proposta.socios || 0,
        faturamento: proposta.faturamento || 0,
        regimeFiscal: proposta.regime_fiscal || "",
        regimeHibrido: proposta.regime_hibrido || "",
        distanciaKm: proposta.distancia_km || 0,
        metragem: proposta.metragem || 0,
        totalMensal,
        totalPontual,
        total: Number(proposta.valor_total || 0),
        tipoProposta: proposta.tipo_proposta || "finora",
        empresaProposta: proposta.empresa_proposta || "FINORA",
        itens,
        topicosPdf,
        justificativaDesconto: proposta.justificativa_desconto || "",
        // snake_case para d4signService
        id: proposta.id,
        numero_proposta: proposta.numero_proposta,
        nome_clinica: proposta.nome_clinica,
        nome_socio: proposta.nome_socio || "",
        tipo_proposta: proposta.tipo_proposta || "finora",
        criador_email: proposta.criador_email || null,
        criador_nome: proposta.criador_nome || null,
      };

      try {
        console.log(`[Link Assinatura] Gerando PDF do contrato para proposta #${proposta.numero_proposta}...`);
        const contractPdfBuffer = await gerarPDFProposta({ ...dadosContrato, tokenAcesso: token, contratada: await obterContratada(dadosContrato.tipoProposta) });

        console.log(`[Link Assinatura] Enviando contrato para D4Sign...`);
        uuidDocumento = await d4signService.iniciarAssinaturaProposta(dadosContrato, contractPdfBuffer);
        console.log(`[Link Assinatura] Contrato enviado ao D4Sign. UUID: ${uuidDocumento}`);
      } catch (contractError) {
        console.error(`[Link Assinatura] Erro ao gerar/enviar contrato para D4Sign:`, contractError.message);
      }
    }

    // Tentar obter o link direto de assinatura para o e-mail do cliente
    if (ehUuidD4Sign(uuidDocumento)) {
      console.log(`[Link Assinatura] Obtendo link direto de assinatura para ${proposta.email}...`);
      const linkAssinatura = await d4signService.obterLinkAssinatura(uuidDocumento, proposta.email);
      if (linkAssinatura) {
        return res.json({ url: linkAssinatura });
      }
    }

    // Fallback: se não houver UUID ou falhar, retorna o PDF local da proposta
    const pdfUrl = `${BASE_URL}/api/propostas/${encodeURIComponent(token)}/pdf`;
    res.json({ url: pdfUrl });
  } catch (error) {
    next(error);
  }
});

// --- APPROVE ---
router.post("/api/propostas/:token/aprovar", async (req, res, next) => {
  try {
    const { token } = req.params;
    const ipCliente = req.ip || req.socket?.remoteAddress;

    // criador_*: o vendedor entra como signatário no D4Sign
    const propostas = await db.executarQuery(
      `SELECT p.*, u.email AS criador_email, u.nome AS criador_nome
       FROM propostas p LEFT JOIN usuarios u ON p.criado_por = u.id
       WHERE p.token_acesso = ?`,
      [token],
    );

    if (propostas.length === 0) {
      return res.status(404).json({ error: "Proposta não encontrada ou link inválido." });
    }

    const prop = propostas[0];
    if (MENSAGEM_BLOQUEIO_APROVACAO[prop.status]) {
      return res.status(409).json({ error: MENSAGEM_BLOQUEIO_APROVACAO[prop.status] });
    }
    if (propostaVencida(prop)) {
      return res.status(409).json({ error: MENSAGEM_PROPOSTA_VENCIDA, vencida: true });
    }
    let uuidDocumento = prop.ip_assinatura;
    const jaTemD4Sign = ehUuidD4Sign(uuidDocumento);
    let contratoEnviado = Boolean(jaTemD4Sign);

    // UPDATE condicional: só um de dois cliques simultâneos passa (o outro geraria segundo contrato no D4Sign)
    const [atualizacao] = await db.execute(
      `UPDATE propostas SET status = 'Aprovada', data_decisao = NOW()${jaTemD4Sign ? "" : ", ip_assinatura = ?"}
       WHERE token_acesso = ? AND status NOT IN ('Aprovada', 'Recusada', 'Aguardando Aprovação')`,
      jaTemD4Sign ? [token] : [ipCliente, token],
    );
    if (atualizacao.affectedRows === 0) {
      return res.status(409).json({ error: "Esta proposta já foi aprovada." });
    }

    // Quem assinou na tela de aceite (a assinatura com validade é a do D4Sign; o desenho não é guardado)
    const texto = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
    const nomeSignatario = texto(req.body?.nomeSignatario, 150);
    // LGPD: CPF completo segue só para o D4Sign; aqui fica mascarado (IP e data_decisao seguem como evidência)
    const cpfSignatario = mascararCpf(texto(req.body?.cpfSignatario, 20));
    if (nomeSignatario || cpfSignatario) {
      await db.execute(
        "INSERT INTO proposta_observacoes (proposta_id, usuario_id, observacao) VALUES (?, ?, ?)",
        [prop.id, prop.criado_por, `Aceite do cliente na página da proposta: ${nomeSignatario || "nome não informado"} (CPF ${cpfSignatario || "não informado"}), IP ${ipCliente}.`],
      ).catch((e) => console.warn("[Aprovação] Erro ao registrar signatário:", e.message));
    }

    auditService.registrarLogProposta({
      proposta_id: prop.id,
      usuario_nome: nomeSignatario || "Cliente (Portal)",
      usuario_role: "Cliente",
      acao: "APROVACAO_CLIENTE",
      titulo: "Proposta Aprovada pelo Cliente",
      detalhes: `Aceite formalizado via portal por ${nomeSignatario || "Cliente"} ${cpfSignatario ? "(CPF " + cpfSignatario + ")" : ""}. Valor total: R$ ${Number(prop.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}. IP: ${ipCliente}`,
      dados_novos: { status: "Aprovada", signatario: nomeSignatario, cpf: cpfSignatario },
      ip: ipCliente
    }).catch(e => console.warn("[Aprovação] Erro ao registrar audit log:", e.message));

    // 1. Notificar responsável interno
    try {
      if (!(await emailService.notificarHugo(prop))) console.error("[Aprovação] Aviso interno de aprovação não foi entregue (e-mail).");
    } catch (e) {
      console.error("[Aprovação] Erro ao notificar responsável:", e.message);
    }

    // 2. Disparar notificação interna no sistema
    notificationService.enviarNotificacao("aprovada", {
      id: prop.id,
      numeroProposta: prop.numero_proposta,
      nomeClinica: prop.nome_clinica,
      tipoProposta: prop.tipo_proposta,
      criadoPor: prop.criado_por,
    }, [prop.criado_por]);

    teamsService.enviarNotificacaoTeams("aprovada", {
      id: prop.id,
      numeroProposta: prop.numero_proposta,
      nomeClinica: prop.nome_clinica,
      nomeSocio: prop.nome_socio,
      tipoProposta: prop.tipo_proposta,
      valorTotal: prop.valor_total,
      investimentoMensal: prop.investimento_mensal
    }).catch(() => {});

    // 3. Gerar PDF do contrato e enviar para D4Sign (apenas se ainda não foi enviado!)
    if (!jaTemD4Sign) {
      try {
        const itens = lerJson(prop.itens_json);
        const topicosPdf = await buscarTopicosPdfPorItens(itens);

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

        let dataFormatadaStr = prop.data_proposta;
        if (prop.data_proposta instanceof Date) {
          const d = prop.data_proposta;
          dataFormatadaStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
        }

        // Montar objeto com campos camelCase para gerarPDFProposta + snake_case para d4signService
        const dadosContrato = {
          // camelCase para gerarPDFProposta
          isContrato: true,
          numeroProposta: prop.numero_proposta,
          dataProposta: dataFormatadaStr,
          nomeClinica: prop.nome_clinica,
          razaoSocial: prop.razao_social || "",
          cnpj: prop.cnpj || "",
          nomeSocio: prop.nome_socio || "",
          cpfSocio: prop.cpf_socio || "",
          email: prop.email,
          telefone: prop.telefone || "",
          enderecoClinica: prop.endereco_clinica || "",
          cadeiras: prop.cadeiras || 0,
          dentistasParceiros: prop.dentistas_parceiros || 0,
          funcionarios: prop.funcionarios || 0,
          socios: prop.socios || 0,
          faturamento: prop.faturamento || 0,
          regimeFiscal: prop.regime_fiscal || "",
          regimeHibrido: prop.regime_hibrido || "",
          distanciaKm: prop.distancia_km || 0,
          metragem: prop.metragem || 0,
          totalMensal,
          totalPontual,
          total: Number(prop.valor_total || 0),
          tipoProposta: prop.tipo_proposta || "finora",
          empresaProposta: prop.empresa_proposta || "FINORA",
          itens,
          topicosPdf,
          justificativaDesconto: prop.justificativa_desconto || "",
          // snake_case para d4signService
          id: prop.id,
          numero_proposta: prop.numero_proposta,
          nome_clinica: prop.nome_clinica,
          nome_socio: prop.nome_socio || "",
          tipo_proposta: prop.tipo_proposta || "finora",
          criador_email: prop.criador_email || null,
          criador_nome: prop.criador_nome || null,
        };

        console.log(`[Aprovação] Gerando PDF do contrato para proposta #${prop.numero_proposta}...`);
        const contractPdfBuffer = await gerarPDFProposta({ ...dadosContrato, tokenAcesso: token, contratada: await obterContratada(dadosContrato.tipoProposta) });

        console.log(`[Aprovação] Enviando contrato para D4Sign...`);
        // iniciarAssinaturaProposta já envia o e-mail internamente
        const contractUuid = await d4signService.iniciarAssinaturaProposta(dadosContrato, contractPdfBuffer);
        console.log(`[Aprovação] Contrato enviado ao D4Sign. UUID: ${contractUuid}`);
        contratoEnviado = true;
      } catch (contractError) {
        console.error(`[Aprovação] Erro ao gerar/enviar contrato para D4Sign:`, contractError.message);
        // Não bloquear a aprovação por erro no D4Sign, mas avisar a equipe para envio manual
        emailService.notificarFalhaContrato(prop, contractError.message).catch(() => {});
      }
    } else {
      console.log(`[Aprovação] Contrato D4Sign já gerado anteriormente (UUID: ${uuidDocumento}). Pulando novo envio.`);
    }

    // Disparo automático de WhatsApp de boas-vindas ao cliente
    if (prop) {
      whatsappService.notificarAssinaturaRealizada(prop).catch((e) => {
        console.warn("[WhatsApp Auto] Erro no envio de boas-vindas:", e.message);
      });
    }

    return res.status(200).json({
      success: true,
      contratoEnviado,
      message: contratoEnviado
        ? "Proposta aprovada! Contrato enviado para assinatura eletrônica."
        : "Proposta aprovada! Nossa equipe enviará o contrato para assinatura em breve.",
    });
  } catch (error) {
    next(error);
  }
});


// --- APPROVE PARCIAL ---
router.post("/api/propostas/:token/aprovar-parcial", async (req, res, next) => {
  try {
    const { token } = req.params;
    const { itensAprovados: itensEnviados, itensRecusados = [] } = req.body || {};
    const ipCliente = req.ip || req.socket?.remoteAddress;

    if (!Array.isArray(itensEnviados) || itensEnviados.length === 0 || !Array.isArray(itensRecusados)) {
      return res.status(400).json({ error: "É necessário aprovar pelo menos um serviço." });
    }

    // criador_*: o vendedor entra como signatário no D4Sign (mesmo SELECT do /aprovar)
    const propostas = await db.executarQuery(
      `SELECT p.*, u.email AS criador_email, u.nome AS criador_nome
       FROM propostas p LEFT JOIN usuarios u ON p.criado_por = u.id
       WHERE p.token_acesso = ?`,
      [token]
    );

    if (propostas.length === 0) {
      return res.status(404).json({ error: "Proposta não encontrada ou link inválido." });
    }

    const prop = propostas[0];
    let uuidDocumento = prop.ip_assinatura;
    const jaTemD4Sign = ehUuidD4Sign(uuidDocumento);

    if (prop.status === "Aprovada") {
      return res.status(400).json({ error: "Esta proposta já foi aprovada. Não é possível alterá-la." });
    }
    if (MENSAGEM_BLOQUEIO_APROVACAO[prop.status]) {
      return res.status(409).json({ error: MENSAGEM_BLOQUEIO_APROVACAO[prop.status] });
    }
    if (propostaVencida(prop)) {
      return res.status(409).json({ error: MENSAGEM_PROPOSTA_VENCIDA, vencida: true });
    }

    // Rota pública: preço e escopo vêm SEMPRE do banco; do cliente só aceitamos quais serviços (por nome) foram aprovados.
    let itensRestantes = [...lerJson(prop.itens_json)];
    if (itensRestantes.length === 0) {
      // Mesmo fallback da rota /publica para propostas antigas sem itens_json
      itensRestantes = await db.executarQuery(
        `SELECT servico, observacao, tipo, valor FROM proposta_itens WHERE proposta_id = ?`,
        [prop.id]
      );
    }
    const itensAprovados = [];
    for (const enviado of itensEnviados) {
      const idx = itensRestantes.findIndex((o) => o.servico === enviado?.servico);
      if (idx >= 0) itensAprovados.push(itensRestantes.splice(idx, 1)[0]);
    }
    if (itensAprovados.length === 0) {
      return res.status(400).json({ error: "Nenhum serviço aprovado corresponde aos itens da proposta." });
    }

    // Recalcular Total e montar log
    let novoTotal = 0;
    itensAprovados.forEach(i => novoTotal += Number(i.valor || 0) * (i.quantidade || 1));

    let logMotivos = "Aprovação Parcial. Serviços recusados:\n";
    itensRecusados.forEach(i => {
      logMotivos += `- ${String(i?.servico || i?.nome || "").slice(0, 200)}: ${String(i?.motivoRecusa || "").slice(0, 1000)}\n`;
    });

    if (jaTemD4Sign) {
      await db.execute(
        `UPDATE propostas SET status = 'Aprovada', data_decisao = NOW(), valor_total = ?, itens_json = ? WHERE token_acesso = ?`,
        [novoTotal, JSON.stringify(itensAprovados), token]
      );
    } else {
      await db.execute(
        `UPDATE propostas SET status = 'Aprovada', ip_assinatura = ?, data_decisao = NOW(), valor_total = ?, itens_json = ? WHERE token_acesso = ?`,
        [ipCliente, novoTotal, JSON.stringify(itensAprovados), token]
      );
    }

    // Salvar observação
    await db.execute(
      `INSERT INTO proposta_observacoes (proposta_id, usuario_id, observacao) VALUES (?, ?, ?)`,
      // usuario_id é NOT NULL: ação do cliente fica registrada no responsável pela proposta
      [prop.id, prop.criado_por || 1, logMotivos]
    );

    auditService.registrarLogProposta({
      proposta_id: prop.id,
      usuario_nome: "Cliente (Portal)",
      usuario_role: "Cliente",
      acao: "APROVACAO_PARCIAL_CLIENTE",
      titulo: "Aprovação de Escopo Parcial pelo Cliente",
      detalhes: `Cliente selecionou ${itensAprovados.length} serviço(s) e recusou ${itensRecusados.length}. Novo valor total: R$ ${novoTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (anterior: R$ ${Number(prop.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}).`,
      dados_anteriores: { valor_total: prop.valor_total },
      dados_novos: { valor_total: novoTotal, itensAprovados, itensRecusados },
      ip: ipCliente
    }).catch(e => console.warn("[Aprovação Parcial] Erro ao registrar audit log:", e.message));

    // 1. Notificar responsável interno
    try { await emailService.notificarHugo(prop); } catch (e) {}

    // 2. Disparar notificação interna no sistema
    notificationService.enviarNotificacao("aprovada", {
      id: prop.id,
      numeroProposta: prop.numero_proposta,
      nomeClinica: prop.nome_clinica,
      tipoProposta: prop.tipo_proposta,
      criadoPor: prop.criado_por,
    }, [prop.criado_por]);

    // 3. Gerar PDF do contrato e enviar para D4Sign (apenas se ainda não foi enviado!)
    if (!jaTemD4Sign) {
      try {
        const itens = itensAprovados;
        const topicosPdf = await buscarTopicosPdfPorItens(itens);

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

        let dataFormatadaStr = prop.data_proposta;
        if (prop.data_proposta instanceof Date) {
          const d = prop.data_proposta;
          dataFormatadaStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
        }

        const dadosContrato = {
          isContrato: true,
          numeroProposta: prop.numero_proposta,
          dataProposta: dataFormatadaStr,
          nomeClinica: prop.nome_clinica,
          razaoSocial: prop.razao_social || "",
          cnpj: prop.cnpj || "",
          nomeSocio: prop.nome_socio || "",
          cpfSocio: prop.cpf_socio || "",
          email: prop.email,
          telefone: prop.telefone || "",
          enderecoClinica: prop.endereco_clinica || "",
          cadeiras: prop.cadeiras || 0,
          dentistasParceiros: prop.dentistas_parceiros || 0,
          funcionarios: prop.funcionarios || 0,
          socios: prop.socios || 0,
          faturamento: prop.faturamento || 0,
          regimeFiscal: prop.regime_fiscal || "",
          regimeHibrido: prop.regime_hibrido || "",
          distanciaKm: prop.distancia_km || 0,
          metragem: prop.metragem || 0,
          totalMensal,
          totalPontual,
          total: novoTotal,
          tipoProposta: prop.tipo_proposta || "finora",
          empresaProposta: prop.empresa_proposta || "FINORA",
          itens,
          topicosPdf,
          justificativaDesconto: prop.justificativa_desconto || "",
          documentoStatus: prop.documento_status,
          id: prop.id,
          numero_proposta: prop.numero_proposta,
          nome_clinica: prop.nome_clinica,
          nome_socio: prop.nome_socio || "",
          tipo_proposta: prop.tipo_proposta || "finora",
          criador_email: prop.criador_email || null,
          criador_nome: prop.criador_nome || null,
        };

        const contractPdfBuffer = await gerarPDFProposta({ ...dadosContrato, tokenAcesso: token, contratada: await obterContratada(dadosContrato.tipoProposta) });
        await d4signService.iniciarAssinaturaProposta(dadosContrato, contractPdfBuffer);
      } catch (contractError) {
        console.error(`[Aprovação Parcial] Erro ao gerar/enviar contrato para D4Sign:`, contractError.message);
        emailService.notificarFalhaContrato(prop, contractError.message).catch(() => {});
      }
    }

    if (prop) {
      whatsappService.notificarAssinaturaRealizada(prop).catch(() => {});
    }

    return res.status(200).json({ success: true, message: "Proposta aprovada parcialmente!" });
  } catch (error) {
    next(error);
  }
});


// --- REFUSE --- (With Transaction)
router.post("/api/propostas/:token/recusar", async (req, res, next) => {
  // Dentro do try: falha ao pegar conexão vira erro tratado, não promise rejeitada sem resposta
  let connection;
  try {
    connection = await db.getConnection();
    const { token } = req.params;
    const { observacao } = req.body;

    if (typeof observacao !== "string" || observacao.trim().length < 5 || observacao.length > 2000) {
      return res.status(400).json({
        error: "Por favor, digite uma justificativa entre 5 e 2000 caracteres.",
      });
    }

    const proposta = await db.executarQuery(
      `SELECT * FROM propostas WHERE token_acesso = ?`,
      [token],
    );

    if (proposta.length === 0) {
      return res.status(404).json({ error: "Proposta não encontrada ou link inválido." });
    }

    const prop = proposta[0];

    if (prop.status === "Aprovada") {
      return res.status(400).json({
        error: "Esta proposta já foi aprovada e assinada. Não é possível recusá-la.",
      });
    }
    if (MENSAGEM_BLOQUEIO_APROVACAO[prop.status]) {
      return res.status(409).json({
        error: prop.status === "Recusada" ? "Esta proposta já foi recusada." : MENSAGEM_BLOQUEIO_APROVACAO[prop.status],
      });
    }

    await connection.beginTransaction();

    await connection.execute(
      `UPDATE propostas SET status = 'Recusada', data_decisao = NOW() WHERE id = ?`,
      [prop.id],
    );

    const notaCliente = `Cliente (Feedback Público): ${observacao.trim()}`;
    await connection.execute(
      `INSERT INTO proposta_observacoes (proposta_id, usuario_id, observacao) VALUES (?, ?, ?)`,
      // usuario_id é NOT NULL: ação do cliente fica registrada no responsável pela proposta
      [prop.id, prop.criado_por || 1, notaCliente],
    );

    await connection.commit();

    auditService.registrarLogProposta({
      proposta_id: prop.id,
      usuario_nome: "Cliente (Portal)",
      usuario_role: "Cliente",
      acao: "RECUSA_CLIENTE",
      titulo: "Proposta Recusada pelo Cliente",
      detalhes: observacao ? `Justificativa informada pelo cliente: "${observacao.trim()}"` : "Proposta recusada sem justificativa.",
      dados_novos: { status: "Recusada", justificativa: observacao.trim() },
      ip: req.ip || ""
    }).catch(e => console.warn("[Recusa] Erro ao registrar audit log:", e.message));

    notificationService.enviarNotificacao("recusada", {
      id: prop.id,
      numeroProposta: prop.numero_proposta,
      nomeClinica: prop.nome_clinica,
      tipoProposta: prop.tipo_proposta,
      criadoPor: prop.criado_por,
      justificativa: observacao.trim(),
    }, [prop.criado_por]);

    return res.json({
      success: true,
      message: "Feedback de recusa/renegociação enviado com sucesso.",
    });
  } catch (error) {
    await connection?.rollback().catch(() => {});
    next(error);
  } finally {
    connection?.release();
  }
});

// --- RE-SEND ---
// --- RENOVAR VALIDADE (consultor) ---
// Recomeça os 10 dias de uma proposta em aberto. O cliente reativa uma vez pelo link; depois disso só por aqui.
router.post("/api/propostas/:id/renovar-validade", verificarToken, donoProposta, async (req, res, next) => {
  try {
    const [resultado] = await db.execute(
      "UPDATE propostas SET validade_inicia_em = NOW() WHERE id = ? AND status = 'Pendente'",
      [req.params.id],
    );
    if (resultado.affectedRows === 0) {
      return res.status(409).json({ error: "Só proposta em aberto (Pendente) pode ter a validade renovada." });
    }
    await db.execute(
      "INSERT INTO proposta_observacoes (proposta_id, usuario_id, observacao) VALUES (?, ?, ?)",
      [req.params.id, req.user.id, `Validade de 10 dias renovada por ${req.user.nome || "consultor"}.`],
    );
    auditService.registrarLogProposta({
      proposta_id: req.params.id,
      usuario_id: req.user.id,
      usuario_nome: req.user.nome || "Consultor",
      usuario_role: req.user.role || "Comercial",
      acao: "RENOVACAO_VALIDADE",
      titulo: "Validade da Proposta Renovada",
      detalhes: `Validade renovada por mais 10 dias por ${req.user.nome || "consultor"}.`,
      ip: req.ip
    }).catch(e => console.warn("Erro ao registrar renovação no audit log:", e.message));
    res.json({ success: true, message: "Validade renovada por mais 10 dias." });
  } catch (error) {
    next(error);
  }
});

router.post("/api/propostas/:id/reenviar", verificarToken, donoProposta, async (req, res, next) => {
  try {
    const propostas = await db.executarQuery(
      `SELECT * FROM propostas WHERE id = ? LIMIT 1`,
      [req.params.id],
    );

    if (propostas.length === 0) {
      return res.status(404).json({ error: "Proposta não encontrada." });
    }

    const proposta = propostas[0];
    if (!proposta.email) {
      return res.status(400).json({ error: "Esta proposta não possui email cadastrado." });
    }
    // Desconto acima da alçada ainda sem aval da diretoria não vai para o cliente
    if (proposta.status === "Aguardando Aprovação") {
      return res.status(409).json({ error: "Proposta aguardando aprovação da diretoria. Ela ainda não pode ser enviada ao cliente." });
    }

    const dadosEmail = {
      email: proposta.email,
      numeroProposta: proposta.numero_proposta,
      nomeClinica: proposta.nome_clinica,
      nomeSocio: proposta.nome_socio,
      tipoProposta: proposta.tipo_proposta || "finora",
    };

    const linkAcesso = linkCurto(proposta.token_acesso);
    if (!(await emailService.enviarEmailLink(dadosEmail, linkAcesso))) {
      return res.status(502).json({ error: "Não foi possível enviar o e-mail para o cliente. Tente novamente ou envie o link manualmente." });
    }

    auditService.registrarLogProposta({
      proposta_id: req.params.id,
      usuario_id: req.user.id,
      usuario_nome: req.user.nome || "Consultor",
      usuario_role: req.user.role || "Comercial",
      acao: "REENVIO_EMAIL",
      titulo: "Proposta Reenviada por E-mail",
      detalhes: `Link da proposta reenviado com sucesso para o e-mail ${proposta.email}.`,
      ip: req.ip
    }).catch(e => console.warn("Erro ao registrar reenvio no audit log:", e.message));

    return res.json({
      success: true,
      message: "Proposta reenviada por email com sucesso.",
    });
  } catch (error) {
    next(error);
  }
});

// --- HISTORY ---
router.get("/api/propostas/:id/historico", verificarToken, donoProposta, async (req, res, next) => {
  try {
    const proposalId = req.params.id;
    let rootId = Number(proposalId);
    let visited = new Set();
    while (rootId) {
      if (visited.has(rootId)) break;
      visited.add(rootId);
      const [prop] = await db.executarQuery(
        "SELECT proposta_pai_id FROM propostas WHERE id = ?",
        [rootId],
      );
      if (!prop || !prop.proposta_pai_id) {
        break;
      }
      rootId = prop.proposta_pai_id;
    }

    let queue = [rootId];
    let allProps = [];
    let collectedIds = new Set();

    while (queue.length > 0) {
      const currentId = queue.shift();
      if (collectedIds.has(currentId)) continue;
      collectedIds.add(currentId);

      const [prop] = await db.executarQuery(
        `SELECT 
          p.id, p.token_acesso, p.numero_proposta, p.data_proposta, p.nome_clinica, p.valor_total,
          p.percentual_desconto, p.valor_desconto, p.criado_por, p.proposta_pai_id, p.criado_em,
          u.nome AS criador,
          CASE 
            WHEN EXISTS (
              SELECT 1 FROM solicitacoes_desconto_item sdi 
              WHERE sdi.proposta_id = p.id AND sdi.status = 'Pendente'
            ) THEN 'Aguardando Aprovação'
            ELSE p.status 
          END AS status
        FROM propostas p
        LEFT JOIN usuarios u ON p.criado_por = u.id
        WHERE p.id = ?`,
        [currentId],
      );

      if (prop) {
        allProps.push(prop);
        const children = await db.executarQuery(
          "SELECT id FROM propostas WHERE proposta_pai_id = ?",
          [currentId],
        );
        children.forEach((c) => queue.push(c.id));
      }
    }

    allProps.sort((a, b) => a.id - b.id);
    // Comercial vê a árvore inteira, mas o token (acesso de cliente) só das propostas dele
    if (req.user.role === "Comercial") {
      for (const p of allProps) {
        if (Number(p.criado_por) !== Number(req.user.id)) delete p.token_acesso;
      }
    }
    return res.json(allProps);
  } catch (error) {
    next(error);
  }
});

// --- VIEWS ---
router.get("/api/propostas/:id/visualizacoes", verificarToken, donoProposta, async (req, res, next) => {
  try {
    const { id } = req.params;
    const visualizacoes = await db.executarQuery(
      `SELECT id, ip, user_agent, visualizado_em, COALESCE(duracao_segundos, 0) AS duracao_segundos FROM proposta_visualizacoes WHERE proposta_id = ? ORDER BY visualizado_em DESC`,
      [id],
    );
    return res.json(visualizacoes);
  } catch (error) {
    next(error);
  }
});

// --- 📑 DOWNLOAD DO ESTUDO TRIBUTÁRIO COMPARATIVO EM PDF ---
router.get("/api/propostas/:token/estudo-tributario-pdf", async (req, res, next) => {
  try {
    const { token } = req.params;
    const propostas = await db.executarQuery(
      "SELECT * FROM propostas WHERE token_acesso = ? LIMIT 1",
      [token]
    );

    if (propostas.length === 0) {
      return res.status(404).json({ error: "Proposta não encontrada." });
    }

    const proposta = propostas[0];
    const pdfBuffer = await gerarPDFEstudoTributario(proposta);

    const safeName = (proposta.nome_clinica || "Clinica").replace(/[^a-zA-Z0-9_-]/g, "_");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Estudo_Tributario_${safeName}_FINORA.pdf"`
    );
    return res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
});

// --- D4SIGN WEBHOOK ---
// Campos: uuid, type_post (1=Finalizado, 2=E-mail não entregue, 3=Cancelado, 4=Assinado), message
router.post("/api/d4sign/webhook", express.urlencoded({ extended: true }), async (req, res, next) => {
  try {
    if (!(await d4signService.segredoWebhookValido(req.query.secret))) {
      console.warn(`[D4Sign Webhook] Tentativa de acesso não autorizada com secret incorreto.`);
      return res.status(401).json({ error: "Acesso não autorizado." });
    }

    // Produção recebeu o webhook da D4Sign com uuid/type_post undefined (27/10): ela manda multipart/form-data,
    // que express.json/urlencoded ignoram. O Response do Node lê multipart sem dependência.
    const tipoConteudo = req.get("content-type") || "";
    if (/^multipart\/form-data/i.test(tipoConteudo)) {
      req.body = Object.fromEntries(await new Response(Readable.toWeb(req), { headers: { "content-type": tipoConteudo } }).formData());
    }

    const { uuid, type_post, message } = req.body || {};
    console.log(`[D4Sign Webhook] Recebido evento para documento ${uuid}. type_post: ${type_post}, message: ${message}`);
    if (!uuid) console.warn(`[D4Sign Webhook] Evento sem uuid (Content-Type: ${tipoConteudo || "nenhum"}).`);

    // type_post "1" = finalizado (todos assinaram), "3" = cancelado (inclui prazo expirado),
    // "2" = e-mail não entregue ao signatário. "4" = um signatário assinou
    const eventos = { 1: "finalizado", 2: "nao_entregue", 3: "cancelado" };
    if (uuid && eventos[String(type_post)]) {
      await d4signService.processarDocumentoD4Sign(uuid, eventos[String(type_post)], message);
    } else if (uuid && String(type_post) === "4") {
      try {
        const crmPipelineService = require("../services/crmPipelineService");
        await crmPipelineService.tratarAssinaturaParcialD4Sign(uuid, { nome: message || "Signatário" });
      } catch (partialErr) {
        console.warn("[D4Sign Webhook] Erro ao registrar assinatura parcial:", partialErr.message);
      }
    }
    return res.status(200).send("Webhook recebido com sucesso.");
  } catch (error) {
    next(error);
  }
});

// --- CONSULTAR STATUS D4SIGN & SIGNATÁRIOS AO VIVO ---
router.get("/api/propostas/:id/d4sign-status", verificarToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const propostas = await db.executarQuery(
      "SELECT id, numero_proposta, status, ip_assinatura, nome_clinica, nome_socio, email, data_decisao FROM propostas WHERE id = ? LIMIT 1",
      [id]
    );

    if (propostas.length === 0) {
      return res.status(404).json({ error: "Proposta não encontrada." });
    }

    const proposta = propostas[0];
    const uuid = proposta.ip_assinatura;

    if (!uuid) {
      return res.json({
        temDocumento: false,
        statusProposta: proposta.status,
        mensagem: "Documento ainda não enviado para o D4Sign.",
        signatarios: [],
      });
    }

    const statusDetalhado = await d4signService.consultarSignatariosDocumento(uuid);

    res.json({
      temDocumento: true,
      propostaId: proposta.id,
      numeroProposta: proposta.numero_proposta,
      statusProposta: proposta.status,
      ...statusDetalhado,
    });
  } catch (error) {
    next(error);
  }
});

// Recebe a senha do Diretor: limita tentativas erradas por usuário logado
const limiteSenhaDiretor = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `desconto-${req.user.id}`,
  skip: () => process.env.NODE_ENV === "test",
  message: { error: "Muitas tentativas. Tente novamente em 15 minutos." },
});

// --- APPLY DISCOUNT ---
router.post("/api/propostas/:id/desconto", verificarToken, donoProposta, limiteSenhaDiretor, async (req, res, next) => {
  try {
    const propostaId = req.params.id;
    const { percentual, diretorEmail, diretorSenha } = req.body;
    const percentualNum = parseFloat(percentual);
    // NaN ou negativo passaria pela alçada do Comercial (percentual <= 20)
    if (!(percentualNum > 0 && percentualNum <= 100)) {
      return res.status(400).json({ error: "Percentual de desconto inválido (entre 0 e 100)." });
    }
    const justificativa = typeof req.body.justificativa === "string" ? req.body.justificativa.slice(0, 2000) : "";

    const propostaOriginal = await db.executarQuery(
      "SELECT * FROM propostas WHERE id = ?",
      [propostaId],
    );
    if (propostaOriginal.length === 0) {
      return res.status(404).json({ error: "Proposta não encontrada." });
    }

    const p = propostaOriginal[0];
    const avaliacao = await discountService.verificarAlcadaDesconto({
      role: req.user.role,
      percentual: percentualNum,
      diretorEmail,
      diretorSenha,
      db,
    });

    if (avaliacao.erro) {
      return res.status(avaliacao.statusHttp || 401).json({ error: avaliacao.erro });
    }

    if (avaliacao.autorizado) {
      const { token } = await criarPropostaFilhaComDesconto(p, percentualNum, req.user.id);
      const { emailEnviado } = await gerarMidiaESenharProposta(token);
      return res.json({
        success: true,
        emailEnviado,
        message: emailEnviado
          ? `Desconto de ${percentualNum}% aprovado e aplicado! Nova proposta enviada.`
          : `Desconto de ${percentualNum}% aprovado e aplicado. ${AVISO_EMAIL_NAO_ENVIADO}`,
      });
    } else {
      await db.execute(
        `INSERT INTO solicitacoes_desconto (proposta_id, solicitado_por, percentual_solicitado, justificativa) VALUES (?, ?, ?, ?)`,
        [p.id, req.user.id, percentualNum, justificativa],
      );
      notificationService.enviarNotificacao("nova_solicitacao", {
        vendedorNome: req.user.nome || "Vendedor",
        numeroProposta: p.numero_proposta,
        nomeClinica: p.nome_clinica,
        percentual: percentualNum,
        justificativa: justificativa,
      });
      return res.json({
        success: true,
        message: "Desconto superior a 20%. Solicitação enviada para o painel da diretoria.",
      });
    }
  } catch (error) {
    next(error);
  }
});

// --- DISCOUNT ITENS --- (With Transaction)
router.post("/api/propostas/:id/desconto-itens", verificarToken, donoProposta, async (req, res, next) => {
  // Dentro do try: falha ao pegar conexão vira erro tratado, não promise rejeitada sem resposta
  let connection;
  try {
    const propostaOriginalId = req.params.id;
    const { justificativaDesconto } = req.body;

    const validacaoItens = z.array(itemPropostaSchema).min(1).safeParse(req.body.itens);
    if (!validacaoItens.success) {
      return res.status(400).json({ error: "Itens inválidos para desconto.", detalhes: validacaoItens.error.issues });
    }
    const itens = validacaoItens.data;
    connection = await db.getConnection();

    const propostas = await db.executarQuery("SELECT * FROM propostas WHERE id = ?", [propostaOriginalId]);
    if (propostas.length === 0) {
      return res.status(404).json({ error: "Proposta original não encontrada." });
    }

    const p = propostas[0];

    // Referência: preço de tabela recalculado; itens fora do catálogo usam o valor original da proposta-mãe
    const referencias = await calcularPrecosReferencia({
      cadeiras: p.cadeiras, faturamento: p.faturamento, regimeHibrido: p.regime_hibrido,
      funcionarios: p.funcionarios, socios: p.socios, metragem: p.metragem, distanciaKm: p.distancia_km,
      regimeFiscal: p.regime_fiscal, tipoProposta: p.tipo_proposta, tipoPessoa: p.tipo_pessoa,
    });
    for (const orig of lerJson(p.itens_json)) {
      if (!referencias.has(orig.servico)) referencias.set(orig.servico, Number(orig.valorOriginal || orig.valor || 0));
    }
    const maiorDescontoReal = aplicarDescontoReal(itens, referencias);
    const precisaAprovacao =
      (temDescontoAcimaDe20(itens) || maiorDescontoReal > LIMITE_DESCONTO_COMERCIAL) && req.user.role !== "Diretor";
    // Totais sempre derivados dos itens, nunca do navegador
    const { totalMensal, totalPontual, totalGeral: totalItens } = discountService.calcularTotaisSeparados(itens);

    await connection.beginTransaction();

    const novoNumero = await proximoNumeroProposta(connection);

    const novoToken = crypto.randomBytes(20).toString("hex");
    let dataFormatada = p.data_proposta;
    if (p.data_proposta instanceof Date) {
      const d = p.data_proposta;
      dataFormatada = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }

    const [resultado] = await connection.execute(
      `INSERT INTO propostas (
        token_acesso, numero_proposta, data_proposta, nome_clinica, razao_social, cnpj,
        nome_socio, cpf_socio, email, telefone, endereco_clinica,
        cadeiras, funcionarios, socios, faturamento, regime_fiscal,
        regime_hibrido, distancia_km, metragem, valor_total,
        itens_json, status, criado_por, proposta_pai_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        novoToken,
        String(novoNumero),
        dataFormatada,
        p.nome_clinica,
        p.razao_social,
        p.cnpj,
        p.nome_socio,
        p.cpf_socio,
        p.email,
        p.telefone,
        p.endereco_clinica,
        p.cadeiras,
        p.funcionarios,
        p.socios,
        p.faturamento,
        p.regime_fiscal,
        p.regime_hibrido,
        p.distancia_km,
        p.metragem,
        totalItens,
        JSON.stringify(itens),
        precisaAprovacao ? "Aguardando Aprovação" : "Pendente",
        req.user.id,
        p.id,
      ],
    );

    const novaPropostaId = resultado.insertId;

    for (const item of itens) {
      const obs = (item.observacao || "").toLowerCase();
      const tipo =
        obs.includes("pontual") ||
        obs.includes("taxas") ||
        obs.includes("emissão") ||
        obs.includes("renovação") ||
        obs.includes("implanta")
          ? "Pontual"
          : "Mensal";

      await connection.execute(
        `INSERT INTO proposta_itens (proposta_id, servico, observacao, tipo, valor) VALUES (?, ?, ?, ?, ?)`,
        [novaPropostaId, item.servico, item.observacao || "", tipo, Number(item.valor || 0)],
      );
    }

    if (precisaAprovacao) {
      await connection.execute(
        `INSERT INTO solicitacoes_desconto_item (proposta_id, solicitado_por, descontos_json, justificativa) VALUES (?, ?, ?, ?)`,
        [novaPropostaId, req.user.id, JSON.stringify(itens), justificativaDesconto || ""],
      );

      await connection.commit();

      const diretores = await db.executarQuery(`SELECT email FROM usuarios WHERE ativo = 1 AND role = 'Diretor'`);
      const diretoresEmails = diretores.map((usuario) => usuario.email);

      const topicosPdf = await buscarTopicosPdfPorItens(itens);
      const dadosNovaProposta = {
        numeroProposta: String(novoNumero),
        dataProposta: dataFormatada,
        nomeClinica: p.nome_clinica,
        razaoSocial: p.razao_social,
        cnpj: p.cnpj,
        nomeSocio: p.nome_socio,
        cpfSocio: p.cpf_socio,
        email: p.email,
        telefone: p.telefone,
        enderecoClinica: p.endereco_clinica,
        cadeiras: p.cadeiras,
        funcionarios: p.funcionarios,
        socios: p.socios,
        faturamento: p.faturamento,
        regimeFiscal: p.regime_fiscal,
        regimeHibrido: p.regime_hibrido,
        distanciaKm: p.distancia_km,
        metragem: p.metragem,
        totalMensal: Number(totalMensal || 0),
        totalPontual: Number(totalPontual || 0),
        total: totalItens,
        itens,
        topicosPdf,
        justificativaDesconto: justificativaDesconto || "",
      };

      await emailService.notificarAdminsSolicitacaoDesconto(diretoresEmails, dadosNovaProposta)
        .catch((e) => console.error("[Desconto por item] Erro ao avisar diretoria:", e.message));

      let totalOriginal = 0;
      let totalDesconto = 0;
      itens.forEach((item) => {
        totalOriginal += Number(item.valorOriginal || 0);
        totalDesconto += Number(item.valorDesconto || 0);
      });
      const percentualMedio = totalOriginal > 0 ? ((totalDesconto / totalOriginal) * 100).toFixed(2) : 0;

      notificationService.enviarNotificacao("nova_solicitacao", {
        vendedorNome: req.user.nome || "Vendedor",
        numeroProposta: String(novoNumero),
        nomeClinica: p.nome_clinica,
        percentual: percentualMedio,
        justificativa: justificativaDesconto || "",
        tipo: "item",
      });

      return res.status(202).json({
        success: true,
        aguardandoAprovacao: true,
        message: "Nova proposta com desconto salva e enviada para aprovação da diretoria. Ela ainda não foi enviada ao cliente.",
      });
    }

    await connection.commit();

    const topicosPdf = await buscarTopicosPdfPorItens(itens);
    const dadosNovaProposta = {
      numeroProposta: String(novoNumero),
      dataProposta: dataFormatada,
      nomeClinica: p.nome_clinica,
      razaoSocial: p.razao_social,
      cnpj: p.cnpj,
      nomeSocio: p.nome_socio,
      cpfSocio: p.cpf_socio,
      email: p.email,
      telefone: p.telefone,
      enderecoClinica: p.endereco_clinica,
      cadeiras: p.cadeiras,
      funcionarios: p.funcionarios,
      socios: p.socios,
      faturamento: p.faturamento,
      regimeFiscal: p.regime_fiscal,
      regimeHibrido: p.regime_hibrido,
      distanciaKm: p.distancia_km,
      metragem: p.metragem,
      totalMensal: Number(totalMensal || 0),
      totalPontual: Number(totalPontual || 0),
      total: totalItens,
      itens,
      topicosPdf,
      justificativaDesconto: justificativaDesconto || "",
    };

    const linkAcesso = linkCurto(novoToken);

    // Já gravada: falha de PDF/e-mail vira aviso, não 500 (o retry criaria outra proposta-filha)
    let emailEnviado = false;
    try {
      const pdfBuffer = await gerarPDFProposta({ ...dadosNovaProposta, tokenAcesso: novoToken });
      fs.writeFileSync(path.join(pdfFolder, `${novoToken}.pdf`), pdfBuffer);

      // Apenas enviar e-mail tradicional com link de acesso para visualização.
      // O documento D4Sign será gerado dinamicamente quando o cliente clicar em "De Acordo"
      emailEnviado = Boolean(await emailService.enviarEmailLink(dadosNovaProposta, linkAcesso));
    } catch (e) {
      console.error("[Desconto por item] Erro ao gerar PDF/enviar e-mail:", e.message);
    }

    return res.json({
      success: true,
      message: emailEnviado
        ? "Nova proposta com desconto gerada e enviada ao cliente."
        : `Nova proposta com desconto gerada. ${AVISO_EMAIL_NAO_ENVIADO}`,
      emailEnviado,
      link: linkAcesso,
    });
  } catch (error) {
    await connection?.rollback().catch(() => {});
    next(error);
  } finally {
    connection?.release();
  }
});

// --- GET OBSERVATIONS ---
router.get("/api/propostas/:id/observacoes", verificarToken, donoProposta, async (req, res, next) => {
  try {
    const observacoes = await db.executarQuery(
      `SELECT po.id, po.observacao, po.criado_em, u.nome AS usuario
       FROM proposta_observacoes po
       LEFT JOIN usuarios u ON po.usuario_id = u.id
       WHERE po.proposta_id = ?
       ORDER BY po.criado_em DESC`,
      [req.params.id],
    );
    res.json(observacoes);
  } catch (error) {
    next(error);
  }
});

// --- POST OBSERVATIONS ---
router.post("/api/propostas/:id/observacoes", verificarToken, donoProposta, async (req, res, next) => {
  try {
    const { observacao } = req.body;
    if (!observacao || observacao.trim().length < 5) {
      return res.status(400).json({ error: "Digite uma observação com pelo menos 5 caracteres." });
    }
    await db.execute(
      `INSERT INTO proposta_observacoes (proposta_id, usuario_id, observacao) VALUES (?, ?, ?)`,
      [req.params.id, req.user.id, observacao.trim()],
    );

    auditService.registrarLogProposta({
      proposta_id: req.params.id,
      usuario_id: req.user.id,
      usuario_nome: req.user.nome || "Usuário",
      usuario_role: req.user.role || "Comercial",
      acao: "OBSERVACAO",
      titulo: "Observação Interna Registrada",
      detalhes: observacao.trim(),
      ip: req.ip
    }).catch(e => console.warn("Erro ao registrar observação no audit log:", e.message));

    res.json({ success: true, message: "Observação registrada com sucesso." });
  } catch (error) {
    next(error);
  }
});

// --- LOGS & AUDITORIA DA PROPOSTA ---
router.get("/api/propostas/:id/logs", verificarToken, donoProposta, async (req, res, next) => {
  try {
    const logs = await auditService.obterLogsProposta(req.params.id);
    return res.json(logs);
  } catch (error) {
    next(error);
  }
});

// --- LOGS GLOBAIS DE TODAS AS PROPOSTAS (DIRETORIA) ---
router.get("/api/admin/propostas/logs", verificarToken, async (req, res, next) => {
  try {
    if (req.user.role !== "Diretor") {
      return res.status(403).json({ error: "Acesso restrito à diretoria." });
    }
    const resultado = await auditService.obterLogsGlobais(req.query);
    return res.json(resultado);
  } catch (error) {
    next(error);
  }
});

// --- SHORT LINK REDIRECT (/p/:tokenOuId) ---
// Link curto: "/proposta/p/<token>" (o proxy de produção só encaminha /proposta e /api); "/p/" mantido por compatibilidade
router.get(["/p/:token", `${APP_BASE_PATH}/p/:token`], async (req, res, next) => {
  try {
    const { token } = req.params;
    // Só o token aleatório abre a proposta: id/número são sequenciais e permitiriam ver propostas de outros clientes
    const propostas = await db.executarQuery(
      `SELECT token_acesso FROM propostas WHERE token_acesso = ? LIMIT 1`,
      [token]
    );

    if (propostas.length === 0) {
      return res.redirect(`${APP_BASE_PATH}/visualizar.html?token=invalido`);
    }

    const tokenReal = propostas[0].token_acesso;
    return res.redirect(`${APP_BASE_PATH}/visualizar.html?token=${encodeURIComponent(tokenReal)}`);
  } catch (error) {
    next(error);
  }
});

module.exports = router;



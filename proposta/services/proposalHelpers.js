const db = require("../config/db");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { gerarPDFProposta } = require("./pdfService");
const { enviarEmailLink } = require("./emailService");

const APP_BASE_PATH = process.env.APP_BASE_PATH || "/proposta";
const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3005}`;
const pdfFolder = path.join(__dirname, "../storage/propostas_pdf");

// mysql2 + MariaDB devolvem colunas JSON já como objeto; registros antigos/strings ainda chegam como texto.
function lerJson(valor, padrao = []) {
  if (valor == null || valor === "") return padrao;
  return typeof valor === "string" ? JSON.parse(valor) : valor;
}

function extrairBaseUrl(req) {
  if (req) {
    if (typeof req === "string" && /^https?:\/\//i.test(req)) {
      return req.replace(/\/$/, "");
    }

    const origin = req.headers?.origin || (typeof req.get === "function" ? req.get("origin") : null);
    if (origin && typeof origin === "string" && /^https?:\/\//i.test(origin)) {
      return origin.replace(/\/$/, "");
    }

    const referer = req.headers?.referer || (typeof req.get === "function" ? req.get("referer") : null);
    if (referer && typeof referer === "string") {
      try {
        const u = new URL(referer);
        return `${u.protocol}//${u.host}`;
      } catch {}
    }

    const forwardedHost = req.headers?.["x-forwarded-host"] || (typeof req.get === "function" ? req.get("x-forwarded-host") : null);
    const host = forwardedHost || req.headers?.host || (typeof req.get === "function" ? req.get("host") : null);
    if (host && typeof host === "string" && !host.includes("127.0.0.1:3005") && !host.includes("localhost:3005")) {
      const proto = req.headers?.["x-forwarded-proto"] || (typeof req.get === "function" ? req.get("x-forwarded-proto") : null) || (req.secure ? "https" : "http");
      return `${proto}://${host}`.replace(/\/$/, "");
    }
  }

  return (process.env.BASE_URL || `http://localhost:${process.env.PORT || 3005}`).replace(/\/$/, "");
}

// Link curto público da proposta: o proxy de produção só encaminha /proposta e /api
function linkCurto(token, req) {
  const base = extrairBaseUrl(req);
  return `${base}${APP_BASE_PATH}/p/${token}`;
}

function temDescontoAcimaDe20(itens) {
  return itens.some((item) => Number(item.descontoPercentual || 0) > 20);
}

async function buscarTopicosPdfPorItens(itens) {
  try {
    const nomesServicos = itens
      .filter((item) => !item.topicosPersonalizados)
      .map((item) => item.servico)
      .filter(Boolean);

    if (nomesServicos.length === 0) return [];

    const placeholders = nomesServicos.map(() => "?").join(",");

    const topicos = await db.executarQuery(
      `
      SELECT DISTINCT
        t.id,
        t.titulo,
        t.texto,
        t.ordem
      FROM servicos_proposta s
      JOIN servico_topico_pdf st ON st.servico_id = s.id
      JOIN topicos_pdf t ON t.id = st.topico_id
      WHERE s.ativo = 1
        AND t.ativo = 1
        AND st.mostrar = 1
        AND s.nome IN (${placeholders})
      ORDER BY t.ordem ASC
      `,
      nomesServicos,
    );

    return topicos;
  } catch (error) {
    console.warn(
      "Não foi possível buscar tópicos padrão do PDF:",
      error.message,
    );
    return [];
  }
}

// Validade comercial (PDF, e-mail e página dizem 10 dias). Começa em validade_inicia_em (reativação do cliente
// ou renovação do consultor) ou, se nunca renovada, em criado_em.
const DIAS_VALIDADE = 10;
function propostaVencida(p, agora = new Date()) {
  const base = p.validade_inicia_em || p.criado_em;
  if (!base) return false; // sem data não dá para afirmar que venceu
  const inicio = new Date(base);
  if (Number.isNaN(inicio.getTime())) return false;
  return agora.getTime() > inicio.getTime() + DIAS_VALIDADE * 24 * 60 * 60 * 1000;
}

// ip_assinatura guarda o IP do aceite ou o UUID do documento D4Sign. Só UUID real conta como contrato gerado:
// IPv6 (sem ponto) e o UUID de mock ("mocked_...") passavam pela checagem antiga e o contrato nunca era gerado.
function ehUuidD4Sign(valor) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(valor || "").trim());
}

// Número sequencial único para criação manual, renegociação e webhook (UNIQUE uk_numero_proposta).
// FOR UPDATE segura a leitura até o commit: duas criações simultâneas não pegam o mesmo número.
// ponytail: serializa todas as criações enquanto a transação durar; contador próprio se o volume crescer.
async function proximoNumeroProposta(conexao) {
  const [rows] = await conexao.execute(
    "SELECT MAX(CAST(numero_proposta AS UNSIGNED)) AS max_numero FROM propostas FOR UPDATE"
  );
  return String(Math.max(Number(rows[0]?.max_numero || 0) + 1, 2026024));
}

async function criarPropostaFilhaComDesconto(p, percentualNum, userId, connection) {
  const dbExecutor = connection || db;
  const valorDesconto = (
    parseFloat(p.valor_total) *
    (percentualNum / 100)
  ).toFixed(2);

  const novoNumero = await proximoNumeroProposta(dbExecutor);

  const novoToken = crypto.randomBytes(20).toString("hex");

  try {
    await dbExecutor.execute(
      `
    INSERT INTO propostas (
      token_acesso,
      numero_proposta,
      data_proposta,
      nome_clinica,
      razao_social,
      cnpj,
      nome_socio,
      cpf_socio,
      email,
      telefone,
      endereco_clinica,
      cadeiras,
      funcionarios,
      socios,
      faturamento,
      regime_fiscal,
      regime_hibrido,
      distancia_km,
      metragem,
      valor_total,
      itens_json,
      status,
      criado_por,
      proposta_pai_id,
      percentual_desconto,
      valor_desconto
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pendente', ?, ?, ?, ?)
    `,
      [
        novoToken,
        novoNumero.toString(),
        p.data_proposta,
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
        p.valor_total,
        p.itens_json,
        userId,
        p.id,
        percentualNum,
        valorDesconto,
      ],
    );
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      throw new Error(
        "Número de proposta duplicado. Gere novamente a proposta.",
      );
    }
    throw error;
  }

  return { token: novoToken, numeroProposta: novoNumero.toString() };
}

async function gerarMidiaESenharProposta(token) {
  const propostas = await db.executarQuery(
    "SELECT * FROM propostas WHERE token_acesso = ? LIMIT 1",
    [token]
  );
  if (propostas.length === 0) {
    throw new Error(`Proposta com token ${token} não encontrada para geração de mídia.`);
  }

  const p = propostas[0];

  let dataFormatadaStr = p.data_proposta;
  if (p.data_proposta instanceof Date) {
    const d = p.data_proposta;
    dataFormatadaStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  const dadosNovaProposta = {
    numeroProposta: p.numero_proposta,
    dataProposta: dataFormatadaStr,
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
    total: parseFloat(p.valor_total),
    itens: lerJson(p.itens_json),
    percentualDesconto: p.percentual_desconto,
    valorDesconto: p.valor_desconto,
  };

  const pdfBuffer = await gerarPDFProposta({ ...dadosNovaProposta, tokenAcesso: token });
  const pdfPath = path.join(pdfFolder, `${token}.pdf`);
  fs.writeFileSync(pdfPath, pdfBuffer);

  const linkAcesso = linkCurto(token);

  // Apenas enviar e-mail tradicional com link de acesso para visualização.
  // O contrato D4Sign será gerado na aprovação do cliente.
  // enviarEmailLink devolve null quando o envio falha
  const emailEnviado = Boolean(await enviarEmailLink(dadosNovaProposta, linkAcesso));

  return { linkAcesso, token, emailEnviado };
}

module.exports = {
  temDescontoAcimaDe20,
  buscarTopicosPdfPorItens,
  criarPropostaFilhaComDesconto,
  gerarMidiaESenharProposta,
  lerJson,
  linkCurto,
  extrairBaseUrl,
  proximoNumeroProposta,
  ehUuidD4Sign,
  DIAS_VALIDADE,
  propostaVencida
};

// Auto-checagem: node services/proposalHelpers.js
if (require.main === module) {
  const assert = require("assert");
  const agora = new Date("2026-10-20T12:00:00Z");
  assert.strictEqual(propostaVencida({ criado_em: "2026-10-09T12:00:00Z" }, agora), true);
  assert.strictEqual(propostaVencida({ criado_em: "2026-10-11T12:00:00Z" }, agora), false);
  // Renovada: conta da renovação, não da criação
  assert.strictEqual(propostaVencida({ criado_em: "2026-09-01T00:00:00Z", validade_inicia_em: "2026-10-15T00:00:00Z" }, agora), false);
  assert.strictEqual(propostaVencida({ criado_em: null }, agora), false);
  console.log("proposalHelpers ok");
  process.exit(0);
}

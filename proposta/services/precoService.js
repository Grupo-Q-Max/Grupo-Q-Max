const db = require("../config/db");
const cacheService = require("./cacheService");

// Alçada máxima de desconto do Comercial sem aprovação da diretoria (%)
const LIMITE_DESCONTO_COMERCIAL = 20;

/**
 * Catálogo de preços + regras de cálculo vinculadas (mesmo formato de GET /api/regras-precificacao).
 */
async function carregarRegrasPrecificacao() {
  return cacheService.getOrSet("regras_precificacao", async () => {
    const regras = await db.executarQuery(`SELECT
        rp.id, rp.codigo, rp.nome, rp.tipo, rp.valor_base, rp.valor_base_pf, rp.valor_base_pj,
        rp.valor_base_hibrido, rp.ativo, rp.descricao, rp.empresa, rp.categoria, rp.modo_calculo,
        rp.campo_quantidade, rp.multiplica_cadeiras, rp.multiplica_faturamento, rp.multiplica_hibrido
      FROM regras_precificacao rp
      WHERE rp.ativo = 1
      ORDER BY rp.nome ASC
      `);

    const vinculos = await db.executarQuery(`
        SELECT src.regra_precificacao_id, rc.codigo AS regra_codigo, rc.nome AS regra_nome,
          rc.descricao AS regra_descricao, rc.campo_base, rc.operador, rc.valor_comparacao, rc.fator
        FROM servico_regra_calculo src
        JOIN regras_calculo rc ON rc.id = src.regra_calculo_id
        WHERE src.ativo = 1 AND rc.ativo = 1
      `);

    return regras.map((regra) => ({
      ...regra,
      regras_calculo: vinculos
        .filter((v) => Number(v.regra_precificacao_id) === Number(regra.id))
        .map((v) => ({
          codigo: v.regra_codigo,
          nome: v.regra_nome,
          descricao: v.regra_descricao,
          campo_base: v.campo_base,
          operador: v.operador,
          valor_comparacao: Number(v.valor_comparacao || 0),
          fator: Number(v.fator || 1),
        })),
    }));
  }, 600);
}

// ---- Espelho do motor de preço de public/script.js (obterItensCalculados). Mudou lá? Mude aqui. ----
function fatorCadeiras(cadeiras) {
  if (cadeiras <= 2) return 1;
  return 1 + Math.ceil((cadeiras - 2) / 2) * 0.6;
}

function fatorFaturamento(faturamento) {
  if (faturamento <= 2000000) return 1;
  return 1 + Math.ceil((faturamento - 2000000) / 1000000) * 0.1;
}

function valorCampoRegra(campo, ctx) {
  if (campo === "regimeHibrido") return ctx.regimeHibrido === "Sim" ? 1 : 0;
  return Number(ctx[campo] || 0);
}

function regraPassou(regra, ctx) {
  const v = valorCampoRegra(regra.campo_base, ctx);
  const c = Number(regra.valor_comparacao || 0);
  if (regra.operador === ">") return v > c;
  if (regra.operador === ">=") return v >= c;
  if (regra.operador === "<") return v < c;
  if (regra.operador === "<=") return v <= c;
  if (regra.operador === "=") return v === c;
  return false;
}

function multiplicador(servico, ctx) {
  let m = 1;
  for (const regra of servico.regras_calculo || []) {
    if (regra.codigo === "cadeiras") m *= fatorCadeiras(ctx.cadeiras);
    else if (regra.codigo === "faturamento") m *= fatorFaturamento(ctx.faturamento);
    else if (regra.codigo === "hibrido") m *= ctx.regimeHibrido === "Sim" ? 1.3 : 1;
    else if (regraPassou(regra, ctx)) m *= Number(regra.fator || 1);
  }
  return m;
}

// Valor por tipo de pessoa (BASE[codigo] do front): só vale quando valor_base está zerado
function valorPorPessoa(regra, tipoPessoa) {
  const campo = { PF: "valor_base_pf", PJ: "valor_base_pj", HIBRIDA: "valor_base_hibrido" }[tipoPessoa];
  const v = campo ? regra[campo] : null;
  return v !== null && v !== undefined && v !== "" ? Number(v) : Number(regra.valor_base || 0);
}

function valorConfigurado(regras, codigo, ctx) {
  const regra = regras.find((r) => r.codigo === codigo);
  if (!regra) return null;
  const base = Number(regra.valor_base || valorPorPessoa(regra, ctx.tipoPessoa) || 0);
  if (regra.modo_calculo === "por_quantidade") return base * valorCampoRegra(regra.campo_quantidade, ctx);
  return base;
}

const EMPRESA_POR_TIPO = { tech: "TECH", contabil: "CONTABIL", auditoria: "AUDITORIA", lagerhaus: "LAGERHAUS" };

/**
 * Preço de tabela (sem desconto) que o sistema calcula para cada serviço da proposta.
 * Itens de valor livre (Proposta Personalizada, Auditoria avulsa) não entram no mapa.
 * @returns {Map<string, number>} nome do serviço -> valor de referência
 */
async function calcularPrecosReferencia(dados) {
  const regras = await carregarRegrasPrecificacao();
  const ctx = {
    cadeiras: Number(dados.cadeiras || 0),
    faturamento: Number(dados.faturamento || 0),
    regimeHibrido: dados.regimeHibrido,
    funcionarios: Number(dados.funcionarios || 0),
    socios: Number(dados.socios || 0),
    metragem: Number(dados.metragem || 0),
    distanciaKm: Number(dados.distanciaKm || 0),
    tipoPessoa: String(dados.tipoPessoa || "PJ").toUpperCase(),
  };
  const ref = new Map();
  const tipo = String(dados.tipoProposta || "finora").toLowerCase();

  if (tipo === "tech") {
    const planos = await db.executarQuery("SELECT nome, valor_implantacao, valor_mensalidade FROM tech_planos WHERE ativo = 1");
    for (const p of planos) {
      ref.set(p.nome, Number(p.valor_implantacao || 0));
      ref.set(`Mensalidade ${p.nome}`, Number(p.valor_mensalidade || 0));
    }
    return ref;
  }

  if (dados.regimeFiscal !== "Lucro Real") {
    const empresa = EMPRESA_POR_TIPO[tipo] || "FINORA";
    for (const s of regras) {
      if ((s.empresa || "FINORA").toUpperCase() !== empresa || s.categoria === "Base Auxiliar") continue;
      if (s.codigo.startsWith("plano_") || s.codigo.startsWith("mensalidade_")) continue;
      ref.set(s.nome, valorConfigurado(regras, s.codigo, ctx) * multiplicador(s, ctx));
    }
  }

  const f = ctx.funcionarios;
  if (f > 0) {
    const dp = valorConfigurado(regras, f <= 20 ? "dpAte20" : f <= 40 ? "dp21a40" : "dpAcima40", ctx);
    if (dp) ref.set("Departamento Pessoal", dp);
  }
  const proLabore = valorConfigurado(regras, "proLabore", ctx);
  if (proLabore) ref.set("Pró-labore", proLabore);
  const cro = valorConfigurado(regras, "cro", ctx);
  if (cro !== null) ref.set("Inscrição CRO", cro);

  const regBase = valorConfigurado(regras, "regulatorio", ctx);
  if (regBase !== null) {
    const m = ctx.metragem;
    let regulatorio = regBase * (m <= 50 ? 1 : 1 + Math.ceil((m - 50) / 50) * 0.5);
    if (ctx.distanciaKm > 50) regulatorio *= 1.15;
    for (const nome of ["Alvará Func.", "AVCB", "Vigilância San."]) ref.set(nome, regulatorio);
  }

  const cert = valorConfigurado(regras, "certificado", ctx);
  if (cert !== null) {
    ref.set("Certificado Digital", cert);
    ref.set("Renovação Certificado", cert);
  }
  return ref;
}

/**
 * Desconto real de cada item contra o preço de tabela. Não confia em valorOriginal/descontoPercentual do cliente.
 * Corrige item.descontoPercentual para o desconto real e devolve o maior desconto encontrado (%).
 */
function aplicarDescontoReal(itens, referencias) {
  let maior = 0;
  for (const item of itens) {
    const ref = referencias.get(item.servico);
    if (!ref || ref <= 0) continue;
    const real = Math.max(0, (1 - Number(item.valor || 0) / ref) * 100);
    const arredondado = Math.round(real * 100) / 100;
    if (arredondado > Number(item.descontoPercentual || 0)) item.descontoPercentual = arredondado;
    maior = Math.max(maior, arredondado);
  }
  return maior;
}

module.exports = {
  LIMITE_DESCONTO_COMERCIAL,
  carregarRegrasPrecificacao,
  calcularPrecosReferencia,
  aplicarDescontoReal,
};

// Auto-checagem: node services/precoService.js
if (require.main === module) {
  const assert = require("assert");
  assert.strictEqual(fatorCadeiras(2), 1);
  assert.strictEqual(fatorCadeiras(3), 1.6);
  assert.strictEqual(fatorFaturamento(3500000), 1.2);
  const itens = [
    { servico: "BPO Financeiro", valor: 1760, descontoPercentual: 0 },
    { servico: "Proposta Personalizada", valor: 1 },
  ];
  const maior = aplicarDescontoReal(itens, new Map([["BPO Financeiro", 2200]]));
  assert.strictEqual(maior, 20);
  assert.strictEqual(itens[0].descontoPercentual, 20);
  const itens2 = [{ servico: "BPO Financeiro", valor: 1000, descontoPercentual: 0 }];
  assert.ok(aplicarDescontoReal(itens2, new Map([["BPO Financeiro", 2200]])) > LIMITE_DESCONTO_COMERCIAL);
  // valor_base zerado: cai no valor PF/PJ, como o front
  const regraPj = { codigo: "x", valor_base: 0, valor_base_pf: 300, valor_base_pj: 500 };
  assert.strictEqual(valorConfigurado([regraPj], "x", { tipoPessoa: "PJ" }), 500);
  assert.strictEqual(valorConfigurado([regraPj], "x", { tipoPessoa: "PF" }), 300);
  assert.strictEqual(valorConfigurado([{ ...regraPj, valor_base: 200 }], "x", { tipoPessoa: "PF" }), 200);
  console.log("precoService ok");
  process.exit(0);
}

const db = require("../config/db");
const cacheService = require("./cacheService");

// Alçada máxima de desconto do Comercial sem aprovação da diretoria (%)
const LIMITE_DESCONTO_COMERCIAL = 20;

const CATALOGO_PADRAO_FALLBACK = [
  { id: 1, codigo: 'contabil', nome: 'Assessoria Contábil/Fiscal PJ', tipo: 'Mensal', valor_base: 1800, valor_base_pf: null, valor_base_pj: 1800, valor_base_hibrido: 2200, ativo: 1, categoria: 'Servico', empresa: 'FINORA', modo_calculo: 'fixo', multiplica_cadeiras: 1, multiplica_faturamento: 1, multiplica_hibrido: 1, regras_calculo: [{ codigo: 'cadeiras', nome: 'Cadeiras', campo_base: 'cadeiras', operador: 'formula', valor_comparacao: 0, fator: 1 }, { codigo: 'faturamento', nome: 'Faturamento', campo_base: 'faturamento', operador: 'formula', valor_comparacao: 0, fator: 1 }, { codigo: 'hibrido', nome: 'Regime Híbrido', campo_base: 'regimeHibrido', operador: '=', valor_comparacao: 1, fator: 1.3 }] },
  { id: 2, codigo: 'fiscal', nome: 'Assessoria Contábil/Fiscal PF', tipo: 'Mensal', valor_base: 1800, valor_base_pf: 1800, valor_base_pj: null, valor_base_hibrido: 2200, ativo: 1, categoria: 'Servico', empresa: 'FINORA', modo_calculo: 'fixo', multiplica_cadeiras: 1, multiplica_faturamento: 1, multiplica_hibrido: 1, regras_calculo: [{ codigo: 'cadeiras', nome: 'Cadeiras', campo_base: 'cadeiras', operador: 'formula', valor_comparacao: 0, fator: 1 }, { codigo: 'faturamento', nome: 'Faturamento', campo_base: 'faturamento', operador: 'formula', valor_comparacao: 0, fator: 1 }, { codigo: 'hibrido', nome: 'Regime Híbrido', campo_base: 'regimeHibrido', operador: '=', valor_comparacao: 1, fator: 1.3 }] },
  { id: 3, codigo: 'bpo', nome: 'BPO Financeiro', tipo: 'Mensal', valor_base: 2200, valor_base_pf: 2000, valor_base_pj: 2200, valor_base_hibrido: 2500, ativo: 1, categoria: 'Servico', empresa: 'FINORA', modo_calculo: 'fixo', multiplica_cadeiras: 1, multiplica_faturamento: 1, multiplica_hibrido: 1, regras_calculo: [{ codigo: 'cadeiras', nome: 'Cadeiras', campo_base: 'cadeiras', operador: 'formula', valor_comparacao: 0, fator: 1 }, { codigo: 'faturamento', nome: 'Faturamento', campo_base: 'faturamento', operador: 'formula', valor_comparacao: 0, fator: 1 }, { codigo: 'hibrido', nome: 'Regime Híbrido', campo_base: 'regimeHibrido', operador: '=', valor_comparacao: 1, fator: 1.3 }] },
  { id: 4, codigo: 'diagnostico', nome: 'Diagnóstico Tributário', tipo: 'Pontual', valor_base: 2500, valor_base_pf: 2000, valor_base_pj: 2500, valor_base_hibrido: 2800, ativo: 1, categoria: 'Servico', empresa: 'FINORA', modo_calculo: 'fixo', multiplica_cadeiras: 0, multiplica_faturamento: 0, multiplica_hibrido: 0, regras_calculo: [] },
  { id: 5, codigo: 'dpAte20', nome: 'Departamento Pessoal até 20 funcionários', tipo: 'Mensal', valor_base: 70, ativo: 1, categoria: 'Base Auxiliar', empresa: 'FINORA', modo_calculo: 'por_quantidade', campo_quantidade: 'funcionarios', multiplica_cadeiras: 0, multiplica_faturamento: 0, multiplica_hibrido: 0, regras_calculo: [] },
  { id: 6, codigo: 'dp21a40', nome: 'Departamento Pessoal de 21 a 40 funcionários', tipo: 'Mensal', valor_base: 65, ativo: 1, categoria: 'Base Auxiliar', empresa: 'FINORA', modo_calculo: 'por_quantidade', campo_quantidade: 'funcionarios', multiplica_cadeiras: 0, multiplica_faturamento: 0, multiplica_hibrido: 0, regras_calculo: [] },
  { id: 7, codigo: 'dpAcima40', nome: 'Departamento Pessoal acima de 40 funcionários', tipo: 'Mensal', valor_base: 60, ativo: 1, categoria: 'Base Auxiliar', empresa: 'FINORA', modo_calculo: 'por_quantidade', campo_quantidade: 'funcionarios', multiplica_cadeiras: 0, multiplica_faturamento: 0, multiplica_hibrido: 0, regras_calculo: [] },
  { id: 8, codigo: 'proLabore', nome: 'Pró-labore', tipo: 'Mensal', valor_base: 70, ativo: 1, categoria: 'Base Auxiliar', empresa: 'FINORA', modo_calculo: 'por_quantidade', campo_quantidade: 'socios', multiplica_cadeiras: 0, multiplica_faturamento: 0, multiplica_hibrido: 0, regras_calculo: [] },
  { id: 9, codigo: 'cro', nome: 'Inscrição CRO', tipo: 'Pontual', valor_base: 400, ativo: 1, categoria: 'Base Auxiliar', empresa: 'FINORA', modo_calculo: 'fixo', multiplica_cadeiras: 0, multiplica_faturamento: 0, multiplica_hibrido: 0, regras_calculo: [] },
  { id: 10, codigo: 'regulatorio', nome: 'Serviços Regulatórios', tipo: 'Pontual', valor_base: 1500, ativo: 1, categoria: 'Base Auxiliar', empresa: 'FINORA', modo_calculo: 'fixo', multiplica_cadeiras: 0, multiplica_faturamento: 0, multiplica_hibrido: 0, regras_calculo: [] },
  { id: 11, codigo: 'certificado', nome: 'Certificado Digital', tipo: 'Mensal', valor_base: 220, ativo: 1, categoria: 'Base Auxiliar', empresa: 'FINORA', modo_calculo: 'fixo', multiplica_cadeiras: 0, multiplica_faturamento: 0, multiplica_hibrido: 0, regras_calculo: [] },
  { id: 13, codigo: 'AVS', nome: 'Alvará Vigilância Sanitária', tipo: 'Pontual', valor_base: 1500, ativo: 1, categoria: 'Servico', empresa: 'FINORA', modo_calculo: 'fixo', multiplica_cadeiras: 1, multiplica_faturamento: 1, multiplica_hibrido: 1, regras_calculo: [] },
  { id: 40, codigo: 'declaracao_irpf', nome: 'Declaração IRPF', tipo: 'Mensal', valor_base: 250, ativo: 1, categoria: 'Servico', empresa: 'FINORA', modo_calculo: 'fixo', multiplica_cadeiras: 1, multiplica_faturamento: 1, multiplica_hibrido: 1, regras_calculo: [] },
  { id: 41, codigo: 'diagnostico_obrigacoes', nome: 'Diagnóstico Obrigações Tributárias', tipo: 'Pontual', valor_base: 1500, ativo: 1, categoria: 'Servico', empresa: 'FINORA', modo_calculo: 'fixo', multiplica_cadeiras: 1, multiplica_faturamento: 1, multiplica_hibrido: 1, regras_calculo: [] },
  { id: 42, codigo: 'regularizacao_cro', nome: 'Regularização CRO', tipo: 'Pontual', valor_base: 800, ativo: 1, categoria: 'Servico', empresa: 'FINORA', modo_calculo: 'fixo', multiplica_cadeiras: 1, multiplica_faturamento: 1, multiplica_hibrido: 1, regras_calculo: [] },
  { id: 43, codigo: 'regularizacao_prefeitura', nome: 'Regularização Prefeitura', tipo: 'Pontual', valor_base: 1000, ativo: 1, categoria: 'Servico', empresa: 'FINORA', modo_calculo: 'fixo', multiplica_cadeiras: 1, multiplica_faturamento: 1, multiplica_hibrido: 1, regras_calculo: [] },
  { id: 44, codigo: 'diagnostico_tributario_financeiro', nome: 'Diagnóstico Tributário/Financeiro', tipo: 'Pontual', valor_base: 2500, ativo: 1, categoria: 'Servico', empresa: 'FINORA', modo_calculo: 'fixo', multiplica_cadeiras: 1, multiplica_faturamento: 1, multiplica_hibrido: 1, regras_calculo: [] },
  { id: 45, codigo: 'alvara', nome: 'Alvará', tipo: 'Pontual', valor_base: 1200, ativo: 1, categoria: 'Servico', empresa: 'FINORA', modo_calculo: 'fixo', multiplica_cadeiras: 1, multiplica_faturamento: 1, multiplica_hibrido: 1, regras_calculo: [] },
  { id: 23, codigo: 'contabil_contabil', nome: 'Assessoria Contábil/Fiscal PJ', tipo: 'Mensal', valor_base: 1800, ativo: 1, categoria: 'Servico', empresa: 'CONTABIL', modo_calculo: 'fixo', multiplica_cadeiras: 1, multiplica_faturamento: 1, multiplica_hibrido: 1, regras_calculo: [] },
  { id: 24, codigo: 'fiscal_contabil', nome: 'Assessoria Contábil/Fiscal PF', tipo: 'Mensal', valor_base: 1800, ativo: 1, categoria: 'Servico', empresa: 'CONTABIL', modo_calculo: 'fixo', multiplica_cadeiras: 1, multiplica_faturamento: 1, multiplica_hibrido: 1, regras_calculo: [] },
  { id: 25, codigo: 'bpo_contabil', nome: 'BPO Financeiro', tipo: 'Mensal', valor_base: 2200, ativo: 1, categoria: 'Servico', empresa: 'CONTABIL', modo_calculo: 'fixo', multiplica_cadeiras: 1, multiplica_faturamento: 1, multiplica_hibrido: 1, regras_calculo: [] },
  { id: 26, codigo: 'diagnostico_contabil', nome: 'Diagnóstico Tributário', tipo: 'Pontual', valor_base: 2500, ativo: 1, categoria: 'Servico', empresa: 'CONTABIL', modo_calculo: 'fixo', multiplica_cadeiras: 1, multiplica_faturamento: 1, multiplica_hibrido: 1, regras_calculo: [] },
  { id: 35, codigo: 'AVS_contabil', nome: 'Alvará Vigilância Sanitária', tipo: 'Pontual', valor_base: 1500, ativo: 1, categoria: 'Servico', empresa: 'CONTABIL', modo_calculo: 'fixo', multiplica_cadeiras: 1, multiplica_faturamento: 1, multiplica_hibrido: 1, regras_calculo: [] },
  { id: 46, codigo: 'auditoria_clinica', nome: 'Auditoria de Processos Clínicos e Conformidade', tipo: 'Pontual', valor_base: 3500, ativo: 1, categoria: 'Servico', empresa: 'AUDITORIA', modo_calculo: 'fixo', multiplica_cadeiras: 1, multiplica_faturamento: 1, multiplica_hibrido: 1, regras_calculo: [] },
  { id: 47, codigo: 'auditoria_tributaria', nome: 'Auditoria Tributária e Fiscal', tipo: 'Pontual', valor_base: 4500, ativo: 1, categoria: 'Servico', empresa: 'AUDITORIA', modo_calculo: 'fixo', multiplica_cadeiras: 1, multiplica_faturamento: 1, multiplica_hibrido: 1, regras_calculo: [] },
  { id: 48, codigo: 'auditoria_contabil', nome: 'Auditoria Contábil e Balanço', tipo: 'Pontual', valor_base: 5000, ativo: 1, categoria: 'Servico', empresa: 'AUDITORIA', modo_calculo: 'fixo', multiplica_cadeiras: 1, multiplica_faturamento: 1, multiplica_hibrido: 1, regras_calculo: [] },
  { id: 49, codigo: 'auditoria_recorrente', nome: 'Auditoria Contínua & Compliance', tipo: 'Mensal', valor_base: 2500, ativo: 1, categoria: 'Servico', empresa: 'AUDITORIA', modo_calculo: 'fixo', multiplica_cadeiras: 1, multiplica_faturamento: 1, multiplica_hibrido: 1, regras_calculo: [] },
  { id: 50, codigo: 'lagerhaus_coworking', nome: 'Locação de Estação Coworking Premium', tipo: 'Mensal', valor_base: 900, ativo: 1, categoria: 'Servico', empresa: 'LAGERHAUS', modo_calculo: 'fixo', multiplica_cadeiras: 1, multiplica_faturamento: 1, multiplica_hibrido: 1, regras_calculo: [] },
  { id: 51, codigo: 'lagerhaus_sala_privativa', nome: 'Locação de Sala Privativa Executiva', tipo: 'Mensal', valor_base: 2500, ativo: 1, categoria: 'Servico', empresa: 'LAGERHAUS', modo_calculo: 'fixo', multiplica_cadeiras: 1, multiplica_faturamento: 1, multiplica_hibrido: 1, regras_calculo: [] },
  { id: 52, codigo: 'lagerhaus_galpao_logistico', nome: 'Módulo Galpão Logístico Inteligente', tipo: 'Mensal', valor_base: 6500, ativo: 1, categoria: 'Servico', empresa: 'LAGERHAUS', modo_calculo: 'fixo', multiplica_cadeiras: 1, multiplica_faturamento: 1, multiplica_hibrido: 1, regras_calculo: [] },
  { id: 53, codigo: 'lagerhaus_endereco_fiscal', nome: 'Endereço Fiscal e Comercial', tipo: 'Mensal', valor_base: 250, ativo: 1, categoria: 'Servico', empresa: 'LAGERHAUS', modo_calculo: 'fixo', multiplica_cadeiras: 1, multiplica_faturamento: 1, multiplica_hibrido: 1, regras_calculo: [] },
  { id: 54, codigo: 'lagerhaus_taxa_adesao', nome: 'Taxa de Implantação e Credenciamento', tipo: 'Pontual', valor_base: 500, ativo: 1, categoria: 'Servico', empresa: 'LAGERHAUS', modo_calculo: 'fixo', multiplica_cadeiras: 1, multiplica_faturamento: 1, multiplica_hibrido: 1, regras_calculo: [] }
];

/**
 * Catálogo de preços + regras de cálculo vinculadas (mesmo formato de GET /api/regras-precificacao).
 */
async function carregarRegrasPrecificacao() {
  return cacheService.getOrSet("regras_precificacao", async () => {
    try {
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
    } catch (err) {
      console.warn("Aviso: Falha ao consultar regras_precificacao no banco de dados. Usando catálogo de fallback.", err.message);
      return CATALOGO_PADRAO_FALLBACK;
    }
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
      const val = valorConfigurado(regras, s.codigo, ctx) * multiplicador(s, ctx);
      ref.set(s.nome, val);
      if (s.codigo === "contabil") {
        ref.set("Honorário Contábil", val);
        ref.set("Honorários Contábeis", val);
        ref.set("Honorário Contábil (Assessoria Contábil/Fiscal PJ)", val);
      }
      if (s.codigo === "fiscal") {
        ref.set("Honorário Contábil PF", val);
        ref.set("Honorário Contábil (Assessoria Contábil/Fiscal PF)", val);
      }
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

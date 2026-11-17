import test from "node:test";
import assert from "node:assert/strict";

// Teste de cálculo de diferenças entre dados antigos e novos de uma proposta
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

test("calcularDiferencasProposta detects faturamento, total and items diff accurately", () => {
  const antiga = {
    faturamento: 35000,
    valor_total: 1200,
    cadeiras: 2,
    funcionarios: 3,
    socios: 1,
    regime_fiscal: "Simples Nacional",
    itens_json: JSON.stringify([
      { servico: "Honorário Contábil Mensal", valor: 1200 }
    ])
  };

  const novosDados = {
    faturamento: 65000,
    valorTotal: 1950,
    cadeiras: 4,
    funcionarios: 5,
    socios: 2,
    regimeFiscal: "Simples Nacional",
    itens: [
      { servico: "Honorário Contábil Mensal", valor: 1600 },
      { servico: "BPO Financeiro", valor: 350 }
    ]
  };

  const diff = calcularDiferencasProposta(antiga, novosDados);

  assert.equal(diff.alteracoes.length, 6);
  assert.equal(diff.anterior.faturamento, 35000);
  assert.equal(diff.novo.faturamento, 65000);
  assert.equal(diff.anterior.valor_total, 1200);
  assert.equal(diff.novo.valor_total, 1950);
  assert.equal(diff.anterior.cadeiras, 2);
  assert.equal(diff.novo.cadeiras, 4);
  assert.deepEqual(diff.novo.servicos_adicionados, ["BPO Financeiro"]);
});

test("calcularDiferencasProposta returns empty when nothing changed", () => {
  const dados = {
    faturamento: 50000,
    valor_total: 1500,
    cadeiras: 3,
    funcionarios: 4,
    socios: 1,
    itens_json: JSON.stringify([{ servico: "Honorário Contábil Mensal", valor: 1500 }])
  };

  const diff = calcularDiferencasProposta(dados, {
    faturamento: 50000,
    valorTotal: 1500,
    cadeiras: 3,
    funcionarios: 4,
    socios: 1,
    itens: [{ servico: "Honorário Contábil Mensal", valor: 1500 }]
  });

  assert.equal(diff.alteracoes.length, 0);
  assert.deepEqual(diff.anterior, {});
  assert.deepEqual(diff.novo, {});
});


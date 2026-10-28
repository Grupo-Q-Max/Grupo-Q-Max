const db = require("../config/db");

// Quem assina como CONTRATADA em cada marca. Fonte única para o contrato do D4Sign (pdfService) e para a
// minuta do cliente (contratoService), que antes tinham textos diferentes e CNPJs fictícios na minuta.
// Valores vêm do admin (configuracoes_sistema, chave contratada_<marca>, JSON); campo vazio cai no padrão,
// que é o texto que já ia para o D4Sign.
const MARCAS = ["finora", "contabil", "tech", "auditoria", "lagerhaus"];

const PADRAO = {
  razao_social: "o escritório contábil {marca}",
  cnpj: "12.552.249/0001-99",
  endereco: "Rua Frei Gaspar nº 941, conjunto 105, São Bernardo do Campo/SP, CEP 09720-440",
  qualificacao: "registrado no CRC/SP nº 2SP038524-O",
  representante:
    "HUGO LUDWIG WERNINGHAUS, brasileiro, contador, registrado no Conselho Regional de Contabilidade sob o nº 1SP227194/O-0 e inscrito no CPF sob o nº 173.552.218-09",
};
const CAMPOS = Object.keys(PADRAO);
// Nome da marca no padrão "o escritório contábil <marca>" (mesmos nomes do cabeçalho do PDF)
const NOME_MARCA = { finora: "FINORA", contabil: "QMAX CONTÁBIL", tech: "QMAX TECH", auditoria: "QMAX AUDITORIA", lagerhaus: "LAGERHAUS" };

function marcaDoTipo(tipoProposta) {
  const tipo = String(tipoProposta || "finora").toLowerCase();
  return MARCAS.includes(tipo) ? tipo : "finora";
}

/**
 * @param {string} tipoProposta finora | contabil | tech | auditoria | lagerhaus
 */
async function obterContratada(tipoProposta) {
  const marca = marcaDoTipo(tipoProposta);
  let salvo = {};
  try {
    const [linha] = await db.executarQuery(
      "SELECT valor FROM configuracoes_sistema WHERE chave = ?",
      [`contratada_${marca}`],
    );
    if (linha && linha.valor) salvo = typeof linha.valor === "string" ? JSON.parse(linha.valor) : linha.valor;
  } catch (e) {
    console.warn("[Contratada] Configuração ilegível, usando padrão:", e.message);
  }
  const contratada = {};
  for (const campo of CAMPOS) {
    const valor = typeof salvo[campo] === "string" ? salvo[campo].trim() : "";
    contratada[campo] = (valor || PADRAO[campo]).replace("{marca}", NOME_MARCA[marca]);
  }
  return contratada;
}

// Sem acesso ao banco (geração síncrona ou chamada antiga sem contratada): só o padrão
function contratadaPadrao(tipoProposta) {
  const marca = marcaDoTipo(tipoProposta);
  return Object.fromEntries(CAMPOS.map((c) => [c, PADRAO[c].replace("{marca}", NOME_MARCA[marca])]));
}

// Trecho do preâmbulo do contrato que qualifica a CONTRATADA
function textoContratada(c) {
  return `${c.razao_social}, com sede na ${c.endereco}, inscrito no CNPJ sob nº ${c.cnpj}${c.qualificacao ? `, ${c.qualificacao}` : ""}, doravante CONTRATADO, neste ato representada por ${c.representante}`;
}

module.exports = { MARCAS, CAMPOS, PADRAO, obterContratada, contratadaPadrao, textoContratada, marcaDoTipo };

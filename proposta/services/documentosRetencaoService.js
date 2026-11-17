const fs = require("fs");
const path = require("path");
const db = require("../config/db");
const { DIAS_VALIDADE } = require("./proposalHelpers");

const documentosFolder = path.join(__dirname, "../storage/documentos_onboarding");
const DIAS_RETENCAO = 90;

/**
 * LGPD (minimização/retenção): apaga documentos de onboarding (arquivo + linha em proposta_documentos)
 * de propostas recusadas há mais de 90 dias ou vencidas (validade de 10 dias) há mais de 90 dias.
 * Loga só contagens, nunca nomes de arquivo ou dados do cliente.
 */
async function executarRetencaoDocumentos() {
  try {
    const docs = await db.executarQuery(
      `SELECT d.id, d.caminho_arquivo
       FROM proposta_documentos d
       JOIN propostas p ON p.id = d.proposta_id
       WHERE (p.status = 'Recusada'
              AND COALESCE(p.data_decisao, p.criado_em) < DATE_SUB(NOW(), INTERVAL ${DIAS_RETENCAO} DAY))
          OR (p.status IN ('Pendente', 'Expirada')
              AND COALESCE(p.validade_inicia_em, p.criado_em)
                  < DATE_SUB(NOW(), INTERVAL ${DIAS_RETENCAO + DIAS_VALIDADE} DAY))`,
    );

    let arquivos = 0;
    let linhas = 0;
    for (const doc of docs) {
      const filePath = path.join(documentosFolder, path.basename(doc.caminho_arquivo || ""));
      try {
        await fs.promises.unlink(filePath);
        arquivos++;
      } catch (err) {
        // Arquivo já ausente: segue e remove a linha órfã. Outro erro: mantém a linha para tentar de novo.
        if (err.code !== "ENOENT") continue;
      }
      await db.execute("DELETE FROM proposta_documentos WHERE id = ?", [doc.id]);
      linhas++;
    }

    console.log(`[Retenção Documentos] ${arquivos} arquivo(s) e ${linhas} registro(s) removidos.`);
  } catch (error) {
    console.error("[Retenção Documentos] Erro durante retenção:", error.message);
  }
}

/**
 * Agenda a retenção (uma vez após a inicialização e depois a cada 24 horas).
 */
function inicializarAgendamentoRetencao() {
  setTimeout(executarRetencaoDocumentos, 15000);
  setInterval(executarRetencaoDocumentos, 24 * 60 * 60 * 1000);
}

module.exports = {
  executarRetencaoDocumentos,
  inicializarAgendamentoRetencao
};

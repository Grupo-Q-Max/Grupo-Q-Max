const fs = require("fs");
const path = require("path");
const db = require("../config/db");

const pdfFolder = path.join(__dirname, "../storage/propostas_pdf");

/**
 * Executa a limpeza de arquivos PDF antigos.
 * Exclui PDFs criados há mais de 30 dias que não correspondam a propostas 'Aprovadas'.
 */
async function executarLimpezaPDFs() {
  try {
    console.log("[PDF Cleanup] Iniciando varredura de PDFs antigos...");

    if (!fs.existsSync(pdfFolder)) {
      console.log("[PDF Cleanup] Diretório de PDFs não encontrado. Abortando.");
      return;
    }

    const arquivos = fs.readdirSync(pdfFolder);
    const limiteTempo = 30 * 24 * 60 * 60 * 1000; // 30 dias em milissegundos
    const agora = Date.now();
    let deletados = 0;

    for (const arquivo of arquivos) {
      if (!arquivo.endsWith(".pdf")) continue;

      const filePath = path.join(pdfFolder, arquivo);
      const stats = fs.statSync(filePath);

      // Verificar se o arquivo tem mais de 30 dias
      if (agora - stats.mtimeMs > limiteTempo) {
        const tokenAcesso = path.basename(arquivo, ".pdf");

        // Consultar no banco se a proposta correspondente está aprovada
        const propostas = await db.executarQuery(
          "SELECT status FROM propostas WHERE token_acesso = ? LIMIT 1",
          [tokenAcesso]
        );

        const status = propostas[0]?.status;

        // Se a proposta foi deletada, recusada ou ainda está pendente há mais de 30 dias, podemos excluir o PDF
        if (!propostas.length || (status !== "Aprovada" && status !== "Assinada")) {
          try {
            fs.unlinkSync(filePath);
            deletados++;
          } catch (err) {
            console.error(`[PDF Cleanup] Falha ao deletar arquivo ${arquivo}:`, err.message);
          }
        }
      }
    }

    console.log(`[PDF Cleanup] Limpeza concluída. ${deletados} arquivo(s) PDF deletado(s).`);
  } catch (error) {
    console.error("[PDF Cleanup] Erro durante limpeza de PDFs:", error.message);
  }
}

/**
 * Inicializa o agendamento da limpeza de PDFs (roda a cada 24 horas).
 */
function inicializarAgendamentoLimpeza() {
  // Executa uma vez na inicialização após 10 segundos
  setTimeout(() => {
    executarLimpezaPDFs();
  }, 10000);

  // Executa a cada 24 horas
  setInterval(() => {
    executarLimpezaPDFs();
  }, 24 * 60 * 60 * 1000);
}

module.exports = {
  executarLimpezaPDFs,
  inicializarAgendamentoLimpeza
};

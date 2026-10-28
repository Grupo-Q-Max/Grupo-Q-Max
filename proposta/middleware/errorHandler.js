function errorHandler(err, req, res, next) {
  console.error("=== ERRO INTERNO DO SERVIDOR ===");
  console.error(`Caminho: ${req.method} ${req.url}`);
  console.error(`Mensagem: ${err.message}`);
  console.error(err.stack || err);
  console.error("================================");

  if (err.name === "ValidationError" || err.issues) {
    return res.status(400).json({
      error: "Dados inválidos fornecidos.",
      detalhes: err.issues || err.message
    });
  }

  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "Arquivo ou dados maiores que o limite permitido." });
  }

  const status = err.status || 500;
  const friendlyMessage = status === 500
    ? "Ocorreu um erro interno no servidor ao processar sua solicitação."
    : err.message;

  res.status(status).json({
    error: friendlyMessage
  });
}

module.exports = errorHandler;

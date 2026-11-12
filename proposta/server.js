const path = require("path");
const fs = require("fs");
const envTestPath = path.resolve(process.cwd(), ".env.test");
const useTestEnv = process.env.NODE_ENV === "test" && fs.existsSync(envTestPath);

require("dotenv").config({
  path: useTestEnv ? envTestPath : path.resolve(process.cwd(), ".env")
});

const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const compression = require("compression");
const morgan = require("morgan");

const { verificarTokenSSE } = require("./middleware/auth");
const notificationService = require("./services/notificationService");
const errorHandler = require("./middleware/errorHandler");

const authRouter = require("./routes/auth");
const propostasRouter = require("./routes/propostas");
const solicitacoesRouter = require("./routes/solicitacoes");
const regrasRouter = require("./routes/regras");
const leadsRouter = require("./routes/leads");
const funisRouter = require("./routes/funis");
const webhooksRouter = require("./routes/webhooks");
const automacoesRouter = require("./routes/automacoes");
const prospeccaoRouter = require("./routes/prospeccao");

const app = express();
app.set("trust proxy", 1);

const APP_BASE_PATH = process.env.APP_BASE_PATH || "/proposta";
const publicPath = path.join(__dirname, "public");

// helmet antes do static: páginas públicas (aprovação do cliente) também recebem X-Frame-Options etc.
app.use(
  helmet({
    contentSecurityPolicy: false,
  }),
);

app.use(
  APP_BASE_PATH,
  express.static(publicPath, {
    maxAge: process.env.NODE_ENV === "production" ? "1d" : 0,
    etag: true,
    // HTML/JS/CSS sem versão no nome: revalidar sempre (ETag) para não rodar motor de preço antigo após deploy
    setHeaders: (res, filePath) => {
      if (/\.(html|js|css)$/.test(filePath)) res.setHeader("Cache-Control", "no-cache");
    },
  })
);

app.get("/", (req, res) => {
  res.redirect(`${APP_BASE_PATH}/login.html`);
});

app.get(APP_BASE_PATH, (req, res) => {
  res.redirect(`${APP_BASE_PATH}/login.html`);
});

app.get(`${APP_BASE_PATH}/`, (req, res) => {
  res.redirect(`${APP_BASE_PATH}/login.html`);
});

app.use(compression());

// Nunca gravar segredos de query string no log (webhook D4Sign ?secret=, SSE ?token= com JWT)
morgan.token("url", (req) => (req.originalUrl || req.url).replace(/([?&](?:secret|token)=)[^&]*/gi, "$1***"));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use(express.json({ limit: "2mb" }));

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({
      error: "JSON inválido no corpo da requisição.",
    });
  }
  next(err);
});

// Rate limit global brando para rotas públicas e assets
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5000,
    skip: () => process.env.NODE_ENV === "test",
    message: {
      error: "Muitas requisições. Tente novamente em alguns minutos.",
    },
  }),
);

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Servidor online",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

const pdfFolder = path.join(__dirname, "storage", "propostas_pdf");
if (!fs.existsSync(pdfFolder)) {
  fs.mkdirSync(pdfFolder, { recursive: true });
}

// SSE Stream para notificações em tempo real
app.get("/api/notifications/stream", verificarTokenSSE, (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const clientId = Date.now() + "_" + Math.random().toString(36).substr(2, 9);
  const newClient = {
    id: clientId,
    userId: req.user.id,
    role: req.user.role,
    res: res
  };

  notificationService.addClient(newClient);

  const keepAliveInterval = setInterval(() => {
    try {
      res.write(`: keep-alive ping\n\n`);
      if (typeof res.flush === "function") res.flush();
    } catch (e) {
      // Connection closed
    }
  }, 30000);

  req.on("close", () => {
    clearInterval(keepAliveInterval);
    notificationService.removeClient(clientId);
    res.end();
  });
});

// Acoplamento de rotas modulares
app.use(authRouter);
app.use(propostasRouter);
app.use(solicitacoesRouter);
app.use(regrasRouter);
app.use(leadsRouter);
app.use(funisRouter);
app.use(webhooksRouter);
app.use(automacoesRouter);
app.use(prospeccaoRouter);

app.get("/favicon.ico", (req, res) => {
  res.status(204).end();
});

app.get("/.well-known/appspecific/com.chrome.devtools.json", (req, res) => {
  res.status(204).end();
});

app.use((req, res) => {
  res.status(404).json({
    error: "Rota não encontrada.",
  });
});

// Middleware centralizado de tratamento de erros
app.use(errorHandler);

process.on("uncaughtException", (err) => {
  console.error("Erro não tratado (uncaughtException):", err);
  process.exit(1);
});

process.on("unhandledRejection", (err) => {
  console.error("Promise rejeitada não tratada (unhandledRejection):", err);
});

const PORT = process.env.PORT || 3005;
app.listen(PORT, () => {
  console.log(`Servidor FINORA rodando com sucesso na porta ${PORT}`);

  // Dev local apontando pro banco de produção: não duplicar follow-ups, lembretes e polling D4Sign
  if (process.env.DISABLE_BACKGROUND_JOBS === "true") {
    console.log("Jobs em segundo plano desativados (DISABLE_BACKGROUND_JOBS=true).");
    return;
  }

  // Inicializar limpeza automatizada de arquivos temporários PDF
  try {
    const pdfCleanupService = require("./services/pdfCleanupService");
    pdfCleanupService.inicializarAgendamentoLimpeza();
  } catch (error) {
    console.error("Erro ao inicializar serviço de limpeza de PDFs:", error.message);
  }

  // Inicializar lembretes de atividades do CRM
  try {
    const reminderService = require("./services/reminderService");
    reminderService.inicializarLembretesComerciais();
  } catch (error) {
    console.error("Erro ao inicializar serviço de lembretes comerciais:", error.message);
  }

  // Inicializar Motor Autônomo de Follow-up de Propostas
  try {
    const followUpService = require("./services/followUpService");
    followUpService.processarReguaFollowUp();
    // Executar varredura a cada 15 minutos
    setInterval(() => {
      followUpService.processarReguaFollowUp();
    }, 15 * 60 * 1000);
  } catch (error) {
    console.error("Erro ao inicializar motor de follow-up:", error.message);
  }

  // Assinado/cancelado no D4Sign sem webhook (segredo ausente, evento perdido): consulta a cada 30 minutos
  const d4signService = require("./services/d4signService");
  d4signService.verificarAssinaturasPendentes();
  setInterval(() => d4signService.verificarAssinaturasPendentes(), 30 * 60 * 1000);
});

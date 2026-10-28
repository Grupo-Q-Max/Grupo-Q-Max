const logsBuffer = [];
const MAX_LOGS = 300;

function registrarLog(level, component, message, details = null) {
  const entry = {
    id: Date.now() + "_" + Math.random().toString(36).substr(2, 6),
    timestamp: new Date().toISOString(),
    level: level.toLowerCase(), // 'info', 'warn', 'error', 'success'
    component,
    message,
    details: details ? (typeof details === "object" ? JSON.stringify(details) : String(details)) : null
  };

  logsBuffer.unshift(entry);
  if (logsBuffer.length > MAX_LOGS) {
    logsBuffer.pop();
  }

  // Se for erro ou aviso, imprime no console do servidor também
  if (level === "error") {
    console.error(`[SYS LOG - ${component}] ❌ ${message}`, details || "");
  } else if (level === "warn") {
    console.warn(`[SYS LOG - ${component}] ⚠️ ${message}`, details || "");
  } else if (level === "success") {
    console.log(`[SYS LOG - ${component}] ✅ ${message}`, details || "");
  } else {
    console.log(`[SYS LOG - ${component}] ℹ️ ${message}`, details || "");
  }

  return entry;
}

function obterLogs(filtroLevel = null, limite = 100) {
  let logs = logsBuffer;
  if (filtroLevel && filtroLevel !== "todos") {
    logs = logs.filter((l) => l.level === filtroLevel.toLowerCase());
  }
  return logs.slice(0, limite);
}

function limparLogs() {
  logsBuffer.length = 0;
}

// Log inicial ao carregar o módulo
registrarLog("info", "Sistema", "Módulo de Monitoramento e Logs inicializado com sucesso.");

module.exports = {
  registrarLog,
  obterLogs,
  limparLogs
};

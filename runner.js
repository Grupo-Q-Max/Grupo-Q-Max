const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('[RUNNER] ==========================================');
console.log('[RUNNER] INICIANDO ECOSSISTEMA GRUPO Q-MAX + EVENTOS');
console.log('[RUNNER] ==========================================');

// Segredos vêm do .env gerado no deploy (GitHub secrets). Carregado aqui também, para funcionar
// mesmo quando o App Service inicia com "node runner.js" sem --env-file; não sobrescreve o ambiente.
try {
  process.loadEnvFile(path.join(__dirname, '.env'));
} catch {
  // Sem .env (ex.: dev local): usa só o ambiente
}

// Variáveis de ambiente para a API de Eventos
const apiEnv = {
  ...process.env,
  PORT: '3334',
  DATABASE_URL: process.env.EVENTOS_DATABASE_URL || process.env.DATABASE_URL_EVENTOS,
  JWT_SECRET: process.env.EVENTOS_JWT_SECRET,
  CPF_HASH_SECRET: process.env.EVENTOS_CPF_HASH_SECRET,
  DATA_ENCRYPTION_KEY: process.env.EVENTOS_DATA_ENCRYPTION_KEY,
  FINORA_ADMIN_API_KEY: process.env.FINORA_ADMIN_API_KEY,
  DISABLE_WHATSAPP: process.env.DISABLE_WHATSAPP || 'true',
};
for (const name of ['EVENTOS_DATABASE_URL', 'EVENTOS_JWT_SECRET', 'EVENTOS_CPF_HASH_SECRET', 'EVENTOS_DATA_ENCRYPTION_KEY', 'FINORA_ADMIN_API_KEY', 'FINORA_ADMIN_SESSION_TOKEN']) {
  if (!process.env[name]) console.warn(`[RUNNER] ${name} não definido no .env`);
}

// Variáveis de ambiente para o Web de Eventos
const webEnv = {
  ...process.env,
  PORT: '3001',
  HOSTNAME: '0.0.0.0',
  FINORA_INTERNAL_API_URL: 'http://127.0.0.1:3334/api/v1',
  NEXT_PUBLIC_API_URL: 'http://127.0.0.1:3334/api/v1',
  FINORA_ADMIN_API_KEY: process.env.FINORA_ADMIN_API_KEY,
  FINORA_ADMIN_SESSION_TOKEN: process.env.FINORA_ADMIN_SESSION_TOKEN,
};

// 1. Iniciar API de Eventos
let apiProcess = null;
const apiScriptCandidates = [
  path.join(__dirname, 'eventos-api/dist/src/main.js'),
  path.join(__dirname, 'eventos/apps/api/dist/src/main.js'),
];
const apiScript = apiScriptCandidates.find((p) => fs.existsSync(p));

if (apiScript) {
  const apiCwd = apiScript.includes('eventos-api')
    ? path.join(__dirname, 'eventos-api')
    : path.dirname(path.dirname(path.dirname(apiScript)));
  console.log(`[RUNNER] 1/3 Iniciando API de Eventos na porta 3334 (cwd: ${apiCwd})...`);
  apiProcess = spawn('node', [apiScript], {
    cwd: apiCwd,
    env: apiEnv,
    stdio: 'inherit',
  });
  apiProcess.on('exit', (code) => {
    console.error(`[RUNNER] API de Eventos encerrou com código ${code}`);
  });
} else {
  console.warn('[RUNNER] Aviso: API de Eventos não encontrada.');
}

// 2. Iniciar Web de Eventos
let webProcess = null;
const webScriptCandidates = [
  path.join(__dirname, 'eventos-web/apps/web/server.js'),
  path.join(__dirname, 'eventos/apps/web/.next/standalone/apps/web/server.js'),
];
const webScript = webScriptCandidates.find((p) => fs.existsSync(p));

if (webScript) {
  const webCwd = webScript.includes('eventos-web')
    ? path.join(__dirname, 'eventos-web')
    : path.resolve(path.dirname(webScript), '..');
  console.log(`[RUNNER] 2/3 Iniciando Web de Eventos na porta 3001 (cwd: ${webCwd})...`);
  webProcess = spawn('node', ['apps/web/server.js'], {
    cwd: webCwd,
    env: webEnv,
    stdio: 'inherit',
  });
  webProcess.on('exit', (code) => {
    console.error(`[RUNNER] Web de Eventos encerrou com código ${code}`);
  });
} else {
  console.warn('[RUNNER] Aviso: Web de Eventos não encontrada.');
}

// 3. Iniciar PHP para Controle de Fechamento (se diretório existir e php estiver disponível)
let phpProcess = null;
const fechamentoDir = path.join(__dirname, 'controle_fechamento');
if (!process.env.FECHAMENTO_URL && fs.existsSync(fechamentoDir)) {
  try {
    const { spawnSync } = require('child_process');
    const hasPhp = spawnSync('php', ['-v'], { stdio: 'ignore' }).status === 0;
    if (hasPhp) {
      console.log('[RUNNER] 3/4 Iniciando PHP Controle de Fechamento na porta 8002...');
      phpProcess = spawn('php', ['-S', '127.0.0.1:8002', '-t', fechamentoDir], {
        cwd: fechamentoDir,
        env: process.env,
        stdio: 'inherit',
      });
      phpProcess.on('exit', (code) => {
        console.error(`[RUNNER] PHP Controle de Fechamento encerrou com código ${code}`);
      });
    }
  } catch (e) {
    // PHP não instalado no ambiente
  }
}

// 4. Iniciar Site Principal (Next.js)
const targetPort = process.env.PORT || 8080;
console.log(`[RUNNER] Iniciando Site Principal Q-Max na porta ${targetPort}...`);
const mainScriptCandidates = [
  path.join(__dirname, 'server.js'),
  path.join(__dirname, '.qmax-next/standalone/server.js'),
];
const mainScript = mainScriptCandidates.find((p) => fs.existsSync(p));

if (mainScript) {
  const mainCwd = path.dirname(mainScript);
  const mainProcess = spawn('node', [path.basename(mainScript)], {
    cwd: mainCwd,
    env: { ...process.env, PORT: String(targetPort) },
    stdio: 'inherit',
  });

  mainProcess.on('exit', (code) => {
    console.log(`[RUNNER] Site principal encerrou com código ${code}`);
    cleanup();
    process.exit(code || 0);
  });
} else {
  console.error('[RUNNER] ERRO CRÍTICO: server.js principal não encontrado em nenhuma das opções.');
}

function cleanup() {
  console.log('[RUNNER] Encerrando subprocessos...');
  if (apiProcess && !apiProcess.killed) {
    try { apiProcess.kill(); } catch (e) {}
  }
  if (webProcess && !webProcess.killed) {
    try { webProcess.kill(); } catch (e) {}
  }
  if (phpProcess && !phpProcess.killed) {
    try { phpProcess.kill(); } catch (e) {}
  }
}

process.on('SIGTERM', () => { cleanup(); process.exit(0); });
process.on('SIGINT', () => { cleanup(); process.exit(0); });

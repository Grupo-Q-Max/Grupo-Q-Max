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
const rawEventosDb = process.env.EVENTOS_DATABASE_URL || process.env.DATABASE_URL_EVENTOS;
const eventosDbUrl = (!rawEventosDb || rawEventosDb.includes('74.249.25.198'))
  ? 'mysql://eventos:U2a6M2slUs-^@webbd01-app-server.mysql.database.azure.com:3306/eventos?sslaccept=strict'
  : rawEventosDb;

const apiEnv = {
  ...process.env,
  PORT: '3334',
  DATABASE_URL: eventosDbUrl,
  JWT_SECRET: process.env.EVENTOS_JWT_SECRET || 'LrHr6PbK8VwoJOyEAWJb8LQRmrL9BtnMPnV1FvKNXKAKaPGqX0zwE7znNm08u9cM4Tjc1KlyvByqXUzrRGU0wQ==',
  CPF_HASH_SECRET: process.env.EVENTOS_CPF_HASH_SECRET || 'sH/m2ZPzl2LKsVk7vltdhyskTxw9AytxVWYUb4xHCgm0er8TPZPJU8AvKPfoaUnMYyTpteYEsW/k1k2SJKsMJQ==',
  DATA_ENCRYPTION_KEY: process.env.EVENTOS_DATA_ENCRYPTION_KEY || 'KpNIaoTapxUlgRL8zfFJf28/h7GuRWt1/6x1pNwu9gU=',
  FINORA_ADMIN_API_KEY: process.env.FINORA_ADMIN_API_KEY || 'd1e5e0767cdf3fa8011eac46f983cbaf3d2f5aff806d27c6631cb751b4c8c9b3',
  DISABLE_WHATSAPP: process.env.DISABLE_WHATSAPP || 'true',
};

// Variáveis de ambiente para o Web de Eventos
const webEnv = {
  ...process.env,
  PORT: '3001',
  HOSTNAME: '0.0.0.0',
  FINORA_INTERNAL_API_URL: 'http://127.0.0.1:3334/api/v1',
  NEXT_PUBLIC_API_URL: 'http://127.0.0.1:3334/api/v1',
  FINORA_ADMIN_API_KEY: process.env.FINORA_ADMIN_API_KEY || 'd1e5e0767cdf3fa8011eac46f983cbaf3d2f5aff806d27c6631cb751b4c8c9b3',
  FINORA_ADMIN_SESSION_TOKEN: process.env.FINORA_ADMIN_SESSION_TOKEN || '66b34419aded34f57ad0b5a70375e8c9174bc3c1a10ee72b61272e7a2ee406df',
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
  console.log(`[RUNNER] 1/4 Iniciando API de Eventos na porta 3334 (cwd: ${apiCwd})...`);
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
  console.log(`[RUNNER] 2/4 Iniciando Web de Eventos na porta 3001 (cwd: ${webCwd})...`);
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
      console.log('[RUNNER] Iniciar PHP Controle de Fechamento na porta 8002...');
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

// 3b. Iniciar PHP para Q-Max Quiz (se diretório existir e php estiver disponível)
let quizPhpProcess = null;
const quizDir = path.join(__dirname, 'qmax-quiz');
if (fs.existsSync(quizDir)) {
  try {
    const { spawnSync } = require('child_process');
    const hasPhp = spawnSync('php', ['-v'], { stdio: 'ignore' }).status === 0;
    if (hasPhp) {
      const quizPort = process.env.PORT_QUIZ || '8003';
      console.log(`[RUNNER] Iniciar PHP Q-Max Quiz na porta ${quizPort}...`);
      quizPhpProcess = spawn('php', ['-S', `127.0.0.1:${quizPort}`, '-t', quizDir], {
        cwd: quizDir,
        env: process.env,
        stdio: 'inherit',
      });
      quizPhpProcess.on('exit', (code) => {
        console.error(`[RUNNER] PHP Q-Max Quiz encerrou com código ${code}`);
      });
    }
  } catch (e) {
    // PHP não instalado no ambiente
  }
}

// 4. Iniciar Sistema de Propostas (se existir)
let propostaProcess = null;
const propostaDir = path.join(__dirname, 'proposta');
const propostaScript = path.join(propostaDir, 'server.js');
if (fs.existsSync(propostaScript)) {
  const propostaPort = process.env.PORT_PROPOSTA || '3005';
  console.log(`[RUNNER] 3/4 Iniciando Sistema de Propostas na porta ${propostaPort}...`);
  propostaProcess = spawn('node', ['server.js'], {
    cwd: propostaDir,
    env: {
      ...process.env,
      PORT: String(propostaPort),
    },
    stdio: 'inherit',
  });
  propostaProcess.on('exit', (code) => {
    console.error(`[RUNNER] Sistema de Propostas encerrou com código ${code}`);
  });
}

// 5. Iniciar Site Principal (Next.js)
const targetPort = process.env.PORT || 8080;
console.log(`[RUNNER] 4/4 Iniciando Site Principal Q-Max na porta ${targetPort}...`);
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
  if (quizPhpProcess && !quizPhpProcess.killed) {
    try { quizPhpProcess.kill(); } catch (e) {}
  }
  if (propostaProcess && !propostaProcess.killed) {
    try { propostaProcess.kill(); } catch (e) {}
  }
}

process.on('SIGTERM', () => { cleanup(); process.exit(0); });
process.on('SIGINT', () => { cleanup(); process.exit(0); });

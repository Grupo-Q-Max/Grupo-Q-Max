/**
 * Q-Max Database Backup -> OneDrive Local Sync
 * 
 * Executa mysqldump de cada base de dados, compacta em .sql.gz via stream zlib nativo do Node.js,
 * salva diretamente nas subpastas da pasta sincronizada do OneDrive:
 *   C:\Users\RodrigoSantePenhalve\OneDrive - qmax\Tech\027 Backups BD\<nome_da_base>\
 * E remove backups com mais de 7 dias automaticamente.
 */

import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import dotenv from 'dotenv';

// Carrega variáveis do .env do projeto se disponível
dotenv.config();

const ONEDRIVE_BASE_DIR = process.env.BACKUP_ONEDRIVE_DIR || 'C:\\Users\\RodrigoSantePenhalve\\OneDrive - qmax\\Tech\\027 Backups BD';
const RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS || '7', 10);

const AZURE_HOST = 'webbd01-app-server.mysql.database.azure.com';
const AZURE_PORT = '3306';
const AZURE_USER = 'rodrigo';
const AZURE_PASS = 'Rdp13024022!';

// Bancos de sistema que não devem ser incluídos no backup
const SYSTEM_DATABASES = new Set(['information_schema', 'mysql', 'performance_schema', 'sys']);

/**
 * Localiza o executável do mysqldump no sistema.
 */
function findMysqldump() {
  const candidates = [
    'C:\\Program Files\\MySQL\\MySQL Server 9.0\\bin\\mysqldump.exe',
    'C:\\Program Files\\MySQL\\MySQL Workbench 8.0 CE\\mysqldump.exe',
    'C:\\xampp\\mysql\\bin\\mysqldump.exe',
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  // Tenta pelo PATH do sistema
  try {
    execSync('mysqldump --version', { stdio: 'ignore' });
    return 'mysqldump';
  } catch {}

  throw new Error('mysqldump.exe não encontrado nas pastas padrão nem no PATH.');
}

/**
 * Busca dinamicamente todas as bases de dados no servidor webbd01-app-server
 * que o usuário tem acesso, ignorando schemas de sistema.
 */
function getDatabasesFromAzure() {
  try {
    const mysqlBin = 'C:\\Program Files\\MySQL\\MySQL Server 9.0\\bin\\mysql.exe';
    const cmd = `"${mysqlBin}" -h ${AZURE_HOST} -P ${AZURE_PORT} -u ${AZURE_USER} -p"${AZURE_PASS}" --ssl-mode=REQUIRED -e "SHOW DATABASES;"`;
    const output = execSync(cmd, { stdio: 'pipe' }).toString();
    const lines = output.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    const dbs = [];
    for (const line of lines) {
      if (line === 'Database' || SYSTEM_DATABASES.has(line.toLowerCase())) {
        continue;
      }
      dbs.push({
        name: line,
        host: AZURE_HOST,
        port: AZURE_PORT,
        user: AZURE_USER,
        password: AZURE_PASS,
      });
    }

    if (dbs.length > 0) {
      return dbs;
    }
  } catch (err) {
    console.warn('Aviso ao consultar SHOW DATABASES no servidor Azure:', err.message);
  }

  // Fallback caso a consulta dinâmica falhe
  return [
    'bpo',
    'eventos',
    'fechamento',
    'proposta',
    'qmax',
    'quiz',
    'qxback',
    'qxsign',
  ].map((name) => ({
    name,
    host: AZURE_HOST,
    port: AZURE_PORT,
    user: AZURE_USER,
    password: AZURE_PASS,
  }));
}

/**
 * Executa mysqldump canalizado diretamente no zlib.createGzip() e grava no arquivo de destino.
 */
function dumpAndCompress(mysqldumpPath, db, destFilePath) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finishError = (err) => {
      if (!settled) {
        settled = true;
        if (fs.existsSync(destFilePath)) {
          try { fs.unlinkSync(destFilePath); } catch {}
        }
        reject(err);
      }
    };

    const args = [
      '--quick',
      '--skip-lock-tables',
      '--no-tablespaces',
      '--set-gtid-purged=OFF',
      '--column-statistics=0',
      '-h', db.host,
      '-P', db.port,
      '-u', db.user,
      `-p${db.password}`,
    ];

    if (db.host.includes('azure.com')) {
      args.push('--ssl-mode=REQUIRED');
    } else {
      args.push('--single-transaction');
    }

    args.push(db.name);

    const child = spawn(mysqldumpPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const gzip = zlib.createGzip({ level: 9 });
    const output = fs.createWriteStream(destFilePath);

    let stderr = '';
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    child.on('error', (err) => {
      finishError(new Error(`Falha ao iniciar mysqldump: ${err.message}`));
    });

    child.on('close', (code) => {
      if (code !== 0) {
        try { output.destroy(); } catch {}
        try { gzip.destroy(); } catch {}
        if (fs.existsSync(destFilePath)) {
          try { fs.unlinkSync(destFilePath); } catch {}
        }
        finishError(new Error(`mysqldump falhou (código ${code}): ${stderr.trim() || 'Erro desconhecido'}`));
      }
    });

    output.on('finish', () => {
      if (settled) return;
      try {
        const stats = fs.statSync(destFilePath);
        if (stats.size === 0) {
          finishError(new Error(`Dump gerado está vazio (${db.name}).`));
          return;
        }
        settled = true;
        resolve(stats.size);
      } catch (e) {
        finishError(e);
      }
    });

    output.on('error', (err) => {
      finishError(new Error(`Erro ao gravar arquivo de backup: ${err.message}`));
    });

    child.stdout.pipe(gzip).pipe(output);
  });
}

/**
 * Remove backups com mais de RETENTION_DAYS na pasta do banco.
 */
function cleanOldBackups(folderPath) {
  if (!fs.existsSync(folderPath)) return 0;

  const now = Date.now();
  const maxAgeMs = RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const files = fs.readdirSync(folderPath);
  let deleted = 0;

  for (const file of files) {
    if (file.endsWith('.sql.gz')) {
      const fullPath = path.join(folderPath, file);
      try {
        const stat = fs.statSync(fullPath);
        if (now - stat.mtimeMs > maxAgeMs) {
          fs.unlinkSync(fullPath);
          console.log(`   🗑️ Backup expirado removido (> ${RETENTION_DAYS} dias): ${file}`);
          deleted++;
        }
      } catch (e) {
        console.warn(`   Aviso ao checar expiração de ${file}:`, e.message);
      }
    }
  }

  return deleted;
}

/**
 * Ponto de entrada
 */
async function main() {
  console.log('===============================================================');
  console.log('🔄 BACKUP AUTOMÁTICO DOS BANCOS -> ONEDRIVE Q-MAX');
  console.log(`⏰ Data/Hora: ${new Date().toLocaleString('pt-BR')}`);
  console.log(`📁 Pasta Base OneDrive: ${ONEDRIVE_BASE_DIR}`);
  console.log(`📅 Retenção: ${RETENTION_DAYS} dias (apaga os mais antigos automaticamente)`);
  console.log('===============================================================\n');

  if (!fs.existsSync(ONEDRIVE_BASE_DIR)) {
    console.error(`❌ Pasta do OneDrive não encontrada: ${ONEDRIVE_BASE_DIR}`);
    console.error('Verifique se o OneDrive está ativo e a pasta existe.');
    process.exit(1);
  }

  const mysqldump = findMysqldump();
  console.log(`🔧 Usando mysqldump: ${mysqldump}\n`);

  const databases = getDatabasesFromAzure();
  console.log(`📋 Total de bases para backup: ${databases.length}`);
  databases.forEach((db, i) => console.log(`   ${i + 1}. [${db.name}] em ${db.host}`));
  console.log('');

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;

  let successCount = 0;
  let failCount = 0;

  for (const db of databases) {
    const dbFolder = path.join(ONEDRIVE_BASE_DIR, db.name);
    if (!fs.existsSync(dbFolder)) {
      fs.mkdirSync(dbFolder, { recursive: true });
    }

    const fileName = `backup_${db.name}_${timestamp}.sql.gz`;
    const targetFilePath = path.join(dbFolder, fileName);

    console.log(`📦 Iniciando backup de [${db.name}]...`);
    try {
      const bytes = await dumpAndCompress(mysqldump, db, targetFilePath);
      console.log(`   ✅ Sucesso! Salvo em: ${db.name}\\${fileName} (${(bytes / 1024).toFixed(1)} KB)`);

      // Limpeza de backups antigos nesta pasta
      const removed = cleanOldBackups(dbFolder);
      if (removed > 0) {
        console.log(`   🧹 ${removed} backup(s) antigo(s) excluído(s).`);
      }

      successCount++;
    } catch (err) {
      console.error(`   ❌ Falha ao realizar backup de [${db.name}]: ${err.message}`);
      failCount++;
    }
    console.log('');
  }

  console.log('===============================================================');
  console.log(`🏁 RESULTADO FINAL:`);
  console.log(`   ✅ Bases salvas com sucesso: ${successCount}`);
  if (failCount > 0) {
    console.log(`   ⚠️ Bases com erro:           ${failCount}`);
  }
  console.log(`☁️ O aplicativo do OneDrive fará o envio para a nuvem automaticamente.`);
  console.log('===============================================================\n');

  // Grava o status no arquivo de log do OneDrive para fácil auditoria
  try {
    const logPath = path.join(ONEDRIVE_BASE_DIR, 'backup-status.log');
    const logLine = `[${now.toLocaleString('pt-BR')}] Status: ${successCount}/${databases.length} bases salvas com sucesso${failCount > 0 ? ` (${failCount} falhas)` : ''}.\n`;
    fs.appendFileSync(logPath, logLine, 'utf8');
  } catch {}
}

main().catch((err) => {
  console.error('💥 Erro fatal:', err);
  process.exit(1);
});

/**
 * Q-Max Database Backup & OneDrive Sync
 * 
 * Executa mysqldump de cada base de dados, compacta em .sql.gz,
 * faz o upload para o OneDrive via Microsoft Graph API (upload em partes para qualquer tamanho),
 * e remove automaticamente backups antigos com base na política de retenção.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configurações principais via variáveis de ambiente
const TENANT_ID = process.env.MICROSOFT_TENANT_ID || process.env.MS_TENANT_ID;
const CLIENT_ID = process.env.MICROSOFT_CLIENT_ID || process.env.MS_CLIENT_ID;
const CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET || process.env.MS_CLIENT_SECRET;
const ONEDRIVE_USER = process.env.ONEDRIVE_USER_EMAIL || process.env.ADMIN_EMAIL || 'rodrigo@grupoqmax.com.br';

// Política de retenção: quantos dias manter (padrão: 7 dias = 28 backups de 6 em 6 horas)
const RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS || '7', 10);
const ROOT_ONEDRIVE_FOLDER = process.env.ONEDRIVE_BACKUP_FOLDER || 'Backups_QMax';

// Diretório local temporário para guardar os dumps
const BACKUP_TMP_DIR = path.resolve(__dirname, '../.backup_tmp');

/**
 * Normaliza uma URL de conexão MySQL para extrair host, user, pass, db, port.
 */
function parseDbUrl(urlStr, defaultName = 'database') {
  try {
    const url = new URL(urlStr.replace('mariadb://', 'mysql://'));
    return {
      name: url.pathname.replace(/^\//, '') || defaultName,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      host: url.hostname,
      port: url.port || '3306',
    };
  } catch (e) {
    console.error(`Erro ao analisar URL do banco: ${e.message}`);
    return null;
  }
}

/**
 * Obtém a lista de bancos a serem salvos.
 */
function getDatabasesToBackup() {
  const dbs = [];

  // 1. Banco Principal (Website / CRM)
  if (process.env.DATABASE_URL) {
    const parsed = parseDbUrl(process.env.DATABASE_URL, 'qmax_website');
    if (parsed) dbs.push(parsed);
  }

  // 2. Eventos
  if (process.env.EVENTOS_DATABASE_URL) {
    const parsed = parseDbUrl(process.env.EVENTOS_DATABASE_URL, 'eventos');
    if (parsed) dbs.push(parsed);
  }

  // 3. Proposta
  if (process.env.PROPOSTA_DATABASE_URL) {
    const parsed = parseDbUrl(process.env.PROPOSTA_DATABASE_URL, 'proposta');
    if (parsed) dbs.push(parsed);
  } else if (process.env.PROPOSTA_DB_HOST && process.env.PROPOSTA_DB_USER) {
    dbs.push({
      name: process.env.PROPOSTA_DB_NAME || 'proposta',
      host: process.env.PROPOSTA_DB_HOST,
      user: process.env.PROPOSTA_DB_USER,
      password: process.env.PROPOSTA_DB_PASS || '',
      port: process.env.PROPOSTA_DB_PORT || '3306',
    });
  }

  // 4. Quiz
  if (process.env.QUIZ_DATABASE_URL) {
    const parsed = parseDbUrl(process.env.QUIZ_DATABASE_URL, 'quiz');
    if (parsed) dbs.push(parsed);
  } else if (process.env.QUIZ_DB_HOST && process.env.QUIZ_DB_USER) {
    dbs.push({
      name: process.env.QUIZ_DB_NAME || 'quiz',
      host: process.env.QUIZ_DB_HOST,
      user: process.env.QUIZ_DB_USER,
      password: process.env.QUIZ_DB_PASS || '',
      port: process.env.QUIZ_DB_PORT || '3306',
    });
  }

  // 5. Bases extras customizadas via JSON se informado (BACKUP_CUSTOM_DBS='[{"name":"...", "host":"...", ...}]')
  if (process.env.BACKUP_CUSTOM_DBS) {
    try {
      const custom = JSON.parse(process.env.BACKUP_CUSTOM_DBS);
      if (Array.isArray(custom)) {
        dbs.push(...custom);
      }
    } catch (e) {
      console.warn('Aviso ao analisar BACKUP_CUSTOM_DBS:', e.message);
    }
  }

  // Remover duplicatas pelo nome do banco e host
  const unique = [];
  const seen = new Set();
  for (const db of dbs) {
    const key = `${db.host}_${db.name}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(db);
    }
  }

  return unique;
}

/**
 * Autentica no Microsoft Graph com credenciais de aplicativo (Client Credentials Flow).
 */
async function getMicrosoftGraphToken() {
  if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('Credenciais da Microsoft ausentes (MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET).');
  }

  console.log(`🔑 Obtendo token Microsoft Graph (Tenant: ${TENANT_ID.substring(0, 8)}...)...`);
  const tokenUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Falha na autenticação Microsoft Graph (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.access_token;
}

/**
 * Faz upload do arquivo para o OneDrive em chunks de 5MB via UploadSession.
 */
async function uploadToOneDrive(token, localFilePath, targetFolderPath, fileName) {
  const stats = fs.statSync(localFilePath);
  const fileSize = stats.size;
  const targetUser = encodeURIComponent(ONEDRIVE_USER);

  console.log(`📤 Iniciando upload de ${fileName} (${(fileSize / (1024 * 1024)).toFixed(2)} MB) para OneDrive [${targetFolderPath}]...`);

  // 1. Criar sessão de upload
  const sessionUrl = `https://graph.microsoft.com/v1.0/users/${targetUser}/drive/root:/${targetFolderPath}/${fileName}:/createUploadSession`;
  const sessionRes = await fetch(sessionUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      item: {
        '@microsoft.graph.conflictBehavior': 'replace',
        name: fileName,
      },
    }),
  });

  if (!sessionRes.ok) {
    const errText = await sessionRes.text();
    if (sessionRes.status === 403 || sessionRes.status === 401) {
      console.error('\n⚠️ Permissão necessária no Azure AD:');
      console.error('   O aplicativo precisa da permissão de API do tipo Aplicação: Microsoft Graph -> Files.ReadWrite.All');
      console.error('   E clicar em "Conceder consentimento do administrador para <Sua Organização>".');
      console.error(`   Certifique-se também de que o usuário "${ONEDRIVE_USER}" possui uma licença ativa do OneDrive / SharePoint.`);
    }
    throw new Error(`Falha ao criar UploadSession (${sessionRes.status}): ${errText}`);
  }

  const { uploadUrl } = await sessionRes.json();

  // 2. Enviar arquivo em blocos de 5MB (múltiplo obrigatório de 320 KiB)
  const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB
  const fd = fs.openSync(localFilePath, 'r');
  let offset = 0;

  try {
    while (offset < fileSize) {
      const currentChunkSize = Math.min(CHUNK_SIZE, fileSize - offset);
      const buffer = Buffer.alloc(currentChunkSize);
      fs.readSync(fd, buffer, 0, currentChunkSize, offset);

      const chunkEnd = offset + currentChunkSize - 1;
      const chunkRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Length': `${currentChunkSize}`,
          'Content-Range': `bytes ${offset}-${chunkEnd}/${fileSize}`,
        },
        body: buffer,
      });

      if (!chunkRes.ok && chunkRes.status !== 200 && chunkRes.status !== 201 && chunkRes.status !== 202) {
        const errText = await chunkRes.text();
        throw new Error(`Erro ao enviar chunk ${offset}-${chunkEnd}: ${errText}`);
      }

      offset += currentChunkSize;
      const percent = Math.min(100, Math.round((offset / fileSize) * 100));
      process.stdout.write(`  ⏳ Progresso: ${percent}%\r`);
    }
    console.log(`\n  ✅ Upload concluído com sucesso: ${fileName}`);
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Remove backups antigos no OneDrive com base em RETENTION_DAYS.
 */
async function pruneOldBackups(token, targetFolderPath) {
  const targetUser = encodeURIComponent(ONEDRIVE_USER);
  const listUrl = `https://graph.microsoft.com/v1.0/users/${targetUser}/drive/root:/${targetFolderPath}:/children?$select=id,name,createdDateTime`;

  try {
    const res = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 404) return; // Pasta ainda não existe
    if (!res.ok) {
      console.warn(`Aviso ao listar itens para expiração em ${targetFolderPath}: ${res.statusText}`);
      return;
    }

    const data = await res.json();
    const items = data.value || [];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

    let deletedCount = 0;
    for (const item of items) {
      if (item.name.endsWith('.sql.gz')) {
        const itemDate = new Date(item.createdDateTime);
        if (itemDate < cutoffDate) {
          console.log(`🗑️ Removendo backup expirado (> ${RETENTION_DAYS} dias): ${item.name}`);
          const delUrl = `https://graph.microsoft.com/v1.0/users/${targetUser}/drive/items/${item.id}`;
          await fetch(delUrl, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
          deletedCount++;
        }
      }
    }
    if (deletedCount > 0) {
      console.log(`🧹 ${deletedCount} backup(s) antigo(s) removido(s) de ${targetFolderPath}.`);
    }
  } catch (e) {
    console.warn(`Aviso durante limpeza de backups antigos em ${targetFolderPath}:`, e.message);
  }
}

/**
 * Executa o mysqldump de um banco e compacta com gzip.
 */
function dumpDatabase(db, outputFilePath) {
  console.log(`📦 Gerando dump do banco "${db.name}" em ${db.host}:${db.port}...`);
  
  // Opções seguras para produção:
  // --single-transaction: não trava tabelas InnoDB
  // --quick: não carrega tabelas gigantes na memória de uma vez
  // --skip-lock-tables: evita erro se usuário não tiver LOCK TABLES
  const isWindows = process.platform === 'win32';
  const sslFlag = db.host.includes('azure.com') ? '--ssl-mode=REQUIRED' : '';
  
  let cmd;
  if (isWindows) {
    // PowerShell / Windows
    cmd = `mysqldump --single-transaction --quick --skip-lock-tables --routines --triggers ${sslFlag} -h "${db.host}" -P "${db.port}" -u "${db.user}" -p"${db.password}" "${db.name}" | gzip > "${outputFilePath}"`;
  } else {
    // Linux / GitHub Actions
    cmd = `mysqldump --single-transaction --quick --skip-lock-tables --routines --triggers ${sslFlag} -h "${db.host}" -P "${db.port}" -u "${db.user}" -p"${db.password}" "${db.name}" | gzip > "${outputFilePath}"`;
  }

  try {
    execSync(cmd, { stdio: 'pipe', maxBuffer: 1024 * 1024 * 200 });
  } catch (err) {
    // Se gzip ou mysqldump falhou no pipe, tenta gerar .sql puro e zipar depois
    throw new Error(`Falha no mysqldump para o banco ${db.name}: ${err.stderr?.toString() || err.message}`);
  }

  const stat = fs.statSync(outputFilePath);
  if (stat.size === 0) {
    throw new Error(`Arquivo de dump gerado está vazio para ${db.name}.`);
  }
  console.log(`  ✓ Dump gerado: ${(stat.size / 1024).toFixed(1)} KB`);
}

/**
 * Execução Principal
 */
async function main() {
  console.log('==================================================');
  console.log('🔄 INICIANDO BACKUP PROGRAMADO DOS BANCOS Q-MAX');
  console.log(`⏰ Data: ${new Date().toISOString()}`);
  console.log(`📅 Retenção: ${RETENTION_DAYS} dias | Pasta OneDrive: ${ROOT_ONEDRIVE_FOLDER}`);
  console.log(`👤 Usuário OneDrive: ${ONEDRIVE_USER}`);
  console.log('==================================================\n');

  if (!fs.existsSync(BACKUP_TMP_DIR)) {
    fs.mkdirSync(BACKUP_TMP_DIR, { recursive: true });
  }

  const databases = getDatabasesToBackup();
  if (databases.length === 0) {
    console.error('❌ Nenhuma base de dados encontrada nas variáveis de ambiente!');
    process.exit(1);
  }

  console.log(`📋 Bases encontradas para backup (${databases.length}):`);
  databases.forEach((db, i) => console.log(`   ${i + 1}. ${db.name} (${db.host})`));
  console.log('');

  // 1. Obter Token do OneDrive / Microsoft Graph
  let token;
  try {
    token = await getMicrosoftGraphToken();
    console.log('✅ Autenticado com sucesso no Microsoft Graph API.\n');
  } catch (authErr) {
    console.error('❌ Erro na autenticação com Microsoft Graph:', authErr.message);
    process.exit(1);
  }

  const now = new Date();
  const timestamp = now.toISOString().replace(/T/, '_').replace(/:/g, '-').replace(/\..+/, '');
  let successCount = 0;
  let failCount = 0;

  for (const db of databases) {
    const fileName = `backup_${db.name}_${timestamp}.sql.gz`;
    const localFilePath = path.join(BACKUP_TMP_DIR, fileName);
    const targetFolder = `${ROOT_ONEDRIVE_FOLDER}/${db.name}`;

    try {
      // 1. Gera dump local
      dumpDatabase(db, localFilePath);

      // 2. Faz upload para o OneDrive
      await uploadToOneDrive(token, localFilePath, targetFolder, fileName);

      // 3. Aplica política de retenção (apaga backups > RETENTION_DAYS)
      await pruneOldBackups(token, targetFolder);

      successCount++;
    } catch (e) {
      console.error(`❌ Falha no processamento do banco "${db.name}":`, e.message);
      failCount++;
    } finally {
      // Limpeza do arquivo local temporário
      if (fs.existsSync(localFilePath)) {
        try { fs.unlinkSync(localFilePath); } catch {}
      }
    }
    console.log('--------------------------------------------------');
  }

  // Limpa diretório temporário
  try { fs.rmSync(BACKUP_TMP_DIR, { recursive: true, force: true }); } catch {}

  console.log('\n==================================================');
  console.log(`🏁 RESUMO DO BACKUP:`);
  console.log(`   Sucessos: ${successCount}`);
  console.log(`   Falhas:   ${failCount}`);
  console.log('==================================================');

  if (failCount > 0 && successCount === 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('💥 Erro fatal no executor de backup:', err);
  process.exit(1);
});

const fs = require('fs');
const path = require('path');
const mysql = require(path.join(__dirname, '../proposta/node_modules/mysql2/promise'));
const dotenv = require(path.join(__dirname, '../proposta/node_modules/dotenv'));

async function runImport() {
  const envPath = path.join(__dirname, '../proposta/.env');
  const env = dotenv.parse(fs.readFileSync(envPath));

  const host = env.DB_HOST;
  const user = env.DB_USER;
  const password = env.DB_PASS;
  const database = env.DB_NAME;
  const port = Number(env.DB_PORT) || 3306;

  console.log(`[IMPORT] Conectando ao MySQL em ${host}:${port} como "${user}" (banco: ${database})...`);

  const conn = await mysql.createConnection({
    host,
    user,
    password,
    database,
    port,
    multipleStatements: true,
    ssl: { rejectUnauthorized: false }
  });
  console.log('[IMPORT] Conexão estabelecida com sucesso!');

  console.log('[IMPORT] 1. Desativando checagem de chaves estrangeiras...');
  await conn.query('SET FOREIGN_KEY_CHECKS = 0;');

  console.log('[IMPORT] 2. Limpando tabelas existentes para criação limpa...');
  const [existingTables] = await conn.query('SHOW TABLES');
  for (const t of existingTables) {
    const tableName = Object.values(t)[0];
    await conn.query(`DROP TABLE IF EXISTS \`${tableName}\``);
  }
  console.log(`[IMPORT] Limpeza concluída (${existingTables.length} tabelas removidas).`);

  console.log('[IMPORT] 3. Criando estrutura DDL compatível com Azure GIPK (database.sql)...');
  const ddlSql = fs.readFileSync(path.join(__dirname, '../proposta/database.sql'), 'utf8');
  await conn.query(ddlSql);
  console.log('[IMPORT] Estrutura DDL criada com sucesso!');

  console.log('[IMPORT] 4. Extraindo e executando dados do backup (proposta_db.sql)...');
  await conn.query('SET FOREIGN_KEY_CHECKS = 0;');
  const pSql = fs.readFileSync(path.join(__dirname, '../proposta/proposta_db.sql'), 'utf8');

  // Separar apenas as instruções INSERT
  const insertStatements = [];
  let current = '';
  const lines = pSql.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('--') || trimmed.startsWith('/*')) continue;
    if (trimmed.startsWith('INSERT INTO') || current.length > 0) {
      current += line + '\n';
      if (trimmed.endsWith(';')) {
        // Usar INSERT INTO com REPLACE se já houver seed
        const insertStmt = current.trim().replace(/^INSERT INTO/i, 'REPLACE INTO');
        insertStatements.push(insertStmt);
        current = '';
      }
    }
  }

  console.log(`[IMPORT] Executando ${insertStatements.length} blocos de inserção de dados...`);
  for (let i = 0; i < insertStatements.length; i++) {
    await conn.query(insertStatements[i]);
  }
  console.log('[IMPORT] Todos os dados foram inseridos com sucesso!');

  // Atualizar AUTO_INCREMENT das tabelas a partir do backup
  console.log('[IMPORT] 5. Sincronizando sequências de AUTO_INCREMENT...');
  for (const match of pSql.matchAll(/ALTER TABLE `([^`]+)`\s+MODIFY `([^`]+)` [^;]+AUTO_INCREMENT=(\d+);/g)) {
    const table = match[1];
    const column = match[2];
    const autoInc = match[3];
    try {
      await conn.query(`ALTER TABLE \`${table}\` AUTO_INCREMENT = ${autoInc};`);
    } catch (e) {
      // Ignorar caso tabela já tenha auto_increment maior
    }
  }

  console.log('[IMPORT] 6. Reativando checagem de chaves estrangeiras...');
  await conn.query('SET FOREIGN_KEY_CHECKS = 1;');

  // Relatório Final
  const [tables] = await conn.query('SHOW TABLES');
  console.log('\n======================================================');
  console.log(`[IMPORT] SUCESSO: ${tables.length} tabelas prontas no Azure MySQL`);
  console.log('======================================================');
  let totalRows = 0;
  for (const t of tables) {
    const name = Object.values(t)[0];
    const [[count]] = await conn.query(`SELECT COUNT(*) AS total FROM \`${name}\``);
    console.log(` - ${name.padEnd(28)}: ${count.total} registros`);
    totalRows += count.total;
  }
  console.log('======================================================');
  console.log(`[IMPORT] TOTAL DE REGISTROS NO BANCO: ${totalRows}`);
  console.log('======================================================\n');

  await conn.end();
}

runImport().catch((err) => {
  console.error('[IMPORT] ERRO:', err.message);
  process.exit(1);
});

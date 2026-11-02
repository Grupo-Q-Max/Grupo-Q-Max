const fs = require('fs');
const path = require('path');
const mariadb = require('mariadb');

async function runImport() {
  const envPath = path.join(__dirname, '../qmax-quiz/.env');
  if (!fs.existsSync(envPath)) {
    throw new Error(`Arquivo .env não encontrado em ${envPath}`);
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};
  envContent.split(/\r?\n/).forEach(line => {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (m) {
      let v = (m[2] || '').trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      env[m[1]] = v;
    }
  });

  const host = env.DB_HOST || '127.0.0.1';
  const user = env.DB_USER || 'root';
  const password = env.DB_PASS || '';
  const database = env.DB_NAME || 'quiz';
  const port = Number(env.DB_PORT) || 3306;

  console.log(`[IMPORT QUIZ] Conectando ao MySQL em ${host}:${port} como "${user}" (banco: ${database})...`);

  const conn = await mariadb.createConnection({
    host,
    user,
    password,
    database,
    port,
    multipleStatements: true,
    ssl: host.includes('azure.com') ? { rejectUnauthorized: false } : false
  });
  console.log('[IMPORT QUIZ] Conexão estabelecida com sucesso!');

  console.log('[IMPORT QUIZ] 1. Desativando checagem de chaves estrangeiras...');
  await conn.query('SET FOREIGN_KEY_CHECKS = 0;');

  console.log('[IMPORT QUIZ] 2. Limpando tabelas existentes...');
  const existingTables = await conn.query('SHOW TABLES');
  for (const t of existingTables) {
    const tableName = Object.values(t)[0];
    await conn.query(`DROP TABLE IF EXISTS \`${tableName}\``);
  }
  console.log(`[IMPORT QUIZ] Limpeza concluída (${existingTables.length} tabelas removidas).`);

  console.log('[IMPORT QUIZ] 3. Criando estrutura DDL compatível com Azure MySQL...');
  // Tabelas com PK inline para garantir 100% de compatibilidade com Azure MySQL (GIPK)
  const ddl = `
CREATE TABLE \`users\` (
  \`id\` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  \`microsoft_oid\` varchar(64) NOT NULL,
  \`name\` varchar(255) NOT NULL,
  \`email\` varchar(255) NOT NULL,
  \`role\` enum('participant','admin') NOT NULL DEFAULT 'participant',
  \`last_login_at\` datetime DEFAULT NULL,
  \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY \`microsoft_oid\` (\`microsoft_oid\`),
  UNIQUE KEY \`email\` (\`email\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE \`quizzes\` (
  \`id\` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  \`title\` varchar(255) NOT NULL,
  \`slug\` varchar(255) NOT NULL,
  \`description\` text DEFAULT NULL,
  \`status\` enum('draft','published','closed') NOT NULL DEFAULT 'draft',
  \`time_limit_minutes\` int(10) UNSIGNED DEFAULT NULL,
  \`randomize_questions\` tinyint(1) NOT NULL DEFAULT 0,
  \`show_results_immediately\` tinyint(1) NOT NULL DEFAULT 1,
  \`created_by\` bigint(20) UNSIGNED DEFAULT NULL,
  \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY \`fk_quiz_creator\` (\`created_by\`),
  CONSTRAINT \`fk_quiz_creator\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\` (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE \`questions\` (
  \`id\` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  \`quiz_id\` bigint(20) UNSIGNED NOT NULL,
  \`question_text\` text NOT NULL,
  \`question_type\` enum('single_choice','multiple_choice','text') NOT NULL DEFAULT 'single_choice',
  \`points\` decimal(10,2) NOT NULL DEFAULT 1.00,
  \`order_position\` int(10) UNSIGNED NOT NULL DEFAULT 1,
  KEY \`fk_question_quiz\` (\`quiz_id\`),
  CONSTRAINT \`fk_question_quiz\` FOREIGN KEY (\`quiz_id\`) REFERENCES \`quizzes\` (\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE \`question_options\` (
  \`id\` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  \`question_id\` bigint(20) UNSIGNED NOT NULL,
  \`option_text\` text NOT NULL,
  \`is_correct\` tinyint(1) NOT NULL DEFAULT 0,
  \`order_position\` int(10) UNSIGNED NOT NULL DEFAULT 1,
  KEY \`fk_option_question\` (\`question_id\`),
  CONSTRAINT \`fk_option_question\` FOREIGN KEY (\`question_id\`) REFERENCES \`questions\` (\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE \`attempts\` (
  \`id\` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  \`quiz_id\` bigint(20) UNSIGNED NOT NULL,
  \`user_id\` bigint(20) UNSIGNED NOT NULL,
  \`started_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`submitted_at\` datetime DEFAULT NULL,
  \`total_score\` decimal(10,2) NOT NULL DEFAULT 0.00,
  \`max_possible_score\` decimal(10,2) NOT NULL DEFAULT 0.00,
  \`percentage\` decimal(5,2) NOT NULL DEFAULT 0.00,
  \`passed\` tinyint(1) DEFAULT NULL,
  UNIQUE KEY \`uq_one_attempt\` (\`quiz_id\`,\`user_id\`),
  KEY \`fk_attempt_user\` (\`user_id\`),
  CONSTRAINT \`fk_attempt_quiz\` FOREIGN KEY (\`quiz_id\`) REFERENCES \`quizzes\` (\`id\`) ON DELETE CASCADE,
  CONSTRAINT \`fk_attempt_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE \`answers\` (
  \`id\` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  \`attempt_id\` bigint(20) UNSIGNED NOT NULL,
  \`question_id\` bigint(20) UNSIGNED NOT NULL,
  \`selected_option_id\` bigint(20) UNSIGNED DEFAULT NULL,
  \`text_answer\` text DEFAULT NULL,
  \`is_correct\` tinyint(1) DEFAULT NULL,
  \`points_awarded\` decimal(10,2) NOT NULL DEFAULT 0.00,
  UNIQUE KEY \`uq_attempt_question\` (\`attempt_id\`,\`question_id\`),
  KEY \`fk_answer_question\` (\`question_id\`),
  KEY \`fk_answer_option\` (\`selected_option_id\`),
  CONSTRAINT \`fk_answer_attempt\` FOREIGN KEY (\`attempt_id\`) REFERENCES \`attempts\` (\`id\`) ON DELETE CASCADE,
  CONSTRAINT \`fk_answer_option\` FOREIGN KEY (\`selected_option_id\`) REFERENCES \`question_options\` (\`id\`) ON DELETE SET NULL,
  CONSTRAINT \`fk_answer_question\` FOREIGN KEY (\`question_id\`) REFERENCES \`questions\` (\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  // Executar declarações DDL individualmente
  const statements = ddl.split(';').map(s => s.trim()).filter(Boolean);
  for (const s of statements) {
    await conn.query(s);
  }
  console.log('[IMPORT QUIZ] Estrutura DDL criada com sucesso!');

  console.log('[IMPORT QUIZ] 4. Extraindo e executando dados do backup (qmax_quiz.sql)...');
  const backupSql = fs.readFileSync(path.join(__dirname, '../qmax_quiz.sql'), 'utf8');

  // Separar instruções INSERT
  const insertStatements = [];
  let current = '';
  const lines = backupSql.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('--') || trimmed.startsWith('/*')) continue;
    if (trimmed.startsWith('INSERT INTO') || current.length > 0) {
      current += line + '\n';
      if (trimmed.endsWith(';')) {
        const insertStmt = current.trim().replace(/^INSERT INTO/i, 'REPLACE INTO');
        insertStatements.push(insertStmt);
        current = '';
      }
    }
  }

  console.log(`[IMPORT QUIZ] Executando ${insertStatements.length} blocos de inserção de dados...`);
  for (let i = 0; i < insertStatements.length; i++) {
    await conn.query(insertStatements[i]);
  }
  console.log('[IMPORT QUIZ] Dados inseridos com sucesso!');

  console.log('[IMPORT QUIZ] 5. Sincronizando sequências de AUTO_INCREMENT...');
  for (const match of backupSql.matchAll(/ALTER TABLE `([^`]+)`\s+MODIFY `([^`]+)` [^;]+AUTO_INCREMENT=(\d+);/g)) {
    const table = match[1];
    const autoInc = match[3];
    try {
      await conn.query(`ALTER TABLE \`${table}\` AUTO_INCREMENT = ${autoInc};`);
    } catch (e) {
      // Ignorar se já for maior
    }
  }

  console.log('[IMPORT QUIZ] 6. Reativando checagem de chaves estrangeiras...');
  await conn.query('SET FOREIGN_KEY_CHECKS = 1;');

  // Relatório Final
  const tables = await conn.query('SHOW TABLES');
  console.log('\n======================================================');
  console.log(`[IMPORT QUIZ] SUCESSO: ${tables.length} tabelas no banco de dados`);
  console.log('======================================================');
  let totalRows = 0;
  for (const t of tables) {
    const name = Object.values(t)[0];
    const [count] = await conn.query(`SELECT COUNT(*) AS total FROM \`${name}\``);
    console.log(` - ${name.padEnd(25)}: ${count.total} registros`);
    totalRows += Number(count.total);
  }
  console.log('======================================================');
  console.log(`[IMPORT QUIZ] TOTAL DE REGISTROS NO BANCO: ${totalRows}`);
  console.log('======================================================\n');

  await conn.end();
}

runImport().catch(err => {
  console.error('[IMPORT QUIZ] ERRO:', err.message);
  process.exit(1);
});


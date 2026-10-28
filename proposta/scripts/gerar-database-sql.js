/**
 * Gera database.sql: estrutura completa do banco + catálogo de preços + histórico de migrations.
 * Somente leitura (sessão READ ONLY). Não copia dados de clientes, usuários nem configuracoes_sistema.
 *
 * Uso: node scripts/gerar-database-sql.js            (lê o banco do .env)
 *      NODE_ENV=test node scripts/gerar-database-sql.js (lê o banco do .env.test)
 *
 * Banco novo: crie o schema vazio, rode `mysql <banco> < database.sql` e depois `npx knex migrate:latest`.
 * O arquivo é idempotente (IF NOT EXISTS / INSERT IGNORE): rodar num banco existente não altera nada.
 */
const path = require("path");
const fs = require("fs");
const envTest = path.resolve(__dirname, "../.env.test");
require("dotenv").config({
  path: process.env.NODE_ENV === "test" && fs.existsSync(envTest) ? envTest : path.resolve(__dirname, "../.env"),
});
const mysql = require("mysql2/promise");

// Tabelas de configuração/catálogo sem dados pessoais
const TABELAS_COM_DADOS = [
  "regras_precificacao", "regras_calculo", "servico_regra_calculo",
  "servicos_proposta", "topicos_pdf", "servico_topico_pdf",
  "tech_planos", "tech_plano_servicos", "planos_tech",
  "crm_funis", "crm_etapas",
  "knex_migrations", "knex_migrations_lock",
];

(async () => {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || process.env.DB_PASS || "",
    database: process.env.DB_NAME,
    dateStrings: true,
    jsonStrings: true,
  });
  await c.query("SET SESSION TRANSACTION READ ONLY");

  const [tabelas] = await c.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
  const nomes = tabelas.map((t) => Object.values(t)[0]).sort();

  let sql = `-- Gerado por scripts/gerar-database-sql.js em ${new Date().toISOString().slice(0, 10)}. Não editar à mão.\n`;
  sql += "-- Banco novo: mysql <banco> < database.sql && npx knex migrate:latest\n";
  sql += "SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS = 0;\n\n";

  for (const t of nomes) {
    const [[r]] = await c.query("SHOW CREATE TABLE ??", [t]);
    const ddl = r["Create Table"]
      .replace(/^CREATE TABLE/, "CREATE TABLE IF NOT EXISTS")
      .replace(/ AUTO_INCREMENT=\d+/, "");
    sql += `${ddl};\n\n`;
  }

  for (const t of TABELAS_COM_DADOS.filter((t) => nomes.includes(t))) {
    const [linhas] = await c.query("SELECT * FROM ?? ORDER BY 1", [t]);
    for (const linha of linhas) sql += c.format("INSERT IGNORE INTO ?? SET ?;", [t, linha]) + "\n";
    sql += "\n";
  }

  sql += "SET FOREIGN_KEY_CHECKS = 1;\n";
  fs.writeFileSync(path.resolve(__dirname, "../database.sql"), sql);
  console.log(`database.sql gerado: ${nomes.length} tabelas.`);
  await c.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

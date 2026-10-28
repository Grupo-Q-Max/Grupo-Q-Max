const path = require("path");
const fs = require("fs");
const envTestPath = path.resolve(process.cwd(), ".env.test");
const useTestEnv = process.env.NODE_ENV === "test" && fs.existsSync(envTestPath);

require('dotenv').config({
  path: useTestEnv ? envTestPath : path.resolve(process.cwd(), '.env')
});

// Mesma conexão nos três ambientes; o .env carregado acima é que muda (NODE_ENV=test usa .env.test)
const config = {
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    // Mesma ordem do config/db.js: com só DB_PASSWORD definido o app conectava e a migration não
    password: process.env.DB_PASSWORD || process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306),
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined
  },
  // Mesmo fuso do app (config/db.js): migrations com NOW()/backfill gravam em horário de Brasília
  pool: {
    afterCreate: (conexao, feito) => conexao.query("SET time_zone = '-03:00'", (erro) => feito(erro, conexao))
  },
  migrations: {
    tableName: 'knex_migrations',
    directory: './migrations'
  }
};

// `test`: `NODE_ENV=test npx knex migrate:latest` agora acha o ambiente (antes exigia --env development)
module.exports = { development: config, production: config, test: config };

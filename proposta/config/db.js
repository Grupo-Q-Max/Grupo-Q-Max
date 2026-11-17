const path = require("path");
const fs = require("fs");
const envTestPath = path.resolve(process.cwd(), ".env.test");
const useTestEnv = process.env.NODE_ENV === "test" && fs.existsSync(envTestPath);

require("dotenv").config({
  path: useTestEnv ? envTestPath : (fs.existsSync(path.resolve(process.cwd(), ".env")) ? path.resolve(process.cwd(), ".env") : path.resolve(__dirname, "../.env"))
});
if (!process.env.DB_HOST && fs.existsSync(path.resolve(__dirname, "../.env"))) {
  require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
}

const mysql = require("mysql2/promise");

// Horário de Brasília fixo (sem horário de verão desde 2019). Hoje o servidor e o MariaDB já estão em -03,
// então nada muda; no Azure MySQL (UTC) NOW()/CURDATE() e as datas lidas continuam em horário de Brasília.
const FUSO_BANCO = "-03:00";

const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || process.env.DB_PASS || "",
  database: process.env.DB_NAME,

  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 10,
  idleTimeout: 60000,
  queueLimit: 0,

  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,

  connectTimeout: 10000,

  // Conversão Date <-> DATETIME no driver no mesmo fuso da sessão do banco
  timezone: FUSO_BANCO,

  // Azure MySQL exige TLS
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined,
});

// Cada conexão nova do pool grava e lê no fuso de Brasília (NOW(), CURDATE(), DATE_SUB...)
db.pool.on("connection", (conexao) => {
  conexao.query(`SET time_zone = '${FUSO_BANCO}'`);
});

db.getConnection()
  .then((connection) => {
    console.log("MySQL conectado com sucesso.");
    connection.release();
  })
  .catch((error) => {
    console.error("Erro ao conectar no MySQL:", error.message);
  });

async function executarQuery(sql, params = [], tentativas = 2) {
  for (let i = 0; i <= tentativas; i++) {
    try {
      const [rows] = await db.query(sql, params);
      return rows;
    } catch (error) {
      const erroConexao =
        error.code === "ECONNRESET" ||
        error.code === "PROTOCOL_CONNECTION_LOST" ||
        error.code === "ETIMEDOUT";

      console.warn("Erro MySQL:", error.code, "-", error.message);

      if (!erroConexao || i === tentativas) {
        throw error;
      }

      console.warn(
        `Tentando novamente consulta MySQL (${i + 1}/${tentativas})...`,
      );
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}

// Executa fn(conexao) numa transação; qualquer erro desfaz tudo
async function transacao(fn) {
  const conexao = await db.getConnection();
  try {
    await conexao.beginTransaction();
    const resultado = await fn(conexao);
    await conexao.commit();
    return resultado;
  } catch (error) {
    await conexao.rollback().catch(() => {});
    throw error;
  } finally {
    conexao.release();
  }
}

db.executarQuery = executarQuery;
db.transacao = transacao;

module.exports = db;


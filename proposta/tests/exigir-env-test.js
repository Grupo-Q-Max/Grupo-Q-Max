// Primeiro require dos scripts de teste: força NODE_ENV=test antes de config/db.
// Sem .env.test o db.js cairia no .env (produção) e estes scripts gravam/apagam dados.
const fs = require("fs");
const path = require("path");

process.env.NODE_ENV = "test";
const envTestPath = path.resolve(process.cwd(), ".env.test");
if (!fs.existsSync(envTestPath)) {
  console.error("Abortado: crie .env.test apontando para um banco de TESTE (veja .env.test.example).");
  process.exit(1);
}
require("dotenv").config({ path: envTestPath });

/**
 * Cria um usuário ou troca a senha de um existente (e reativa). Gera senha aleatória e mostra uma vez.
 *
 * Uso: node scripts/usuario.js <email> "<nome>" <Diretor|Comercial>            (banco do .env)
 *      NODE_ENV=test node scripts/usuario.js <email> "<nome>" <Diretor|Comercial> (banco do .env.test)
 *
 * Usuário existente: só troca a senha e reativa; nome e função ficam como estão.
 */
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const envTest = path.resolve(__dirname, "../.env.test");
require("dotenv").config({
  path: process.env.NODE_ENV === "test" && fs.existsSync(envTest) ? envTest : path.resolve(__dirname, "../.env"),
});
const bcrypt = require("bcrypt");
const db = require("../config/db");

(async () => {
  const [emailBruto, nome, role] = process.argv.slice(2);
  const email = String(emailBruto || "").trim().toLowerCase();
  if (!email.includes("@") || !nome || !["Diretor", "Comercial"].includes(role)) {
    console.error('Uso: node scripts/usuario.js <email> "<nome>" <Diretor|Comercial>');
    process.exit(1);
  }

  const senha = crypto.randomBytes(9).toString("base64url");
  const senhaHash = await bcrypt.hash(senha, 10);
  const [existente] = await db.executarQuery("SELECT id FROM usuarios WHERE email = ?", [email]);

  if (existente) {
    await db.executarQuery("UPDATE usuarios SET senha_hash = ?, ativo = 1 WHERE id = ?", [senhaHash, existente.id]);
    console.log(`Senha trocada para ${email} (banco ${process.env.DB_NAME}).`);
  } else {
    await db.executarQuery(
      "INSERT INTO usuarios (nome, email, senha_hash, role) VALUES (?, ?, ?, ?)",
      [nome.trim(), email, senhaHash, role],
    );
    console.log(`Usuário ${role} criado: ${email} (banco ${process.env.DB_NAME}).`);
  }
  console.log(`Senha: ${senha}`);
  process.exit(0);
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

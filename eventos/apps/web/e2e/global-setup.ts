import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { E2E_DATABASE_URL, E2E_OPERATOR, e2eEnv } from "./env";

// Prepara o banco do e2e: migrations, seed e operador da roleta.
export default function globalSetup() {
  const dbName = E2E_DATABASE_URL ? new URL(E2E_DATABASE_URL).pathname.slice(1) : "";
  // O seed apaga dados: só roda em banco com "e2e" ou "ci" no nome.
  if (!/e2e|ci/i.test(dbName)) {
    throw new Error(`E2E_DATABASE_URL precisa apontar para um banco descartável (nome com "e2e" ou "ci"); recebido "${dbName}".`);
  }

  const api = path.resolve(__dirname, "../../api");
  const env = {
    ...process.env,
    ...e2eEnv,
    FINORA_ADMIN_LOGIN_NAME: E2E_OPERATOR.username,
    FINORA_ADMIN_PASSWORD: E2E_OPERATOR.password,
  };
  const run = (cmd: string) => execSync(cmd, { cwd: api, env, stdio: "inherit" });

  const adminScript = path.resolve(api, "dist/scripts/ensure-admin-user.js");
  if (!fs.existsSync(adminScript)) {
    run("npm run build");
  }

  run("npx prisma migrate deploy");
  run(`npx prisma db execute --file "${path.resolve(__dirname, "seed.sql")}"`);
  run("node dist/scripts/ensure-admin-user.js");
}

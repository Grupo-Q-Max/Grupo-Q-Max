import { defineConfig, devices } from "@playwright/test";
import { e2eEnv } from "./e2e/env";

// Smoke do fluxo do participante. Pré-requisito: `npm run build` e
// E2E_DATABASE_URL apontando para um MariaDB descartável.
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:3001/finora-experience/",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node dist/src/main.js",
      cwd: "../api",
      url: "http://127.0.0.1:3334/api/v1/health",
      env: e2eEnv,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: "npx next start -p 3001",
      url: "http://localhost:3001/finora-experience/clinicorp/cadastro",
      env: e2eEnv,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});

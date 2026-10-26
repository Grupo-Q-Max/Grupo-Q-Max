// Valores só de teste: o e2e roda contra banco descartável e sem Z-API.
export const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? "";

export const E2E_OPERATOR = { username: "e2e-operador", password: "e2e-senha-teste-123" };

export const e2eEnv = {
  DATABASE_URL: E2E_DATABASE_URL,
  PORT: "3334",
  NODE_ENV: "production",
  CPF_HASH_SECRET: "e2e-cpf-hash-secret",
  // 32 bytes em base64 (exigido por cpf-security.ts).
  DATA_ENCRYPTION_KEY: "ZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWU=",
  FINORA_ADMIN_PASSWORD_SALT: "e2e-salt",
  FINORA_ADMIN_API_KEY: "e2e-admin-api-key",
  FINORA_ADMIN_SESSION_TOKEN: "e2e-admin-session-secret",
  FINORA_INTERNAL_API_URL: "http://127.0.0.1:3334/api/v1",
  NEXT_PUBLIC_API_URL: "",
  FRONTEND_URL: "http://localhost:3001",
  // Vazias de propósito: nenhuma mensagem real sai do e2e.
  ZAPI_INSTANCE_ID: "",
  ZAPI_TOKEN: "",
  ZAPI_CLIENT_TOKEN: "",
} as const;

/**
 * Script para verificar o status de Rate Limit da D4Sign
 * Uso: node scripts/check-ratelimit.js
 */
require("dotenv").config();
const https = require("https");

const tokenApi = process.env.D4SIGN_API_TOKEN;
const cryptKey = process.env.D4SIGN_API_SECRET;
const apiUrl = process.env.D4SIGN_API_URL || "https://sandbox.d4sign.com.br/api/v1";

if (!tokenApi || !cryptKey) {
  console.error("Erro: D4SIGN_API_TOKEN ou D4SIGN_API_SECRET não configurados no arquivo .env");
  process.exit(1);
}

// O endpoint /templates é leve e serve para verificar os headers sem consumir cotas
const urlObj = new URL(`${apiUrl}/templates`);
urlObj.searchParams.append("tokenAPI", tokenApi);
urlObj.searchParams.append("cryptKey", cryptKey);

const options = {
  method: "GET",
  headers: {
    "Accept": "application/json"
  }
};

console.log("=== VERIFICANDO RATE LIMIT D4SIGN ===");
console.log(`Conectando a: ${urlObj.origin}${urlObj.pathname}`);

const req = https.request(urlObj.toString(), options, (res) => {
  console.log(`Status da resposta: ${res.statusCode} ${res.statusMessage}`);
  
  console.log("\n--- Cabeçalhos de Rate Limit ---");
  const headers = res.headers;
  
  console.log(`x-ratelimit-limit:      ${headers['x-ratelimit-limit'] || 'Não informado (Sem limite curto)'}`);
  console.log(`x-ratelimit-remaining:  ${headers['x-ratelimit-remaining'] || 'Não informado'}`);
  console.log(`x-ratelimit-reset:      ${headers['x-ratelimit-reset'] || 'Não informado'}`);
  console.log(`retry-after:            ${headers['retry-after'] || 'Nenhum bloqueio ativo (Livre)'}`);
  
  let body = "";
  res.on("data", chunk => { body += chunk; });
  res.on("end", () => {
    try {
      const data = JSON.parse(body);
      if (data.error) {
        console.log(`\n❌ Status de erro da D4Sign: ${data.error}`);
      } else {
        console.log("\n✅ Conexão bem-sucedida! Chave API está ativa e operando normalmente.");
      }
    } catch {
      console.log(`\nResumo da resposta: ${body.substring(0, 300)}`);
    }
    process.exit(0);
  });
});

req.on("error", (err) => {
  console.error("❌ Falha na conexão de rede:", err.message);
  process.exit(1);
});

req.end();

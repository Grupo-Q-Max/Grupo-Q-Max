 /**
 * Script utilitário para listar os cofres disponíveis na D4Sign.
 * Uso: node scripts/listar-cofres.js
 */
require("dotenv").config();

const API_TOKEN = process.env.D4SIGN_API_TOKEN;
const API_SECRET = process.env.D4SIGN_API_SECRET;
const API_URL = process.env.D4SIGN_API_URL || "https://sandbox.d4sign.com.br/api/v1";

async function listarCofres() {
  if (!API_TOKEN || API_TOKEN.startsWith("seu_")) {
    console.error("❌ Preencha D4SIGN_API_TOKEN no .env antes de rodar este script.");
    process.exit(1);
  }
  if (!API_SECRET || API_SECRET.startsWith("seu_")) {
    console.error("❌ Preencha D4SIGN_API_SECRET (cryptKey) no .env antes de rodar este script.");
    process.exit(1);
  }

  const url = `${API_URL}/safes?tokenAPI=${API_TOKEN}&cryptKey=${API_SECRET}`;
  
  console.log("Consultando cofres na D4Sign...\n");
  console.log(`URL: ${API_URL}/safes\n`);

  const res = await fetch(url, {
    method: "GET",
    headers: { "Accept": "application/json" }
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("❌ Erro ao consultar cofres:", JSON.stringify(data, null, 2));
    process.exit(1);
  }

  if (!Array.isArray(data) || data.length === 0) {
    console.log("⚠ Nenhum cofre encontrado na sua conta.");
    console.log("Crie um cofre no painel da D4Sign primeiro.");
    process.exit(0);
  }

  console.log(`✅ ${data.length} cofre(s) encontrado(s):\n`);
  console.log("─".repeat(80));

  data.forEach((cofre, i) => {
    const uuid = cofre.uuid || cofre.uuid_safe || cofre["uuid-safe"] || cofre.uuidSafe;
    const nome = cofre.name || cofre.nome || cofre.name_safe || "Sem nome";
    console.log(`  #${i + 1}`);
    console.log(`  Nome:  ${nome}`);
    console.log(`  UUID:  ${uuid || "NÃO ENCONTRADO"}`);
    if (!uuid) {
      console.log(`  [DEBUG] Campos disponíveis: ${JSON.stringify(cofre)}`);
    }
    console.log("─".repeat(80));
  });

  // Pegar o primeiro UUID válido
  const primeiroUuid = data.map(c => c.uuid || c.uuid_safe || c["uuid-safe"] || c.uuidSafe).find(Boolean);
  console.log("\nExemplo para o .env:");
  console.log(`D4SIGN_UUID_COFRE=${primeiroUuid || "veja os campos DEBUG acima"}`);
}

listarCofres().catch(err => {
  console.error("Erro:", err.message);
  process.exit(1);
});

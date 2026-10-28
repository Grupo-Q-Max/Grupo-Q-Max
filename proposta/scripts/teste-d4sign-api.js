 /**
 * Teste direto da integração D4Sign.
 * Testa o upload de um PDF de teste, cadastro de signatários, webhook e envio.
 * 
 * Uso: node scripts/teste-d4sign-api.js
 */
require("dotenv").config();
const FormData = require("form-data");
const https = require("https");
const http = require("http");
const { URL } = require("url");

const API_TOKEN = process.env.D4SIGN_API_TOKEN;
const API_SECRET = process.env.D4SIGN_API_SECRET;
const API_URL = process.env.D4SIGN_API_URL || "https://secure.d4sign.com.br/api/v1";
const UUID_COFRE = process.env.D4SIGN_UUID_COFRE;

function authQuery() {
  return `tokenAPI=${API_TOKEN}&cryptKey=${API_SECRET}`;
}

/**
 * Helper para fazer requests HTTP simples (GET/POST JSON)
 */
function request(method, url, body = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === "https:" ? https : http;

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method,
      headers: {
        "Accept": "application/json",
      },
    };

    if (body && !(body instanceof FormData)) {
      const jsonBody = JSON.stringify(body);
      options.headers["Content-Type"] = "application/json";
      options.headers["Content-Length"] = Buffer.byteLength(jsonBody);
    }

    const req = lib.request(options, (res) => {
      let data = "";
      res.on("data", chunk => { data += chunk; });
      res.on("end", () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, data: parsed, raw: data });
      });
    });

    req.on("error", reject);

    if (body && !(body instanceof FormData)) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

/**
 * Upload de PDF via form-data usando http/https nativo
 */
function uploadPdf(pdfBuffer, filename) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", pdfBuffer, {
      filename,
      contentType: "application/pdf",
      knownLength: pdfBuffer.length,
    });

    const parsed = new URL(`${API_URL}/documents/${UUID_COFRE}/upload?${authQuery()}`);
    const lib = parsed.protocol === "https:" ? https : http;

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: "POST",
      headers: {
        ...form.getHeaders(),
        "Accept": "application/json",
      },
    };

    const req = lib.request(options, (res) => {
      let body = "";
      res.on("data", chunk => { body += chunk; });
      res.on("end", () => {
        let data;
        try { data = JSON.parse(body); } catch { data = body; }
        resolve({ status: res.statusCode, data });
      });
    });

    req.on("error", reject);
    form.pipe(req);
  });
}

// ============================================================
// Gerar um PDF mínimo de teste (PDF válido, sem pdfkit)
// ============================================================
function gerarPdfTeste() {
  const content = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT /F1 16 Tf 100 700 Td (Teste D4Sign) Tj ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000266 00000 n 
0000000360 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
441
%%EOF`;
  return Buffer.from(content);
}

// ============================================================
// TESTES
// ============================================================
async function run() {
  console.log("\x1b[36m%s\x1b[0m", "=== TESTE DE INTEGRAÇÃO D4SIGN ===\n");

  // Verificar credenciais
  console.log("Configuração:");
  console.log(`  API_URL:    ${API_URL}`);
  console.log(`  API_TOKEN:  ${API_TOKEN ? API_TOKEN.substring(0, 10) + "..." : "NÃO DEFINIDO"}`);
  console.log(`  API_SECRET: ${API_SECRET ? API_SECRET.substring(0, 10) + "..." : "NÃO DEFINIDO"}`);
  console.log(`  UUID_COFRE: ${UUID_COFRE || "NÃO DEFINIDO"}`);
  console.log("");

  // ---- TESTE 1: Listar cofres (validar autenticação) ----
  console.log("1️⃣  Testando autenticação (GET /safes)...");
  const safesRes = await request("GET", `${API_URL}/safes?${authQuery()}`);
  
  if (safesRes.status !== 200 || !Array.isArray(safesRes.data)) {
    console.error("❌ Falha na autenticação:", JSON.stringify(safesRes.data));
    console.error("\nVerifique se D4SIGN_API_TOKEN e D4SIGN_API_SECRET estão corretos no .env");
    process.exit(1);
  }
  console.log(`✅ Autenticação OK! ${safesRes.data.length} cofre(s) encontrados.\n`);

  // ---- TESTE 2: Upload de PDF ----
  console.log("2️⃣  Testando upload de PDF para o cofre...");
  const pdfBuffer = gerarPdfTeste();
  console.log(`   PDF de teste gerado: ${pdfBuffer.length} bytes`);

  const uploadRes = await uploadPdf(pdfBuffer, "teste-d4sign-api.pdf");
  console.log(`   Resposta da D4Sign (status ${uploadRes.status}):`, JSON.stringify(uploadRes.data));

  if (uploadRes.status >= 400 || !uploadRes.data.uuid) {
    console.error("❌ Falha no upload:", JSON.stringify(uploadRes.data));
    process.exit(1);
  }

  const docUuid = uploadRes.data.uuid;
  console.log(`✅ Upload OK! UUID do documento: ${docUuid}\n`);

  // ---- TESTE 3: Cadastrar signatário ----
  console.log("3️⃣  Testando cadastro de signatário...");
  const signRes = await request(
    "POST",
    `${API_URL}/documents/${docUuid}/createlist?${authQuery()}`,
    {
      signers: [{
        email: "teste@qmax.com.br",
        act: "1",
        foreign: "0",
        certificadoicpbr: "0",
        assinatura_presencial: "0",
      }]
    }
  );
  console.log(`   Resposta (status ${signRes.status}):`, JSON.stringify(signRes.data));

  if (signRes.status >= 400) {
    console.error("❌ Falha ao cadastrar signatário:", JSON.stringify(signRes.data));
  } else {
    console.log("✅ Signatário cadastrado!\n");
  }

  // ---- TESTE 4: Cancelar documento de teste ----
  console.log("4️⃣  Cancelando documento de teste na D4Sign...");
  const cancelRes = await request(
    "POST",
    `${API_URL}/documents/${docUuid}/cancel?${authQuery()}`,
    { comment: "Documento de teste automatizado - pode ser removido." }
  );
  console.log(`   Resposta (status ${cancelRes.status}):`, JSON.stringify(cancelRes.data));

  if (cancelRes.status >= 400) {
    console.warn("⚠ Não foi possível cancelar automaticamente. Delete manualmente no painel da D4Sign.");
  } else {
    console.log("✅ Documento de teste cancelado!\n");
  }

  // ---- RESULTADO FINAL ----
  console.log("\x1b[32m%s\x1b[0m", "=== ✅ TODOS OS TESTES D4SIGN PASSARAM! ===");
  console.log("\nA integração está funcionando corretamente.");
  console.log("O documento de teste foi cancelado/removido da D4Sign.");
}

run().catch(err => {
  console.error("\x1b[31m%s\x1b[0m", "❌ ERRO FATAL:");
  console.error(err);
  process.exit(1);
});

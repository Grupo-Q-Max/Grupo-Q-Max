require("./exigir-env-test");
const db = require("../config/db");
const fetch = typeof globalThis.fetch !== "undefined" ? globalThis.fetch : require("node-fetch");
// dotenv já carregado por exigir-env-test (.env.test)

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;

async function testWebhook() {
  console.log("\x1b[36m%s\x1b[0m", "=== INICIANDO TESTE DO WEBHOOK D4SIGN ===");

  let testProposalId = null;
  const dummyUuid = `test_uuid_${Date.now()}`;
  const tokenAcesso = `test_token_${Date.now()}`;

  try {
    // 1. Criar proposta temporária no banco de dados
    console.log("Inserindo proposta temporária para teste de webhook...");
    const [insertRes] = await db.execute(
      `
      INSERT INTO propostas (
        token_acesso, numero_proposta, data_proposta, nome_clinica, razao_social, 
        cnpj, nome_socio, cpf_socio, email, telefone, endereco_clinica, 
        cadeiras, funcionarios, socios, faturamento, regime_fiscal, 
        regime_hibrido, distancia_km, metragem, valor_total, status, ip_assinatura
      ) VALUES (?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        tokenAcesso,
        "999999", // Número fictício
        "Clínica Webhook D4Sign",
        "Razão Webhook D4Sign",
        "00.000.000/0001-00",
        "Sócio Webhook",
        "000.000.000-00",
        "webhook_test@qmax.com",
        "11999999999",
        "Endereço Webhook",
        3, 2, 1, 30000, "Simples Nacional",
        "Nao", 0, 80, 1500.00,
        "Pendente", // Deve iniciar como Pendente
        dummyUuid // UUID do D4Sign
      ]
    );

    testProposalId = insertRes.insertId;
    console.log(`✔ Proposta temporária ID=${testProposalId} inserida com ip_assinatura=${dummyUuid}.`);

    // 2. Chamar o webhook local simulando a D4Sign
    // A D4Sign envia como form-data (urlencoded), com type_post ao invés de type
    console.log("Enviando POST de simulação de assinatura para o Webhook...");
    const secret = process.env.D4SIGN_API_SECRET;
    const webhookUrl = secret ? `${BASE_URL}/api/d4sign/webhook?secret=${encodeURIComponent(secret)}` : `${BASE_URL}/api/d4sign/webhook`;
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        uuid: dummyUuid,
        type_post: "1",
        message: "Finished document"
      }).toString()
    });

    if (!response.ok) {
      throw new Error(`Erro na resposta do webhook: ${response.status} - ${await response.text()}`);
    }

    const text = await response.text();
    console.log(`✔ Resposta do webhook recebida: "${text}"`);

    // 3. Verificar se o status da proposta foi atualizado para "Aprovada"
    console.log("Verificando atualização no banco de dados...");
    const [rows] = await db.execute(
      "SELECT status, data_decisao FROM propostas WHERE id = ?",
      [testProposalId]
    );

    if (rows.length === 0) {
      throw new Error("Proposta temporária desapareceu do banco de dados!");
    }

    const proposta = rows[0];
    console.log(`Status atual da proposta: '${proposta.status}', data_decisao: ${proposta.data_decisao}`);

    if (proposta.status !== "Aprovada") {
      throw new Error(`Falha: O status esperado era 'Aprovada', mas é '${proposta.status}'`);
    }

    if (!proposta.data_decisao) {
      throw new Error("Falha: data_decisao não foi preenchida!");
    }

    console.log("\x1b[32m%s\x1b[0m", "=== ✅ TESTE DO WEBHOOK D4SIGN PASSOU COM SUCESSO! ===");

  } catch (error) {
    console.error("\x1b[31m%s\x1b[0m", "❌ FALHA NO TESTE DO WEBHOOK:");
    console.error(error.message || error);
    process.exitCode = 1;
  } finally {
    // 4. Limpar proposta de teste
    if (testProposalId) {
      console.log("Limpando proposta temporária...");
      await db.execute("DELETE FROM propostas WHERE id = ?", [testProposalId]);
      console.log("✔ Proposta temporária removida.");
    }

    console.log("Encerrando conexão com o Banco de Dados...");
    await db.end();
    console.log("Fim da execução.");
  }
}

testWebhook();

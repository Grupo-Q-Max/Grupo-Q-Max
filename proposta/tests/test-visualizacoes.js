require("./exigir-env-test");
const db = require("../config/db");
const bcrypt = require("bcrypt");
const fetch = typeof globalThis.fetch !== "undefined" ? globalThis.fetch : require("node-fetch");
// dotenv já carregado por exigir-env-test (.env.test)

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;

async function testVisualizacoes() {
  console.log("\x1b[36m%s\x1b[0m", "=== INICIANDO TESTE DE RASTREAMENTO DE VISUALIZAÇÕES ===");

  let testProposalId = null;
  let testUserId = null;
  const tokenAcesso = `test_views_${Date.now()}`;

  try {
    // 1. Criar um usuário administrador para obter token de autenticação
    console.log("Criando usuário administrador de testes...");
    const passwordHash = await bcrypt.hash("testpass123", 10);
    const [userRes] = await db.execute(
      "INSERT INTO usuarios (nome, email, senha_hash, role, ativo) VALUES (?, ?, ?, ?, 1)",
      ["Test Admin Views", "test_admin_views@qmax.com", passwordHash, "Diretor"]
    );
    testUserId = userRes.insertId;

    // 2. Fazer login do administrador para obter o Token JWT
    console.log("Autenticando administrador...");
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test_admin_views@qmax.com", senha: "testpass123" })
    });
    if (!loginRes.ok) throw new Error("Falha no login do admin");
    const { token } = await loginRes.json();
    console.log("✔ Token JWT obtido com sucesso.");

    // 3. Criar proposta temporária no banco de dados
    console.log("Inserindo proposta temporária...");
    const [insertRes] = await db.execute(
      `
      INSERT INTO propostas (
        token_acesso, numero_proposta, data_proposta, nome_clinica, razao_social, 
        cnpj, nome_socio, cpf_socio, email, telefone, endereco_clinica, 
        cadeiras, funcionarios, socios, faturamento, regime_fiscal, 
        regime_hibrido, distancia_km, metragem, valor_total, status
      ) VALUES (?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pendente')
      `,
      [
        tokenAcesso, "888888", "Clínica Views Test", "Razão Views Test", "00.000.000/0001-00",
        "Sócio Views", "000.000.000-00", "views_test@qmax.com", "11999999999", "Endereço Views",
        3, 2, 1, 30000, "Simples Nacional", "Nao", 0, 80, 1500.00
      ]
    );
    testProposalId = insertRes.insertId;
    console.log(`✔ Proposta temporária ID=${testProposalId} criada.`);

    // 4. Simular que o cliente abriu a proposta pública (chamando a rota pública GET)
    console.log("Simulando visualização da proposta pelo cliente (GET público)...");
    const viewRes = await fetch(`${BASE_URL}/api/propostas/${tokenAcesso}/publica`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1"
      }
    });
    if (!viewRes.ok) throw new Error("Erro ao acessar proposta pública");
    console.log("✔ Proposta pública acessada com sucesso!");

    // 5. Chamar o novo endpoint GET /api/propostas/:id/visualizacoes para obter o histórico detalhado
    console.log(`Buscando histórico detalhado para proposta ID=${testProposalId}...`);
    const historyRes = await fetch(`${BASE_URL}/api/propostas/${testProposalId}/visualizacoes`, {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    if (!historyRes.ok) {
      throw new Error(`Erro na rota de visualizações: ${historyRes.status} - ${await historyRes.text()}`);
    }

    const visualizacoes = await historyRes.json();
    console.log(`✔ Resposta da API recebida. Total de registros: ${visualizacoes.length}`);

    if (visualizacoes.length === 0) {
      throw new Error("Falha: Nenhuma visualização foi registrada na tabela proposta_visualizacoes!");
    }

    const v = visualizacoes[0];
    console.log(`Visualização registrada - IP: ${v.ip}, User-Agent: ${v.user_agent.substring(0, 40)}...`);

    if (!v.user_agent.includes("iPhone") || !v.user_agent.includes("Safari")) {
      throw new Error(`Falha: O User-Agent esperado devia conter iPhone/Safari, mas é: ${v.user_agent}`);
    }

    console.log("\x1b[32m%s\x1b[0m", "=== ✅ TESTE DE RASTREAMENTO DE VISUALIZAÇÕES PASSOU COM SUCESSO! ===");

  } catch (error) {
    console.error("\x1b[31m%s\x1b[0m", "❌ FALHA NO TESTE DE VISUALIZAÇÕES:");
    console.error(error.message || error);
    process.exitCode = 1;
  } finally {
    // Limpeza
    console.log("Limpando banco de dados...");
    await db.execute("SET FOREIGN_KEY_CHECKS = 0");
    if (testProposalId) {
      await db.execute("DELETE FROM proposta_visualizacoes WHERE proposta_id = ?", [testProposalId]);
      await db.execute("DELETE FROM propostas WHERE id = ?", [testProposalId]);
      console.log("✔ Proposta de teste e logs apagados.");
    }
    if (testUserId) {
      await db.execute("DELETE FROM usuarios WHERE id = ?", [testUserId]);
      console.log("✔ Usuário administrador de testes removido.");
    }
    await db.execute("SET FOREIGN_KEY_CHECKS = 1");

    console.log("Encerrando conexão com o Banco de Dados...");
    await db.end();
    console.log("Fim da execução.");
  }
}

testVisualizacoes();

require("./exigir-env-test");
const axios = require("axios");
const db = require("../config/db");
const BASE_URL = "http://localhost:3005";

async function testLegendaryFeatures() {
  console.log("==========================================================================");
  console.log("🌟 TESTANDO PACOTE LENDÁRIO DE RECURSOS & ESTUDO TRIBUTÁRIO EM PDF");
  console.log("==========================================================================");

  let propostaId = null;
  let tokenAcesso = null;

  try {
    // 1. Criar proposta de teste para validar o Estudo Tributário
    tokenAcesso = `legendary_${Date.now()}`;
    const numProp = `88${String(Date.now()).slice(-6)}`;

    console.log("📝 [Teste 1/2] Criando proposta de teste no banco de dados...");
    const [propRes] = await db.execute(`
      INSERT INTO propostas (
        numero_proposta, token_acesso, nome_clinica, nome_socio, email, telefone,
        valor_total, status, empresa_proposta, tipo_proposta, data_proposta, cadeiras, faturamento, criado_em
      ) VALUES (?, ?, 'Clínica Odonto Legend', 'Dra. Camila Silveira', 'camila@odontolegend.com.br', '11977776666', 2200.00, 'Pendente', 'finora', 'finora', CURDATE(), 3, 90000.00, NOW())
    `, [numProp, tokenAcesso]);

    propostaId = propRes.insertId;
    console.log(`✔ Proposta de teste criada com ID=${propostaId}, Token=${tokenAcesso}`);

    // 2. Testar download do Estudo Tributário em PDF
    console.log("\n📑 [Teste 2/2] Testando geração do Estudo Tributário Comparativo em PDF...");
    const pdfRes = await axios.get(`${BASE_URL}/api/propostas/${tokenAcesso}/estudo-tributario-pdf`, {
      responseType: "arraybuffer"
    });

    if (pdfRes.status !== 200 || !pdfRes.headers["content-type"].includes("application/pdf")) {
      throw new Error("Falha ao gerar o PDF do estudo tributário.");
    }

    const pdfSize = pdfRes.data.length;
    if (pdfSize < 1000) {
      throw new Error(`Tamanho de PDF suspeito (${pdfSize} bytes).`);
    }

    console.log(`✔ Estudo Tributário em PDF gerado com sucesso!`);
    console.log(`   - Status HTTP: ${pdfRes.status}`);
    console.log(`   - Content-Type: ${pdfRes.headers["content-type"]}`);
    console.log(`   - Tamanho do PDF: ${(pdfSize / 1024).toFixed(2)} KB`);

    console.log("\n==========================================================================");
    console.log("🎉 TODOS OS RECURSOS LENDÁRIOS FORAM VALIDADOS COM SUCESSO!");
    console.log("==========================================================================");
  } catch (error) {
    console.error("❌ ERRO NO TESTE DE RECURSOS LENDÁRIOS:", error.response?.data || error.message);
    throw error;
  } finally {
    if (propostaId) {
      await db.execute("DELETE FROM proposta_observacoes WHERE proposta_id = ?", [propostaId]).catch(() => {});
      await db.execute("DELETE FROM propostas WHERE id = ?", [propostaId]).catch(() => {});
    }
    console.log("🧹 Limpeza de teste concluída!");
    process.exit(0);
  }
}

testLegendaryFeatures();

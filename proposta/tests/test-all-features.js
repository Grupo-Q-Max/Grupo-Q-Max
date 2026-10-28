require("./exigir-env-test");
const axios = require("axios");
const db = require("../config/db");
const bcrypt = require("bcrypt");
const BASE_URL = "http://localhost:3005";

async function testAllFeatures() {
  console.log("=== 🚀 INICIANDO TESTE END-TO-END DE TODAS AS FUNCIONALIDADES ===");

  let testUserId = null;
  let propostaId = null;

  try {
    // 1. Cadastrar Usuário Comercial de Teste
    const passwordHash = await bcrypt.hash("teste123", 10);
    await db.execute("DELETE FROM usuarios WHERE email = 'test_feature_com@finora.com.br'");
    const [userRes] = await db.execute(
      "INSERT INTO usuarios (nome, email, senha_hash, role, ativo) VALUES (?, ?, ?, ?, 1)",
      ["Vendedor Teste", "test_feature_com@finora.com.br", passwordHash, "Comercial"]
    );
    testUserId = userRes.insertId;

    // 2. Fazer Login e Obter JWT
    const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: "test_feature_com@finora.com.br",
      senha: "teste123"
    });
    const tokenComercial = loginRes.data.token;
    console.log("✔ Autenticação de teste realizada com sucesso!");

    // 3. Criar Nova Proposta com Vídeo Pitch e Áudio Pitch
    const dadosProposta = {
      numeroProposta: `PERFECT-${Date.now()}`,
      dataProposta: new Date().toISOString().slice(0, 10),
      nomeClinica: "Clínica Teste Perfeição",
      razaoSocial: "Clínica Teste Perfeição Odontologia LTDA",
      cnpj: "12345678000190",
      nomeSocio: "Dr. Roberto Silva",
      cpfSocio: "123.456.789-00",
      email: "roberto.teste@clinica.com.br",
      telefone: "(11) 99999-8888",
      videoPitch: "https://www.loom.com/share/abc12345",
      audioPitch: "data:audio/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwH/////////FUmpZpkq17GDD0JATYCGQ2hyb21lV0GGQ2hyb21lFlSua8+56+2xk6+Vjbt70gdegKE=",
      enderecoClinica: "Av. Paulista, 1000 - Bela Vista, São Paulo - SP",
      cadeiras: 3,
      funcionarios: 4,
      socios: 2,
      faturamento: 80000,
      regimeFiscal: "Simples Nacional",
      regimeHibrido: "Não",
      distanciaKm: 10,
      metragem: 120,
      totalMensal: 1800,
      totalPontual: 500,
      tipoProposta: "finora",
      empresaProposta: "FINORA",
      total: 2300,
      itens: [
        { servico: "Assessoria Contábil & Fiscal", valor: 1200, observacao: "Mensal" },
        { servico: "BPO Financeiro Essencial", valor: 600, observacao: "Mensal" },
        { servico: "Taxa de Implantação e Treinamento", valor: 500, observacao: "Pontual" }
      ]
    };

    const propCriada = await axios.post(`${BASE_URL}/api/propostas`, dadosProposta, {
      headers: { Authorization: `Bearer ${tokenComercial}` }
    });

    propostaId = propCriada.data.propostaId;
    const tokenAcesso = propCriada.data.tokenAcesso;
    console.log(`✔ Proposta criada com sucesso! ID=${propostaId}, Token=${tokenAcesso}`);

    // 4. Testar Endpoint Público da Proposta
    const propPublica = await axios.get(`${BASE_URL}/api/propostas/${tokenAcesso}/publica`);
    if (propPublica.data.nome_clinica !== "Clínica Teste Perfeição") {
      throw new Error("Erro na recuperação dos dados da proposta pública.");
    }
    if (!propPublica.data.video_pitch || !propPublica.data.audio_pitch) {
      throw new Error("Video Pitch ou Audio Pitch não foram persistidos corretamente.");
    }
    console.log("✔ Endpoint público validado com Vídeo Pitch e Áudio Pitch!");

    // 5. Testar Rastreamento de Tempo de Leitura (Heartbeat)
    const visualizacaoId = propPublica.data.visualizacao_id;
    await axios.post(`${BASE_URL}/api/propostas/${tokenAcesso}/heartbeat`, {
      visualizacao_id: visualizacaoId,
      segundos: 45
    });
    console.log("✔ Heartbeat de tempo de leitura (45s) registrado com sucesso!");

    // 6. Testar Redirecionamento de Link Curto (/p/:token)
    const shortRes = await axios.get(`${BASE_URL}/p/${tokenAcesso}`, { maxRedirects: 0, validateStatus: (status) => status >= 300 && status < 400 });
    console.log(`✔ Redirecionamento de Link Curto /p/${tokenAcesso} funcionando! Redirecionou para: ${shortRes.headers.location}`);

    // 7. Testar Upload de Documento de Onboarding (Opcional)
    await axios.post(`${BASE_URL}/api/propostas/${tokenAcesso}/documentos`, {
      tipo_documento: "Contrato Social / Cartão CNPJ",
      nome_arquivo: "contrato_social_clinica_teste.pdf",
      base64: "data:application/pdf;base64,JVBERi0xLjQKJcOkw7zDtsOfCjIgMCBvYmoKPDwvTGVuZ3RoIDkgMCBSL0ZpbHRlci9GbGF0ZURlY29kZT4+CnN0cmVhbQp4nG2OsQ0AIQzD3k5ZkCj8W/wAR1E5GjA="
    });
    console.log(`✔ Upload de documento de onboarding realizado com sucesso!`);

    // 8. Listar Documentos Anexados
    const listDocs = await axios.get(`${BASE_URL}/api/propostas/${tokenAcesso}/documentos`);
    if (listDocs.data.length === 0) throw new Error("Documento não foi retornado na listagem.");
    const docId = listDocs.data[0].id;
    console.log(`✔ Listagem de documentos anexados validada! Total=${listDocs.data.length}, Doc ID=${docId}`);

    // 9. Download de Documento Anexado
    const downloadRes = await axios.get(`${BASE_URL}/api/documentos/${docId}/download`);
    if (downloadRes.status !== 200) throw new Error("Erro ao baixar documento anexado.");
    console.log("✔ Download de documento anexado funcionando com sucesso!");

    // 10. Testar Aceite e Assinatura Digital Touch
    const aprovarRes = await axios.post(`${BASE_URL}/api/propostas/${tokenAcesso}/aprovar`, {
      nomeSignatario: "Dr. Roberto Silva",
      cpfSignatario: "123.456.789-00",
      assinaturaBase64: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    });
    if (!aprovarRes.data.success) throw new Error("Erro ao aprovar proposta.");
    console.log("✔ Aceite e Assinatura Digital registrados com sucesso!");

    // 11. Limpar Dados do Teste
    if (propostaId) {
      await db.executarQuery("DELETE FROM proposta_documentos WHERE proposta_id = ?", [propostaId]);
      await db.executarQuery("DELETE FROM proposta_visualizacoes WHERE proposta_id = ?", [propostaId]);
      await db.executarQuery("DELETE FROM proposta_observacoes WHERE proposta_id = ?", [propostaId]);
      await db.executarQuery("DELETE FROM proposta_itens WHERE proposta_id = ?", [propostaId]);
      await db.executarQuery("DELETE FROM propostas WHERE id = ?", [propostaId]);
    }
    if (testUserId) {
      await db.executarQuery("DELETE FROM usuarios WHERE id = ?", [testUserId]);
    }
    console.log("✔ Limpeza de dados de teste concluída!");

    console.log("\n=======================================================");
    console.log("🎉 TODOS OS TESTES E RECURSOS PASSARAM COM 100% DE SUCESSO!");
    console.log("=======================================================\n");

    process.exit(0);
  } catch (err) {
    console.error("❌ ERRO NO TESTE:", err.message, err.response?.data || "");
    if (propostaId) {
      await db.executarQuery("DELETE FROM propostas WHERE id = ?", [propostaId]).catch(() => {});
    }
    if (testUserId) {
      await db.executarQuery("DELETE FROM usuarios WHERE id = ?", [testUserId]).catch(() => {});
    }
    process.exit(1);
  }
}

testAllFeatures();

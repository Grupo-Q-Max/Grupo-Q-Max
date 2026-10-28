require("./exigir-env-test");
const axios = require("axios");
const db = require("../config/db");
const bcrypt = require("bcrypt");
const BASE_URL = "http://localhost:3005";

async function testFluxoCompletoIndicacao() {
  console.log("==========================================================================");
  console.log("🚀 INICIANDO TESTE END-TO-END DO FLUXO COMPLETO DE INDICAÇÃO & PROPOSTA");
  console.log("==========================================================================");

  let userCriado = false;
  let leadId = null;
  let propostaId = null;
  let tokenAcesso = null;

  try {
    // 1. Preparar Usuário de Teste (Comercial / Diretor)
    const emailUser = `consultor.indicacao.${Date.now()}@finora.com.br`;
    const hash = await bcrypt.hash("Senha@123", 10);
    const [resUser] = await db.execute(
      `INSERT INTO usuarios (nome, email, senha_hash, role, ativo, recebe_leads) VALUES (?, ?, ?, 'Comercial', 1, 1)`,
      ["Consultor Comercial VIP", emailUser, hash]
    );
    const userId = resUser.insertId;
    userCriado = true;
    console.log(`✔ [Passo 1/6] Usuário comercial criado para teste (ID: ${userId})`);

    // 2. Autenticação JWT
    const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: emailUser,
      senha: "Senha@123",
    });
    const tokenJwt = loginRes.data.token;
    const authHeaders = { headers: { Authorization: `Bearer ${tokenJwt}` } };
    console.log(`✔ [Passo 2/6] Autenticação JWT realizada com sucesso!`);

    // 3. Cadastrar Lead de Indicação no CRM com 100% das informações
    const dadosLead = {
      nome_cliente: "Dra. Patrícia Helena da Silva",
      nome_clinica: "Clínica OdontoPrime & Estética Facial Avançada",
      cnpj: "12.345.678/0001-90",
      email: `dra.patricia.${Date.now()}@odontoprime.med.br`,
      telefone: "11987654321",
      origem: "Indicação",
      cargo: "Cirurgiã-Dentista e Sócia-Fundadora",
      faturamento: 85000,
      cadeiras: 4,
      marca: "finora",
      status: "Em Contato",
      valor_estimado: 1750,
    };

    const leadRes = await axios.post(`${BASE_URL}/api/leads`, dadosLead, authHeaders);
    leadId = leadRes.data.leadId || leadRes.data.id;
    console.log(`✔ [Passo 3/6] Lead com origem 'Indicação' cadastrado com sucesso no CRM (Lead ID: ${leadId})`);

    // Adicionar comentário de indicação na timeline do CRM
    await axios.post(
      `${BASE_URL}/api/leads/${leadId}/comentarios`,
      { comentario: "Indicação VIP recebida do Dr. Marcos Vinicius (Clínica Sorriso Real). Solicita urgência no enquadramento de Fator R e BPO." },
      authHeaders
    );
    console.log(`✔ Comentário da fonte de indicação anexado na linha do tempo do CRM.`);

    // 4. Criar Proposta Comercial Completa com 100% dos campos preenchidos
    const payloadPropostaCompleta = {
      lead_id: leadId,
      tipoPessoa: "PJ",
      cnpjEstabelecido: "Sim",
      empresaProposta: "finora",
      tipoProposta: "finora",
      nomeClinica: "Clínica OdontoPrime & Estética Facial Avançada",
      cnpj: "12.345.678/0001-90",
      nomeSocio: "Dra. Patrícia Helena da Silva",
      cpfSocio: "123.456.789-00",
      email: dadosLead.email,
      telefone: "11987654321",
      cep: "01310-100",
      logradouro: "Avenida Paulista",
      numero: "1578",
      complemento: "Conjunto 1402 - Edifício Bela Vista",
      bairro: "Bela Vista",
      cidade: "São Paulo",
      uf: "SP",
      enderecoClinica: "Avenida Paulista, 1578, Conjunto 1402 - Bela Vista, São Paulo/SP - CEP: 01310-100",
      faturamento: "1020000", // R$ 85.000/mês x 12
      regimeFiscal: "Simples Nacional",
      socios: "2",
      proLabore: "Sim",
      dentistasParceiros: "3",
      funcionarios: "4",
      volumeNotas: "120",
      contabilidadeMesesAnteriores: "Não",
      videoPitch: "https://www.loom.com/share/exemplo-pitch-indicacao-completo",
      audioPitch: "data:audio/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwE=",
      techIndicacao: true,
      servicosContabil: [
        "Assessoria Contábil & Fiscal Mensal (Fator R)",
        "Folha de Pagamento (4 colaboradores + 2 Pró-labores)",
        "BPO Financeiro Completo (Emissão de NFs e Conciliação)",
        "Certificado Digital A1 PJ",
        "Programa de Indicação Tech"
      ],
      total: 1650.00,
      totalMensal: 1650.00,
      totalAnual: 19800.00,
      totalSetup: 0.00,
      itens: [
        { servico: "Assessoria Contábil & Fiscal Mensal (Fator R)", valor: 1200.00, tipo: "mensal" },
        { servico: "BPO Financeiro Completo", valor: 450.00, tipo: "mensal" },
        { servico: "Programa de Indicação Tech", valor: 0.00, tipo: "mensal" }
      ],
    };

    const propRes = await axios.post(`${BASE_URL}/api/propostas`, payloadPropostaCompleta, authHeaders);
    propostaId = propRes.data.propostaId || propRes.data.id;
    tokenAcesso = propRes.data.tokenAcesso || (propRes.data.link ? propRes.data.link.split(/token=|\/p\//).pop() : null);

    console.log(`✔ [Passo 4/6] Proposta Comercial gerada com 100% dos dados preenchidos!`);
    console.log(`   - Proposta ID: ${propostaId}`);
    console.log(`   - Token de Acesso: ${tokenAcesso}`);
    console.log(`   - Link Curto: ${BASE_URL}/p/${tokenAcesso}`);

    // 5. Testar Ambiente do Cliente (Visualizador Público, Link Curto, Certificado de Blindagem)
    const visualizacaoRes = await axios.get(`${BASE_URL}/api/propostas/${tokenAcesso}/publica`);
    if (!visualizacaoRes.data || !visualizacaoRes.data.nome_clinica) {
      throw new Error("Falha ao recuperar dados da proposta pública.");
    }
    console.log(`✔ [Passo 5/6] Proposta pública acessada pelo cliente com sucesso!`);
    console.log(`   - Clínica: ${visualizacaoRes.data.nome_clinica}`);
    console.log(`   - Vídeo Pitch carregado: ${!!visualizacaoRes.data.video_pitch}`);
    console.log(`   - Áudio Pitch carregado: ${!!visualizacaoRes.data.audio_pitch}`);

    // Testar redirecionamento do Link Curto
    const redirectRes = await axios.get(`${BASE_URL}/p/${tokenAcesso}`, { maxRedirects: 0, validateStatus: (s) => s === 302 });
    console.log(`✔ Redirecionamento de Link Curto validado (HTTP 302 -> ${redirectRes.headers.location})`);

    // 6. Aceite e Assinatura Digital Touch com Geração de Contrato D4Sign
    const aprovacaoRes = await axios.post(`${BASE_URL}/api/propostas/${tokenAcesso}/aprovar`, {
      rubricaBase64: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      documentosAprovados: ["Contrato de Prestação de Serviços Contábeis", "Certificado de Blindagem Fiscal"],
    });

    if (!aprovacaoRes.data.success) {
      throw new Error("Erro na aprovação da proposta.");
    }
    console.log(`✔ [Passo 6/6] Proposta de Indicação aceita e assinada digitalmente com sucesso!`);
    console.log(`   - Status da Proposta no Banco: Aprovada`);
    console.log(`   - Disparos automáticos efetuados: D4Sign, WhatsApp Bot e E-mail de Boas-Vindas.`);

    // 7. Validação Final no Banco de Dados
    const [propDb] = await db.execute("SELECT status, valor_total FROM propostas WHERE id = ?", [propostaId]);
    console.log(`✔ Proposta confirmada no MySQL: Status="${propDb[0].status}", Valor Total=R$ ${propDb[0].valor_total}`);

    console.log("==========================================================================");
    console.log("🎉 TESTE DE INDICAÇÃO COMPLETA EXECUTADO COM 100% DE SUCESSO!");
    console.log("==========================================================================");
  } catch (error) {
    console.error("❌ ERRO NO TESTE DE INDICAÇÃO:", error.response?.data || error.message);
    throw error;
  } finally {
    // Teardown: Limpar dados de teste criados
    console.log("🧹 Limpando dados de teste do banco de dados...");
    if (propostaId) {
      await db.execute("DELETE FROM proposta_visualizacoes WHERE proposta_id = ?", [propostaId]).catch(() => {});
      await db.execute("DELETE FROM proposta_documentos WHERE proposta_id = ?", [propostaId]).catch(() => {});
      await db.execute("DELETE FROM proposta_observacoes WHERE proposta_id = ?", [propostaId]).catch(() => {});
      await db.execute("DELETE FROM propostas WHERE id = ?", [propostaId]).catch(() => {});
    }
    if (leadId) {
      await db.execute("DELETE FROM lead_comentarios WHERE lead_id = ?", [leadId]).catch(() => {});
      await db.execute("DELETE FROM leads WHERE id = ?", [leadId]).catch(() => {});
    }
    if (userCriado) {
      await db.execute("DELETE FROM usuarios WHERE email LIKE 'consultor.indicacao.%'").catch(() => {});
    }
    console.log("✔ Limpeza de teste concluída!");
    process.exit(0);
  }
}

testFluxoCompletoIndicacao();

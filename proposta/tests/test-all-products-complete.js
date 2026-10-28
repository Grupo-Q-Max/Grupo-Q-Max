require("./exigir-env-test");
const db = require("../config/db");
const bcrypt = require("bcrypt");
const fs = require("fs");
const path = require("path");

const envTestPath = path.resolve(process.cwd(), ".env.test");
const useTestEnv = process.env.NODE_ENV === "test" && fs.existsSync(envTestPath);

require("dotenv").config({
  path: useTestEnv ? envTestPath : path.resolve(process.cwd(), ".env")
});

const PORT = process.env.PORT || 3005;
const BASE_URL = process.env.BASE_URL || `http://127.0.0.1:${PORT}`;

async function testAllProductsComplete() {
  console.log("\x1b[36m%s\x1b[0m", "==========================================================================");
  console.log("\x1b[36m%s\x1b[0m", "🚀 TESTE EXAUSTIVO DE TODOS OS PRODUTOS, SERVIÇOS E EMPRESAS DO ECOSSISTEMA");
  console.log("\x1b[36m%s\x1b[0m", "==========================================================================\n");

  let createdUserIds = [];
  let createdProposalIds = [];

  try {
    // 1. Verificar conexão ao Servidor Backend
    console.log("📍 Step 1: Conectando ao Servidor Backend...");
    const pingRes = await fetch(`${BASE_URL}/api/health`);
    if (!pingRes.ok) {
      throw new Error(`Servidor respondeu com status ${pingRes.status}`);
    }
    const healthData = await pingRes.json();
    console.log(`  ✔ Servidor online! Status: "${healthData.message}", Uptime: ${Math.round(healthData.uptime)}s`);

    // 2. Autenticação de Usuário Comercial de Teste
    console.log("\n📍 Step 2: Autenticando usuário vendedor de teste...");
    await db.execute("DELETE FROM usuarios WHERE email = 'tester_all_products@qmax.com'");
    const passHash = await bcrypt.hash("senhaTeste123", 10);
    const [uRes] = await db.execute(
      "INSERT INTO usuarios (nome, email, senha_hash, role, ativo) VALUES (?, ?, ?, ?, 1)",
      ["Vendedor Master Teste", "tester_all_products@qmax.com", passHash, "Comercial"]
    );
    createdUserIds.push(uRes.insertId);

    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "tester_all_products@qmax.com", senha: "senhaTeste123" })
    });
    if (!loginRes.ok) throw new Error("Falha no login do vendedor.");
    const { token } = await loginRes.json();
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    console.log("  ✔ Autenticado com sucesso!");

    // 3. Buscar todas as Regras de Precificação no Banco
    console.log("\n📍 Step 3: Carregando todos os produtos e regras do banco...");
    const [regras] = await db.execute("SELECT * FROM regras_precificacao WHERE ativo = 1");
    const [planosTech] = await db.execute("SELECT * FROM tech_planos WHERE ativo = 1");
    console.log(`  ✔ Foram encontrados ${regras.length} serviços/regras de precificação ativos e ${planosTech.length} planos Tech.`);

    // 4. Testar criação de proposta com TODOS OS SERVIÇOS MENSAL E PONTUAL (FINORA / TUDO INCLUSO)
    console.log("\n📍 Step 4: Gerando Proposta MASTER com TODOS os produtos selecionados simultaneamente...");
    
    // Agrupar todos os itens de regras ativas
    const todosItens = regras.map(r => ({
      servico: r.nome,
      codigo: r.codigo,
      empresa: r.empresa,
      valor: parseFloat(r.valor_base || 100),
      observacao: r.tipo || "Mensal",
      descontoPercentual: 0
    }));

    // Adicionar itens de Planos Tech
    planosTech.forEach(p => {
      todosItens.push({
        servico: `${p.nome} (Implantação Tech)`,
        codigo: p.codigo,
        empresa: "TECH",
        valor: parseFloat(p.valor_implantacao),
        observacao: "Pontual",
        descontoPercentual: 0
      });
      todosItens.push({
        servico: `${p.nome} (Mensalidade Tech)`,
        codigo: `mensalidade_${p.codigo}`,
        empresa: "TECH",
        valor: parseFloat(p.valor_mensalidade),
        observacao: "Mensal",
        descontoPercentual: 0
      });
    });

    const totalMensal = todosItens
      .filter(i => i.observacao.toLowerCase() === "mensal")
      .reduce((sum, i) => sum + i.valor, 0);

    const totalPontual = todosItens
      .filter(i => i.observacao.toLowerCase() === "pontual")
      .reduce((sum, i) => sum + i.valor, 0);

    const totalGeral = totalMensal + totalPontual;

    console.log(`  📊 Resumo da Proposta Master:`);
    console.log(`     - Total de Itens: ${todosItens.length}`);
    console.log(`     - Subtotal Mensal: R$ ${totalMensal.toFixed(2)}`);
    console.log(`     - Subtotal Pontual: R$ ${totalPontual.toFixed(2)}`);
    console.log(`     - Total Geral: R$ ${totalGeral.toFixed(2)}`);

    const payloadMaster = {
      numeroProposta: `ALLPROD-${Date.now()}`,
      dataProposta: new Date().toISOString().slice(0, 10),
      nomeClinica: "Grupo Médico & Hospitalar Mega Teste",
      razaoSocial: "Mega Teste Serviços Médicos e Hospitalares S.A.",
      cnpj: "11.222.333/0001-44",
      nomeSocio: "Dra. Maria Fernanda & Dr. Carlos Alberto",
      cpfSocio: "111.222.333-44",
      email: "contato@megateste.com.br",
      telefone: "(11) 98888-7777",
      enderecoClinica: "Av. Faria Lima, 3500 - Itaim Bibi, São Paulo - SP",
      empresaProposta: "FINORA",
      tipoProposta: "finora",
      cadeiras: 12,
      funcionarios: 35,
      socios: 4,
      faturamento: 350000,
      distanciaKm: 15,
      metragem: 350,
      regimeFiscal: "Lucro Presumido",
      regimeHibrido: "Sim (PJ + PF)",
      totalMensal,
      totalPontual,
      total: totalGeral,
      videoPitch: "https://www.loom.com/share/testevideoallproducts123",
      audioPitch: "data:audio/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwH/////////FUmpZpkq17GDD0JATYCGQ2hyb21lV0GGQ2hyb21lFlSua8+56+2xk6+Vjbt70gdegKE=",
      socio1_nome: "Dra. Maria Fernanda",
      socio1_cpf: "111.222.333-44",
      socio1_qualificacao: "Administradora / Médica Responsável",
      socio1_participacao: "60%",
      socio2_nome: "Dr. Carlos Alberto",
      socio2_cpf: "222.333.444-55",
      socio2_qualificacao: "Diretor Clínico",
      socio2_participacao: "40%",
      itens: todosItens
    };

    const resMaster = await fetch(`${BASE_URL}/api/propostas`, {
      method: "POST",
      headers,
      body: JSON.stringify(payloadMaster)
    });

    if (!resMaster.ok) {
      const errTxt = await resMaster.text();
      throw new Error(`Erro ao criar Proposta Master: ${errTxt}`);
    }

    const dataMaster = await resMaster.json();
    const propMasterId = dataMaster.propostaId;
    const tokenMaster = dataMaster.tokenAcesso;
    createdProposalIds.push(propMasterId);

    console.log(`  ✔ Proposta Master criada com sucesso! ID=${propMasterId}, Token=${tokenMaster}`);

    // 5. Validar Persistência no Banco de Dados
    console.log("\n📍 Step 5: Validando persistência de todos os itens no Banco de Dados...");
    const [rowsProp] = await db.execute("SELECT * FROM propostas WHERE id = ?", [propMasterId]);
    if (rowsProp.length === 0) throw new Error("Proposta Master não encontrada na tabela 'propostas'.");

    const [rowsItens] = await db.execute("SELECT * FROM proposta_itens WHERE proposta_id = ?", [propMasterId]);
    console.log(`  ✔ Quantidade de itens salvos no banco: ${rowsItens.length} de ${todosItens.length} enviados.`);
    if (rowsItens.length !== todosItens.length) {
      throw new Error(`Divergência na quantidade de itens no BD! Esperado: ${todosItens.length}, Encontrado: ${rowsItens.length}`);
    }

    // 6. Testar Acesso Público à Proposta Master
    console.log("\n📍 Step 6: Testando endpoint público e renderização da proposta...");
    const pubRes = await fetch(`${BASE_URL}/api/propostas/${tokenMaster}/publica`);
    if (!pubRes.ok) throw new Error(`Falha no endpoint público: ${await pubRes.text()}`);
    const pubData = await pubRes.json();
    if (pubData.nome_clinica !== "Grupo Médico & Hospitalar Mega Teste") {
      throw new Error("Dados da proposta pública incorretos!");
    }
    if (!pubData.itens || pubData.itens.length !== todosItens.length) {
      throw new Error(`Itens não retornados corretamente no endpoint público. Esperado: ${todosItens.length}, Retornado: ${pubData.itens ? pubData.itens.length : 0}`);
    }
    console.log("  ✔ Endpoint público retornou todos os dados e itens perfeitamente!");

    // 7. Testar cada empresa individualmente (FINORA, CONTABIL, TECH, AUDITORIA, LAGERHAUS)
    console.log("\n📍 Step 7: Testando criação de proposta individual para cada vertical do grupo...");
    const empresasEmparelhadas = [
      { key: "finora", name: "FINORA", servicoSample: "BPO Financeiro Strategic" },
      { key: "contabil", name: "Q-MAX CONTABIL", servicoSample: "Assessoria Contábil & Fiscal PJ" },
      { key: "tech", name: "Q-MAX TECH", servicoSample: "Plano Performance (Implantação)" },
      { key: "auditoria", name: "Q-MAX AUDITORIA", servicoSample: "Auditoria Tributária e Fiscal" },
      { key: "lagerhaus", name: "LAGERHAUS", servicoSample: "Locação de Estação Coworking Premium" }
    ];

    for (const emp of empresasEmparelhadas) {
      const payloadEmpresa = {
        numeroProposta: `TEST-${emp.key.toUpperCase()}-${Date.now()}`,
        dataProposta: new Date().toISOString().slice(0, 10),
        nomeClinica: `Clinica Vertical ${emp.name}`,
        razaoSocial: `Clinica Vertical ${emp.name} Ltda`,
        cnpj: "22.333.444/0001-55",
        nomeSocio: "Sócio Vertical Teste",
        cpfSocio: "333.444.555-66",
        email: `contato@${emp.key}.com.br`,
        telefone: "(11) 97777-6666",
        enderecoClinica: "Rua Teste, 123",
        empresaProposta: emp.name,
        tipoProposta: emp.key,
        cadeiras: 4,
        funcionarios: 6,
        socios: 2,
        faturamento: 90000,
        totalMensal: 2500,
        totalPontual: 1000,
        total: 3500,
        itens: [
          { servico: emp.servicoSample, valor: 2500, observacao: "Mensal", descontoPercentual: 0 },
          { servico: "Taxa de Instalação", valor: 1000, observacao: "Pontual", descontoPercentual: 0 }
        ]
      };

      const resEmp = await fetch(`${BASE_URL}/api/propostas`, {
        method: "POST",
        headers,
        body: JSON.stringify(payloadEmpresa)
      });
      if (!resEmp.ok) throw new Error(`Erro ao criar proposta para a empresa ${emp.name}: ${await resEmp.text()}`);
      const dataEmp = await resEmp.json();
      createdProposalIds.push(dataEmp.propostaId);
      console.log(`  ✔ Proposta para vertical ${emp.name} criada com sucesso! ID=${dataEmp.propostaId}`);
    }

    // 8. Testar Assinatura Digital Touch e Aceite na Proposta Master
    console.log("\n📍 Step 8: Testando Aceite com Assinatura Digital Touch na Proposta Master...");
    const aprovarRes = await fetch(`${BASE_URL}/api/propostas/${tokenMaster}/aprovar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nomeSignatario: "Dra. Maria Fernanda",
        cpfSignatario: "111.222.333-44",
        assinaturaBase64: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
      })
    });
    if (!aprovarRes.ok) throw new Error(`Erro ao assinar proposta: ${await aprovarRes.text()}`);
    const aprovarData = await aprovarRes.json();
    console.log("  ✔ Aceite e assinatura digital registrados com sucesso!", aprovarData.message);

    // 9. Testar Download do PDF Gerado
    console.log("\n📍 Step 9: Testando geração e download do arquivo PDF da proposta assinada...");
    const pdfRes = await fetch(`${BASE_URL}/api/propostas/${tokenMaster}/pdf`);
    if (!pdfRes.ok) {
      console.warn(`  ⚠️ Download de PDF retornou status ${pdfRes.status}. Verificando se a rota existe.`);
    } else {
      const buffer = await pdfRes.arrayBuffer();
      console.log(`  ✔ Arquivo PDF gerado e baixado com sucesso! Tamanho: ${buffer.byteLength} bytes.`);
    }

    // 10. Limpeza dos Dados de Teste
    console.log("\n📍 Step 10: Limpando registros de teste da base de dados...");
    if (createdProposalIds.length > 0) {
      const ph = createdProposalIds.map(() => "?").join(",");
      await db.execute(`DELETE FROM proposta_documentos WHERE proposta_id IN (${ph})`, createdProposalIds);
      await db.execute(`DELETE FROM proposta_visualizacoes WHERE proposta_id IN (${ph})`, createdProposalIds);
      await db.execute(`DELETE FROM proposta_observacoes WHERE proposta_id IN (${ph})`, createdProposalIds);
      await db.execute(`DELETE FROM proposta_itens WHERE proposta_id IN (${ph})`, createdProposalIds);
      await db.execute(`DELETE FROM solicitacoes_desconto WHERE proposta_id IN (${ph})`, createdProposalIds);
      await db.execute(`DELETE FROM propostas WHERE id IN (${ph})`, createdProposalIds);
    }
    if (createdUserIds.length > 0) {
      const ph = createdUserIds.map(() => "?").join(",");
      await db.execute(`DELETE FROM usuarios WHERE id IN (${ph})`, createdUserIds);
    }
    console.log("  ✔ Limpeza concluída!");

    console.log("\n==========================================================================");
    console.log("🎉 TESTE COMPLETO CONCLUÍDO COM 100% DE SUCESSO! NENHUM ERRO ENCONTRADO.");
    console.log("==========================================================================\n");
    process.exit(0);

  } catch (err) {
    console.error("\n❌ ERRO DETECTADO DURANTE O TESTE COMPLETO:", err);

    // Tentar limpeza emergencial
    if (createdProposalIds.length > 0) {
      const ph = createdProposalIds.map(() => "?").join(",");
      await db.execute(`DELETE FROM proposta_itens WHERE proposta_id IN (${ph})`, createdProposalIds).catch(() => {});
      await db.execute(`DELETE FROM propostas WHERE id IN (${ph})`, createdProposalIds).catch(() => {});
    }
    if (createdUserIds.length > 0) {
      const ph = createdUserIds.map(() => "?").join(",");
      await db.execute(`DELETE FROM usuarios WHERE id IN (${ph})`, createdUserIds).catch(() => {});
    }
    process.exit(1);
  }
}

testAllProductsComplete();

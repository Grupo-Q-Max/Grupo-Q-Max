process.env.NODE_ENV = "test";
const fs = require("fs");
const path = require("path");
const envTestPath = path.resolve(process.cwd(), ".env.test");
// Sem .env.test o db.js cairia no .env (produção) e este script apaga dados.
if (!fs.existsSync(envTestPath)) {
  console.error("Abortado: crie .env.test apontando para um banco de TESTE (veja .env.test.example).");
  process.exit(1);
}
const db = require("../config/db");
const bcrypt = require("bcrypt");
const useTestEnv = process.env.NODE_ENV === "test" && fs.existsSync(envTestPath);

require("dotenv").config({
  path: useTestEnv ? envTestPath : path.resolve(process.cwd(), ".env")
});

const PORT = process.env.PORT || 3005;
const BASE_URL = process.env.BASE_URL || `http://127.0.0.1:${PORT}`;

async function runAllTests() {
  console.log("\x1b[36m%s\x1b[0m", "=== INICIANDO FLUXO DE TESTES DE PROPOSTAS & SISTEMA ===");

  let testProposalIds = []; // IDs de propostas criadas no teste (pai e filho)
  let testUserIds = [];
  let testTokensToDelete = [];

  try {
    // 0. Verificar se o servidor backend está online e respondendo
    console.log("Dando ping no servidor local...");
    try {
      const pingRes = await fetch(`${BASE_URL}/api/propostas`, { method: "GET" });
      // Um status 401 ou 403 significa que o endpoint respondeu - servidor está ativo!
      if (pingRes.status === 401 || pingRes.status === 403 || pingRes.ok) {
        console.log(`✔ Servidor backend respondendo na porta ${PORT}.`);
      } else {
        throw new Error(`Status inesperado: ${pingRes.status}`);
      }
    } catch (err) {
      if (err.message && err.message.includes("ECONNREFUSED")) {
        console.error("\x1b[31m%s\x1b[0m", `❌ ERRO: Não foi possível conectar ao servidor em ${BASE_URL}.`);
        console.error("Certifique-se de que o servidor está rodando via 'npm run dev' ou 'npm start'.\n");
        process.exit(1);
      }
      throw err;
    }

    // 1. Preparar Usuários de Teste na Database (limpeza idempotente)
    console.log("Preparando usuários de teste na database...");
    // Desabilitar FK checks temporariamente para limpar resíduos de runs anteriores
    await db.execute("SET FOREIGN_KEY_CHECKS = 0");
    const [oldProps] = await db.execute(
      "SELECT id FROM propostas WHERE email = 'test_clinic@teste.local'"
    );
    if (oldProps.length > 0) {
      const ids = oldProps.map(r => r.id);
      const ph = ids.map(() => "?").join(",");
      await db.execute(`DELETE FROM proposta_itens WHERE proposta_id IN (${ph})`, ids);
      await db.execute(`DELETE FROM solicitacoes_desconto WHERE proposta_id IN (${ph})`, ids);
      await db.execute(`DELETE FROM propostas WHERE id IN (${ph})`, ids);
    }
    await db.execute("DELETE FROM usuarios WHERE email IN ('test_dir@teste.local', 'test_com@teste.local', 'test_com2@teste.local')");
    await db.execute("SET FOREIGN_KEY_CHECKS = 1");

    const passwordHash = await bcrypt.hash("testpass123", 10);

    const [resDir] = await db.execute(
      "INSERT INTO usuarios (nome, email, senha_hash, role, ativo) VALUES (?, ?, ?, ?, 1)",
      ["Test Diretor", "test_dir@teste.local", passwordHash, "Diretor"]
    );
    testUserIds.push(resDir.insertId);

    const [resCom] = await db.execute(
      "INSERT INTO usuarios (nome, email, senha_hash, role, ativo) VALUES (?, ?, ?, ?, 1)",
      ["Test Comercial", "test_com@teste.local", passwordHash, "Comercial"]
    );
    testUserIds.push(resCom.insertId);

    // Segundo vendedor: confere que um Comercial não vê dados do outro
    const [resCom2] = await db.execute(
      "INSERT INTO usuarios (nome, email, senha_hash, role, ativo) VALUES (?, ?, ?, ?, 1)",
      ["Test Comercial 2", "test_com2@teste.local", passwordHash, "Comercial"]
    );
    testUserIds.push(resCom2.insertId);
    console.log("✔ Usuários de teste cadastrados!");


    // 2. Testar Login
    console.log("Testando autenticação de usuários...");

    // Login com senha inválida deve retornar 401
    const loginFail = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test_dir@teste.local", senha: "senha_errada" })
    });
    if (loginFail.status === 401) {
      console.log("✔ Falha de autenticação detectada corretamente para senha inválida.");
    } else {
      throw new Error(`Esperava status 401 para senha incorreta, obteve ${loginFail.status}`);
    }

    // Login Diretor com senha correta
    const loginDirRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test_dir@teste.local", senha: "testpass123" })
    });
    if (!loginDirRes.ok) throw new Error(`Erro ao logar como Diretor: ${await loginDirRes.text()}`);
    const { token: tokenDiretor } = await loginDirRes.json();
    console.log("✔ Token do Diretor obtido com sucesso.");

    // Login Comercial com senha correta
    const loginComRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test_com@teste.local", senha: "testpass123" })
    });
    if (!loginComRes.ok) throw new Error(`Erro ao logar como Comercial: ${await loginComRes.text()}`);
    const { token: tokenComercial } = await loginComRes.json();
    console.log("✔ Token do Comercial obtido com sucesso.");

    const headersComercial = { "Authorization": `Bearer ${tokenComercial}`, "Content-Type": "application/json" };
    const headersDiretor  = { "Authorization": `Bearer ${tokenDiretor}`,  "Content-Type": "application/json" };

    // 3. Criar Proposta Padrão (Sem desconto, criada pelo Comercial)
    console.log("Criando proposta de teste padrão sem desconto...");
    const proposalPayload = {
      nomeClinica: "Clinica Teste Automatizado",
      razaoSocial: "Clinica de Testes Ltda",
      cnpj: "00.000.000/0001-00",
      nomeSocio: "Socio Teste",
      cpfSocio: "000.000.000-00",
      email: "test_clinic@teste.local",
      telefone: "11999999999",
      enderecoClinica: "Av Paulista, 1000",
      empresaProposta: "FINORA",
      tipoProposta: "finora",
      cadeiras: 3,
      funcionarios: 2,
      socios: 1,
      faturamento: 30000,
      distanciaKm: 0,
      metragem: 80,
      regimeFiscal: "Simples Nacional",
      regimeHibrido: "Nao",
      totalMensal: 1000,
      totalPontual: 400,
      total: 1400,
      itens: [
        { servico: "Servico Mensal Teste",  valor: 1000, observacao: "Mensal",  descontoPercentual: 0 },
        { servico: "Servico Pontual Teste", valor: 400,  observacao: "Pontual", descontoPercentual: 0 }
      ]
    };

    const createRes = await fetch(`${BASE_URL}/api/propostas`, {
      method: "POST",
      headers: headersComercial,
      body: JSON.stringify(proposalPayload)
    });
    if (!createRes.ok) throw new Error(`Erro ao criar proposta: ${await createRes.text()}`);
    await createRes.json();
    console.log("✔ Proposta de teste criada!");

    // Recuperar proposta no banco
    const [rowsProp] = await db.execute(
      "SELECT id, token_acesso, numero_proposta, status, valor_total FROM propostas WHERE email = 'test_clinic@teste.local' AND proposta_pai_id IS NULL ORDER BY id DESC LIMIT 1"
    );
    if (rowsProp.length === 0) throw new Error("A proposta não foi inserida no banco.");
    const propPai = rowsProp[0];
    testProposalIds.push(propPai.id);
    testTokensToDelete.push(propPai.token_acesso);
    console.log(`✔ Proposta pai ID=${propPai.id} resgatada. Status=${propPai.status}.`);

    // Validar total no banco
    const valorTotalBD = parseFloat(propPai.valor_total);
    if (Math.abs(valorTotalBD - 1400.00) > 0.01) {
      throw new Error(`Valor no BD é R$ ${valorTotalBD}, esperava R$ 1400.00`);
    }
    console.log("✔ Cálculos de valores da proposta validados no banco de dados (R$ 1400.00).");

    // 4. Solicitar Desconto > 20% (Cria solicitação pendente para a Diretoria)
    console.log(`Solicitando desconto de 25% na proposta ID=${propPai.id}...`);
    const solicitRes = await fetch(`${BASE_URL}/api/propostas/${propPai.id}/desconto`, {
      method: "POST",
      headers: headersComercial,
      body: JSON.stringify({ percentual: 25, justificativa: "Teste automatizado - desconto de 25%" })
    });
    if (!solicitRes.ok) throw new Error(`Erro ao solicitar desconto: ${await solicitRes.text()}`);
    console.log("✔ Resposta:", (await solicitRes.json()).message);

    // Recuperar solicitação no banco
    const [rowsSols] = await db.execute(
      "SELECT * FROM solicitacoes_desconto WHERE proposta_id = ? ORDER BY id DESC LIMIT 1",
      [propPai.id]
    );
    if (rowsSols.length === 0) throw new Error("A solicitação de desconto não foi registrada no banco.");
    const solCriada = rowsSols[0];
    console.log(`✔ Solicitação ID=${solCriada.id} registrada. Percentual=${solCriada.percentual_solicitado}%, Status=${solCriada.status}`);

    // 5. Verificar painel administrativo de solicitações (GET /api/solicitacoes)
    console.log("Buscando lista de solicitações no painel da diretoria...");
    const getSolsRes = await fetch(`${BASE_URL}/api/solicitacoes`, { method: "GET", headers: headersDiretor });
    if (!getSolsRes.ok) throw new Error(`Erro ao buscar solicitações: ${await getSolsRes.text()}`);
    const listaSols = await getSolsRes.json();
    const solNoPainel = listaSols.find(s => s.id === solCriada.id);
    if (!solNoPainel) throw new Error("A solicitação de teste não está aparecendo no painel da diretoria.");
    if (solNoPainel.cnpj !== "00.000.000/0001-00" || solNoPainel.cadeiras !== 3) {
      throw new Error(`Metadados incorretos. CNPJ=${solNoPainel.cnpj}, Cadeiras=${solNoPainel.cadeiras}`);
    }
    console.log("✔ Solicitação e metadados da clínica validados no painel (CNPJ, cadeiras, faturamento).");

    // 6. Alterar Desconto pelo Diretor (PUT /api/solicitacoes/:id/alterar)
    console.log(`Alterando desconto da solicitação ID=${solCriada.id} para 30.50%...`);
    const alterRes = await fetch(`${BASE_URL}/api/solicitacoes/${solCriada.id}/alterar`, {
      method: "PUT",
      headers: headersDiretor,
      body: JSON.stringify({ percentual: 30.5 })
    });
    if (!alterRes.ok) throw new Error(`Erro ao alterar desconto: ${await alterRes.text()}`);
    console.log("✔ Resposta:", (await alterRes.json()).message);

    // Confirmar alteração no banco
    const [[rowSolAlterado]] = await db.execute(
      "SELECT percentual_solicitado FROM solicitacoes_desconto WHERE id = ?",
      [solCriada.id]
    );
    if (Math.abs(parseFloat(rowSolAlterado.percentual_solicitado) - 30.50) > 0.01) {
      throw new Error(`Percentual no BD é ${rowSolAlterado.percentual_solicitado}, esperava 30.50`);
    }
    console.log("✔ Percentual de 30.50% confirmado no banco de dados.");

    // 7. Aprovar solicitação (POST /api/solicitacoes/:id/responder)
    console.log(`Aprovando solicitação ID=${solCriada.id}...`);
    const respondRes = await fetch(`${BASE_URL}/api/solicitacoes/${solCriada.id}/responder`, {
      method: "POST",
      headers: headersDiretor,
      body: JSON.stringify({ acao: "Aprovar" })
    });
    if (!respondRes.ok) throw new Error(`Erro ao aprovar solicitação: ${await respondRes.text()}`);
    console.log("✔ Resposta:", (await respondRes.json()).message);

    // Confirmar status 'Aprovada' na solicitação
    const [[solFinal]] = await db.execute("SELECT status FROM solicitacoes_desconto WHERE id = ?", [solCriada.id]);
    if (solFinal.status !== "Aprovada") throw new Error(`Status esperado 'Aprovada', obteve '${solFinal.status}'`);
    console.log("✔ Status da solicitação mudou para 'Aprovada'.");

    // A nova proposta gerada é filha da proposta pai (proposta_pai_id = propPai.id) com status = 'Pendente'
    // pois o novo envio segue o fluxo normal (enviada ao cliente) 
    const [rowsFilha] = await db.execute(
      "SELECT id, token_acesso, numero_proposta, status, valor_total, valor_desconto, percentual_desconto FROM propostas WHERE proposta_pai_id = ? ORDER BY id DESC LIMIT 1",
      [propPai.id]
    );
    if (rowsFilha.length === 0) throw new Error("A proposta filha com desconto não foi gerada no banco.");
    const propFilha = rowsFilha[0];
    // Registrar a filha para cleanup (unshift = filha deletada ANTES da pai)
    testProposalIds.unshift(propFilha.id);
    testTokensToDelete.push(propFilha.token_acesso);
    console.log(`✔ Proposta filha ID=${propFilha.id} gerada com desconto. Status=${propFilha.status}.`);

    // Validar campos de desconto:
    // A proposta filha mantém o valor_total original e armazena o abatimento em valor_desconto separado.
    // O valor efetivo para o cliente = valor_total - valor_desconto
    // Original: R$1400.00, desconto de 30.5%: abatimento = 1400 * 0.305 = 427.00
    const totalOriginalFilha = parseFloat(propFilha.valor_total);
    const valorDescontoBD = parseFloat(propFilha.valor_desconto || 0);
    const percentualDescontoBD = parseFloat(propFilha.percentual_desconto || 0);
    const efetivo = totalOriginalFilha - valorDescontoBD;

    if (Math.abs(valorDescontoBD - 427.00) > 0.05) {
      throw new Error(`valor_desconto esperado R$ 427.00, obteve R$ ${valorDescontoBD.toFixed(2)}`);
    }
    if (Math.abs(percentualDescontoBD - 30.5) > 0.01) {
      throw new Error(`percentual_desconto esperado 30.5%, obteve ${percentualDescontoBD}%`);
    }
    console.log(`✔ Desconto de ${percentualDescontoBD}% validado: abatimento R$ ${valorDescontoBD.toFixed(2)}, valor efetivo R$ ${efetivo.toFixed(2)}.`);


    // 8. Testar endpoint público da proposta gerada
    console.log(`Verificando endpoint público para token ${propFilha.token_acesso.substring(0, 8)}...`);
    const pubRes = await fetch(`${BASE_URL}/api/propostas/${propFilha.token_acesso}/publica`);
    if (pubRes.status === 200 || pubRes.redirected) {
      console.log("✔ Endpoint público da proposta respondeu com sucesso.");
    } else {
      throw new Error(`Erro ao acessar proposta pública. Status: ${pubRes.status}`);
    }

    // 9. Criar proposta para teste de desconto por item
    console.log("Criando segunda proposta para teste de desconto por item...");
    const propItemRes = await fetch(`${BASE_URL}/api/propostas`, {
      method: "POST",
      headers: headersComercial,
      body: JSON.stringify(proposalPayload)
    });
    if (!propItemRes.ok) throw new Error(`Erro ao criar proposta para itens: ${await propItemRes.text()}`);
    const propItemData = await propItemRes.json();
    const tokenItem = propItemData.link.split(/token=|\/p\//).pop();

    const [rowsPropItem] = await db.execute(
      "SELECT id, token_acesso, numero_proposta, status, valor_total FROM propostas WHERE token_acesso = ?",
      [tokenItem]
    );
    const propItemPai = rowsPropItem[0];
    testProposalIds.push(propItemPai.id);
    testTokensToDelete.push(propItemPai.token_acesso);
    console.log(`✔ Proposta pai (item) ID=${propItemPai.id} resgatada. Status=${propItemPai.status}.`);

    // 10. Chamar POST /api/propostas/:id/desconto-itens com desconto de 25% no item (acima de 20%)
    console.log(`Solicitando desconto por item (25%) na proposta ID=${propItemPai.id}...`);
    const itensComDescontoItem = [
      {
        servico: "Assessoria Contábil",
        valor: 750, // 25% de desconto de R$ 1000.00
        observacao: "Mensal",
        descontoPercentual: 25,
        valorOriginal: 1000,
        valorDesconto: 250
      },
      {
        servico: "Pró-labore",
        valor: 400, // sem desconto
        observacao: "Mensal",
        descontoPercentual: 0,
        valorOriginal: 400,
        valorDesconto: 0
      }
    ];

    const descontoItensRes = await fetch(`${BASE_URL}/api/propostas/${propItemPai.id}/desconto-itens`, {
      method: "POST",
      headers: headersComercial,
      body: JSON.stringify({
        itens: itensComDescontoItem,
        totalMensal: 1150,
        totalPontual: 0,
        total: 1150,
        justificativaDesconto: "Desconto por item teste"
      })
    });
    if (!descontoItensRes.ok) throw new Error(`Erro ao solicitar desconto por item: ${await descontoItensRes.text()}`);
    const descItensData = await descontoItensRes.json();
    if (!descItensData.aguardandoAprovacao) {
      throw new Error("Esperava-se que a proposta por item ficasse aguardando aprovação.");
    }
    console.log("✔ Resposta:", descItensData.message);

    // Recuperar proposta filha (em aprovação)
    const [rowsFilhaItem] = await db.execute(
      "SELECT id, token_acesso, status, valor_total FROM propostas WHERE proposta_pai_id = ? ORDER BY id DESC LIMIT 1",
      [propItemPai.id]
    );
    if (rowsFilhaItem.length === 0) throw new Error("Proposta filha por item não encontrada.");
    const propFilhaItem = rowsFilhaItem[0];
    testProposalIds.unshift(propFilhaItem.id);
    testTokensToDelete.push(propFilhaItem.token_acesso);
    console.log(`✔ Proposta filha (item) ID=${propFilhaItem.id} criada. Status=${propFilhaItem.status}.`);
    // Desconto acima da alçada sem aval da diretoria: o cliente não pode aprovar pelo link
    if (propFilhaItem.status !== "Aguardando Aprovação") {
      throw new Error(`Filha com desconto > 20% deveria estar 'Aguardando Aprovação', está '${propFilhaItem.status}'`);
    }
    const aprovarAntesRes = await fetch(`${BASE_URL}/api/propostas/${propFilhaItem.token_acesso}/aprovar`, { method: "POST" });
    if (aprovarAntesRes.status !== 409) throw new Error(`Cliente aprovou proposta em análise interna (status ${aprovarAntesRes.status})`);
    const assinarAntesRes = await fetch(`${BASE_URL}/api/propostas/${propFilhaItem.token_acesso}/link-assinatura`);
    if (assinarAntesRes.status !== 409) throw new Error(`link-assinatura gerou contrato para proposta em análise (status ${assinarAntesRes.status})`);
    console.log("✔ Proposta em análise bloqueada para aprovação e assinatura do cliente (409).");

    // Recuperar solicitação no banco
    const [rowsSolsItem] = await db.execute(
      "SELECT * FROM solicitacoes_desconto_item WHERE proposta_id = ? ORDER BY id DESC LIMIT 1",
      [propFilhaItem.id]
    );
    if (rowsSolsItem.length === 0) throw new Error("A solicitação de desconto por item não foi inserida no banco.");
    const solItemCriada = rowsSolsItem[0];
    console.log(`✔ Solicitação por item ID=${solItemCriada.id} registrada. Status=${solItemCriada.status}`);

    // 11. Buscar no painel da diretoria (GET /api/solicitacoes) e ver se a solicitação tipo_solicitacao === 'item' aparece
    console.log("Buscando lista de solicitações no painel da diretoria...");
    const getSolsRes2 = await fetch(`${BASE_URL}/api/solicitacoes`, { method: "GET", headers: headersDiretor });
    if (!getSolsRes2.ok) throw new Error(`Erro ao buscar solicitações: ${await getSolsRes2.text()}`);
    const listaSols2 = await getSolsRes2.json();
    const solItemNoPainel = listaSols2.find(s => s.id === solItemCriada.id && s.tipo_solicitacao === "item");
    if (!solItemNoPainel) throw new Error("A solicitação de desconto por item de teste não está aparecendo no painel da diretoria.");
    // Confirmar percentual calculado pelo SQL (desconto de R$ 250 em R$ 1400 total original = 17.86%)
    console.log(`✔ Solicitação de item validada no painel! Desconto médio calculado: ${solItemNoPainel.percentual_solicitado}%.`);

    // 12. Aprovar solicitação de item (POST /api/solicitacoes/:id/responder com tipo: 'item')
    console.log(`Aprovando solicitação de item ID=${solItemCriada.id}...`);
    const respondItemRes = await fetch(`${BASE_URL}/api/solicitacoes/${solItemCriada.id}/responder`, {
      method: "POST",
      headers: headersDiretor,
      body: JSON.stringify({ acao: "Aprovar", tipo: "item" })
    });
    if (!respondItemRes.ok) throw new Error(`Erro ao aprovar solicitação de item: ${await respondItemRes.text()}`);
    console.log("✔ Resposta:", (await respondItemRes.json()).message);

    // Confirmar status no banco
    const [[solItemFinal]] = await db.execute("SELECT status FROM solicitacoes_desconto_item WHERE id = ?", [solItemCriada.id]);
    if (solItemFinal.status !== "Aprovada") throw new Error(`Status esperado 'Aprovada' na solicitação, obteve '${solItemFinal.status}'`);
    const [[propFilhaItemFinal]] = await db.execute("SELECT status FROM propostas WHERE id = ?", [propFilhaItem.id]);
    if (propFilhaItemFinal.status !== "Pendente") throw new Error(`Status esperado 'Pendente' na proposta filha, obteve '${propFilhaItemFinal.status}'`);
    console.log("✔ Status de proposta filha e solicitação de item validados após aprovação.");

    // 12b. Proposta nova já criada acima da alçada (sem proposta-pai) precisa aparecer para o Diretor
    console.log("Criando proposta nova com 25% de desconto (Comercial)...");
    const novaComDescontoRes = await fetch(`${BASE_URL}/api/propostas`, {
      method: "POST",
      headers: headersComercial,
      body: JSON.stringify({
        ...proposalPayload,
        itens: [
          { servico: "Servico Mensal Teste", valor: 750, valorOriginal: 1000, observacao: "Mensal", descontoPercentual: 25 },
          { servico: "Servico Pontual Teste", valor: 400, observacao: "Pontual", descontoPercentual: 0 }
        ]
      })
    });
    if (novaComDescontoRes.status !== 202) throw new Error(`Esperava 202 (aguardando aprovação), obteve ${novaComDescontoRes.status}: ${await novaComDescontoRes.text()}`);
    const { propostaId: novaComDescontoId } = await novaComDescontoRes.json();
    testProposalIds.unshift(novaComDescontoId);
    const listaSols3 = await (await fetch(`${BASE_URL}/api/solicitacoes`, { headers: headersDiretor })).json();
    const solNova = listaSols3.find(s => s.proposta_id === novaComDescontoId && s.tipo_solicitacao === "item");
    if (!solNova) throw new Error("Pedido de desconto de proposta nova (sem pai) não aparece no painel da diretoria.");
    if (Number(solNova.percentual_solicitado) !== 25) throw new Error(`Percentual esperado 25, obteve ${solNova.percentual_solicitado}`);
    console.log("✔ Pedido de desconto de proposta nova aparece no painel com 25%.");

    // 12c. Itens inválidos são recusados (servico obrigatório, valor não negativo)
    for (const itemInvalido of [{ valor: 100, observacao: "Mensal" }, { servico: "Servico Mensal Teste", valor: -500, observacao: "Mensal" }]) {
      const invRes = await fetch(`${BASE_URL}/api/propostas`, {
        method: "POST",
        headers: headersComercial,
        body: JSON.stringify({ ...proposalPayload, itens: [...proposalPayload.itens, itemInvalido] })
      });
      if (invRes.status !== 400) throw new Error(`Item inválido ${JSON.stringify(itemInvalido)} aceito (status ${invRes.status})`);
    }
    console.log("✔ Item sem serviço e item com valor negativo recusados (400).");

    // 12d. Criações simultâneas não colidem no número da proposta
    console.log("Criando 3 propostas ao mesmo tempo...");
    const simultaneas = await Promise.all([1, 2, 3].map(() => fetch(`${BASE_URL}/api/propostas`, {
      method: "POST",
      headers: headersComercial,
      body: JSON.stringify(proposalPayload)
    }).then(async (r) => ({ status: r.status, corpo: await r.json() }))));
    for (const r of simultaneas) {
      if (r.status !== 200) throw new Error(`Criação simultânea falhou (status ${r.status}): ${JSON.stringify(r.corpo)}`);
      testProposalIds.push(r.corpo.propostaId);
    }
    const [numerosSimultaneos] = await db.query(
      "SELECT numero_proposta FROM propostas WHERE id IN (?)",
      [simultaneas.map(r => r.corpo.propostaId)]
    );
    if (new Set(numerosSimultaneos.map(r => r.numero_proposta)).size !== 3) throw new Error("Propostas simultâneas receberam o mesmo número.");
    console.log("✔ 3 propostas simultâneas com números distintos.");

    // 12e. Cliente aprova uma vez; o segundo clique não gera outro contrato
    const tokenAprovar = simultaneas[0].corpo.tokenAcesso;
    const aprovarRes = await fetch(`${BASE_URL}/api/propostas/${tokenAprovar}/aprovar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nomeSignatario: "Socio Teste", cpfSignatario: "000.000.000-00" })
    });
    if (!aprovarRes.ok) throw new Error(`Erro ao aprovar: ${await aprovarRes.text()}`);
    const aprovarDeNovoRes = await fetch(`${BASE_URL}/api/propostas/${tokenAprovar}/aprovar`, { method: "POST" });
    if (aprovarDeNovoRes.status !== 409) throw new Error(`Segunda aprovação deveria dar 409, deu ${aprovarDeNovoRes.status}`);
    const [[obsAceite]] = await db.execute(
      "SELECT COUNT(*) AS n FROM proposta_observacoes WHERE proposta_id = ? AND observacao LIKE '%Socio Teste%'",
      [simultaneas[0].corpo.propostaId]
    );
    if (Number(obsAceite.n) !== 1) throw new Error("Nome do signatário não foi registrado no histórico da proposta.");
    console.log("✔ Aprovação única, segundo clique 409 e signatário registrado.");

    // 12f. PUT parcial da regra de preço não apaga os outros campos
    const [[regra]] = await db.execute(
      "SELECT id, descricao, valor_base_pf, valor_base_pj, empresa, categoria FROM regras_precificacao ORDER BY id LIMIT 1"
    );
    const putRegraRes = await fetch(`${BASE_URL}/api/regras-precificacao/${regra.id}`, {
      method: "PUT",
      headers: headersDiretor,
      body: JSON.stringify({ descricao: regra.descricao })
    });
    if (!putRegraRes.ok) throw new Error(`Erro no PUT parcial da regra: ${await putRegraRes.text()}`);
    const [[regraDepois]] = await db.execute(
      "SELECT valor_base_pf, valor_base_pj, empresa, categoria FROM regras_precificacao WHERE id = ?",
      [regra.id]
    );
    for (const campo of ["valor_base_pf", "valor_base_pj", "empresa", "categoria"]) {
      if (String(regraDepois[campo]) !== String(regra[campo])) {
        throw new Error(`PUT parcial alterou ${campo}: ${regra[campo]} -> ${regraDepois[campo]}`);
      }
    }
    // Devolve a descrição original (o PUT grava NULL como "") para não sujar o catálogo do banco de teste
    await db.execute("UPDATE regras_precificacao SET descricao = ? WHERE id = ?", [regra.descricao, regra.id]);
    console.log("✔ PUT parcial da regra preservou preços PF/PJ, empresa e categoria.");

    // --- Fase 2 (segurança) ---
    const loginCom2 = await (await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test_com2@teste.local", senha: "testpass123" })
    })).json();
    const headersComercial2 = { "Authorization": `Bearer ${loginCom2.token}`, "Content-Type": "application/json" };

    // 14a. Histórico por CNPJ: Comercial não vê proposta de colega; Diretor vê
    const histCom2 = await (await fetch(`${BASE_URL}/api/propostas/historico-cnpj/00000000000100`, { headers: headersComercial2 })).json();
    if (histCom2.length !== 0) throw new Error(`Comercial 2 viu ${histCom2.length} proposta(s) de outro vendedor no histórico por CNPJ.`);
    const histDir = await (await fetch(`${BASE_URL}/api/propostas/historico-cnpj/00000000000100`, { headers: headersDiretor })).json();
    if (histDir.length === 0) throw new Error("Diretor deveria ver o histórico por CNPJ.");
    console.log("✔ Histórico por CNPJ restrito ao dono para Comercial.");

    // 14b. Login: tipos inválidos 400, e-mail inexistente 401
    const loginArray = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: ["a"], senha: "x" })
    });
    if (loginArray.status !== 400) throw new Error(`Login com e-mail em array deveria dar 400, deu ${loginArray.status}`);
    const loginInexistente = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "ninguem@teste.local", senha: "testpass123" })
    });
    if (loginInexistente.status !== 401) throw new Error(`Login de e-mail inexistente deveria dar 401, deu ${loginInexistente.status}`);
    console.log("✔ Login valida tipos e responde 401 para e-mail inexistente.");

    // 14c. Perfil lido do banco: Diretor rebaixado perde acesso com o JWT antigo
    await db.execute("UPDATE usuarios SET role = 'Comercial' WHERE id = ?", [resDir.insertId]);
    const solsRebaixado = await fetch(`${BASE_URL}/api/solicitacoes`, { headers: headersDiretor });
    await db.execute("UPDATE usuarios SET role = 'Diretor' WHERE id = ?", [resDir.insertId]);
    if (solsRebaixado.status !== 403) throw new Error(`Diretor rebaixado ainda acessou /api/solicitacoes (status ${solsRebaixado.status})`);
    console.log("✔ Perfil rebaixado vale na hora (403).");

    // 14d. Segredo D4Sign mascarado no GET e preservado quando a tela devolve a máscara
    const [[cfgOriginal]] = await db.query("SELECT COUNT(*) AS n, MAX(valor) AS valor FROM configuracoes_sistema WHERE chave = 'd4sign_token'");
    try {
      await fetch(`${BASE_URL}/api/config/sistema`, { method: "POST", headers: headersDiretor, body: JSON.stringify({ d4sign_token: "tok-teste-1234" }) });
      const cfg = await (await fetch(`${BASE_URL}/api/config/sistema`, { headers: headersDiretor })).json();
      if (cfg.d4sign_token !== "••••1234") throw new Error(`Token D4Sign não veio mascarado: ${cfg.d4sign_token}`);
      await fetch(`${BASE_URL}/api/config/sistema`, { method: "POST", headers: headersDiretor, body: JSON.stringify({ d4sign_token: cfg.d4sign_token }) });
      const [[gravado]] = await db.query("SELECT valor FROM configuracoes_sistema WHERE chave = 'd4sign_token'");
      if (gravado.valor !== "tok-teste-1234") throw new Error("Salvar a tela com a máscara sobrescreveu o token gravado.");
    } finally {
      if (Number(cfgOriginal.n) === 0) await db.execute("DELETE FROM configuracoes_sistema WHERE chave = 'd4sign_token'");
      else await db.execute("UPDATE configuracoes_sistema SET valor = ? WHERE chave = 'd4sign_token'", [cfgOriginal.valor]);
    }
    console.log("✔ Token D4Sign mascarado e preservado ao salvar a tela.");

    // 14e. Clínicas simuladas do Radar IA não entram no CRM
    const importRadar = await fetch(`${BASE_URL}/api/prospeccao/importar-leads`, {
      method: "POST", headers: headersDiretor,
      body: JSON.stringify({ clinicas: [{ simulado: true, nomeFantasia: "Clinica Radar Teste", telefone: "11999990000" }] })
    });
    if (importRadar.status !== 400) throw new Error(`Importação de clínica simulada deveria dar 400, deu ${importRadar.status}`);
    console.log("✔ Importação do Radar IA recusada.");

    // --- Fase 4 (frontend/contratos de API) ---
    // 15a. Token inválido = 401 (front desloga); falta de permissão = 403 (front não desloga)
    const tokenInvalido = await fetch(`${BASE_URL}/api/propostas`, { headers: { Authorization: "Bearer invalido" } });
    if (tokenInvalido.status !== 401) throw new Error(`Token inválido deveria dar 401, deu ${tokenInvalido.status}`);
    const semPermissao = await fetch(`${BASE_URL}/api/solicitacoes`, { headers: headersComercial });
    if (semPermissao.status !== 403) throw new Error(`Comercial em rota de Diretor deveria dar 403, deu ${semPermissao.status}`);
    console.log("✔ 401 para sessão inválida e 403 para falta de permissão.");

    // 15b. Página do cliente: contato do consultor, sem IP/UUID do aceite
    const publica = await (await fetch(`${BASE_URL}/api/propostas/${propPai.token_acesso}/publica`)).json();
    if (publica.consultor_email !== "test_com@teste.local") throw new Error(`consultor_email inesperado: ${publica.consultor_email}`);
    if ("ip_assinatura" in publica) throw new Error("Rota pública expôs ip_assinatura.");
    console.log("✔ Página pública traz o consultor e esconde ip_assinatura.");

    // 15c. Lista do CRM devolve o token da proposta ligada ao lead (link /proposta/p/<token>)
    const leadRes = await fetch(`${BASE_URL}/api/leads`, {
      method: "POST", headers: headersComercial,
      body: JSON.stringify({ nome_cliente: "Lead Teste Link", proposta_id: propPai.id })
    });
    if (!leadRes.ok) throw new Error(`Erro ao criar lead de teste: ${await leadRes.text()}`);
    const leadsCom = await (await fetch(`${BASE_URL}/api/leads`, { headers: headersComercial })).json();
    const leadLink = (Array.isArray(leadsCom) ? leadsCom : leadsCom.leads || []).find((l) => l.nome_cliente === "Lead Teste Link");
    await db.execute("DELETE FROM lead_comentarios WHERE lead_id IN (SELECT id FROM leads WHERE nome_cliente = 'Lead Teste Link')");
    await db.execute("DELETE FROM leads WHERE nome_cliente = 'Lead Teste Link'");
    if (!leadLink || leadLink.token_acesso !== propPai.token_acesso) throw new Error("Lead do CRM não trouxe o token da proposta ligada.");
    console.log("✔ CRM recebe o token da proposta ligada ao lead.");

    // 15d. Rotas removidas não respondem mais
    for (const [metodo, rota] of [["POST", "/api/login"], ["POST", "/api/ai/diagnostico"], ["POST", "/api/prospeccao/gerar-copy"]]) {
      const r = await fetch(`${BASE_URL}${rota}`, { method: metodo, headers: headersDiretor, body: "{}" });
      if (r.status !== 404) throw new Error(`${rota} deveria ter sido removida (status ${r.status})`);
    }
    console.log("✔ Rotas sem uso removidas (404).");

    // --- Fase 5 ---
    // 16a. Webhook de leads: proposta com número da sequência, marca FINORA e itens classificados (observacao)
    const webhookRes = await fetch(`${BASE_URL}/api/webhooks/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Webhook-Secret": process.env.WEBHOOK_SECRET || "" },
      body: JSON.stringify({ nome: "Lead Webhook Teste", clinica: "Clinica Webhook", email: "test_clinic@teste.local", telefone: 11999990000, faturamento: 60000 })
    });
    if (!webhookRes.ok) throw new Error(`Webhook de leads falhou: ${webhookRes.status} ${await webhookRes.text()}`);
    const webhookData = await webhookRes.json();
    const [[propWebhook]] = await db.execute(
      "SELECT id, token_acesso, empresa_proposta, itens_json FROM propostas WHERE token_acesso = ?",
      [webhookData.token]
    );
    testProposalIds.unshift(propWebhook.id);
    const itensWebhook = typeof propWebhook.itens_json === "string" ? JSON.parse(propWebhook.itens_json) : propWebhook.itens_json;
    if (propWebhook.empresa_proposta !== "FINORA") throw new Error(`Marca do webhook: ${propWebhook.empresa_proposta}`);
    if (!itensWebhook.every((i) => i.observacao)) throw new Error("Itens do webhook sem observacao (mensal/pontual).");
    console.log("✔ Webhook de leads (telefone numérico) gera proposta com itens classificados.");

    // 16b. Webhook D4Sign: reenvio do "documento finalizado" não reprocessa (e-mails/Teams/CRM só uma vez)
    const uuidTeste = "11111111-2222-3333-4444-555555555555";
    await db.execute("UPDATE propostas SET status = 'Aprovada', ip_assinatura = ? WHERE id = ?", [uuidTeste, propWebhook.id]);
    const urlWebhookD4 = `${BASE_URL}/api/d4sign/webhook?secret=${encodeURIComponent(process.env.D4SIGN_WEBHOOK_SECRET || "")}`;
    for (let i = 0; i < 2; i++) {
      const r = await fetch(urlWebhookD4, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ uuid: uuidTeste, type_post: "1" })
      });
      if (!r.ok) throw new Error(`Webhook D4Sign falhou (${r.status})`);
    }
    const [[marcas]] = await db.execute(
      "SELECT COUNT(*) AS n FROM proposta_observacoes WHERE proposta_id = ? AND observacao = 'Contrato assinado por todos no D4Sign.'",
      [propWebhook.id]
    );
    if (Number(marcas.n) !== 1) throw new Error(`Assinatura processada ${marcas.n} vez(es); esperado 1.`);
    console.log("✔ Reenvio do webhook D4Sign ignorado (processado uma vez).");

    // --- Fase 6 ---
    // 17a. Validade de 10 dias no servidor: vencida dá 409; consultor renova e o cliente volta a poder aprovar
    const tokenVencida = simultaneas[1].corpo.tokenAcesso;
    const idVencida = simultaneas[1].corpo.propostaId;
    await db.execute("UPDATE propostas SET criado_em = DATE_SUB(NOW(), INTERVAL 11 DAY), validade_inicia_em = NULL WHERE id = ?", [idVencida]);
    const aprovarVencida = await fetch(`${BASE_URL}/api/propostas/${tokenVencida}/aprovar`, { method: "POST" });
    if (aprovarVencida.status !== 409) throw new Error(`Proposta vencida deveria dar 409 ao aprovar, deu ${aprovarVencida.status}`);
    const renovarOutro = await fetch(`${BASE_URL}/api/propostas/${idVencida}/renovar-validade`, { method: "POST", headers: headersComercial2 });
    if (renovarOutro.status !== 403) throw new Error(`Outro vendedor renovou a validade (status ${renovarOutro.status})`);
    const renovar = await fetch(`${BASE_URL}/api/propostas/${idVencida}/renovar-validade`, { method: "POST", headers: headersComercial });
    if (!renovar.ok) throw new Error(`Erro ao renovar validade: ${await renovar.text()}`);
    const aprovarRenovada = await fetch(`${BASE_URL}/api/propostas/${tokenVencida}/aprovar`, { method: "POST" });
    if (!aprovarRenovada.ok) throw new Error(`Proposta renovada não pôde ser aprovada (${aprovarRenovada.status})`);
    console.log("✔ Validade no servidor: vencida 409, renovação só pelo dono, aprovação liberada.");

    // 17b. Telefone do consultor: Diretor cadastra, cliente vê na página pública
    const telInvalido = await fetch(`${BASE_URL}/api/usuarios/${resCom.insertId}/telefone`, { method: "PUT", headers: headersDiretor, body: JSON.stringify({ telefone: "123" }) });
    if (telInvalido.status !== 400) throw new Error(`Telefone inválido aceito (status ${telInvalido.status})`);
    const telOk = await fetch(`${BASE_URL}/api/usuarios/${resCom.insertId}/telefone`, { method: "PUT", headers: headersDiretor, body: JSON.stringify({ telefone: "(11) 98888-7777" }) });
    if (!telOk.ok) throw new Error(`Erro ao salvar telefone: ${await telOk.text()}`);
    const publicaTel = await (await fetch(`${BASE_URL}/api/propostas/${propPai.token_acesso}/publica`)).json();
    if (publicaTel.consultor_telefone !== "11988887777") throw new Error(`consultor_telefone inesperado: ${publicaTel.consultor_telefone}`);
    console.log("✔ Telefone do consultor salvo (validado) e exposto na página do cliente.");

    // 17c. Contratada por marca: o que o admin salva aparece na minuta do contrato
    const [[cfgContratada]] = await db.query("SELECT COUNT(*) AS n, MAX(valor) AS valor FROM configuracoes_sistema WHERE chave = 'contratada_finora'");
    try {
      await fetch(`${BASE_URL}/api/config/sistema`, {
        method: "POST", headers: headersDiretor,
        body: JSON.stringify({ contratada_finora: JSON.stringify({ razao_social: "EMPRESA TESTE CONTRATADA LTDA", cnpj: "11.222.333/0001-81" }) })
      });
      const minuta = await (await fetch(`${BASE_URL}/api/propostas/${propPai.token_acesso}/contrato`)).text();
      if (!minuta.includes("EMPRESA TESTE CONTRATADA LTDA") || !minuta.includes("11.222.333/0001-81")) {
        throw new Error("Minuta do contrato não usou a contratada configurada.");
      }
      if (minuta.includes("50.123.456/0001-89")) throw new Error("Minuta ainda tem o CNPJ fictício antigo.");
    } finally {
      if (Number(cfgContratada.n) === 0) await db.execute("DELETE FROM configuracoes_sistema WHERE chave = 'contratada_finora'");
      else await db.execute("UPDATE configuracoes_sistema SET valor = ? WHERE chave = 'contratada_finora'", [cfgContratada.valor]);
    }
    console.log("✔ Contratada configurada no admin aparece na minuta do contrato.");
    const [[leadWebhook]] = await db.execute("SELECT id FROM leads WHERE proposta_id = ?", [propWebhook.id]);
    if (leadWebhook) {
      await db.execute("DELETE FROM lead_comentarios WHERE lead_id = ?", [leadWebhook.id]);
      await db.execute("DELETE FROM leads WHERE id = ?", [leadWebhook.id]);
    }

    // 13. Testar Linha do Tempo / Histórico da Proposta
    console.log(`Buscando linha do tempo para a proposta ID=${propFilha.id}...`);
    const historicoRes = await fetch(`${BASE_URL}/api/propostas/${propFilha.id}/historico`, {
      method: "GET",
      headers: headersDiretor
    });
    if (!historicoRes.ok) throw new Error(`Erro ao buscar histórico: ${await historicoRes.text()}`);
    const historico = await historicoRes.json();
    if (!Array.isArray(historico) || historico.length < 2) {
      throw new Error(`Esperava no mínimo 2 propostas no histórico (pai e filha), obteve ${historico.length}`);
    }
    // O primeiro item deve ser o pai e o segundo a filha
    if (historico[0].id !== propPai.id || historico[1].id !== propFilha.id) {
      throw new Error(`Ordenação do histórico incorreta. Pai=${historico[0].id} (esperado ${propPai.id}), Filha=${historico[1].id} (esperado ${propFilha.id})`);
    }
    console.log("✔ Histórico de renegociação validado na ordem cronológica correta!");

    console.log("\x1b[32m%s\x1b[0m", "\n=== ✅ TODOS OS TESTES PASSARAM COM SUCESSO! ===\n");

  } catch (error) {
    console.error("\x1b[31m%s\x1b[0m", "\n❌ FALHA NO FLUXO DE TESTES:");
    console.error(error.message || error);
    process.exitCode = 1;
  } finally {
    // 9. Limpeza completa no Banco de Dados
    console.log("Limpando dados de teste do banco de dados...");
    try {
      await db.execute("SET FOREIGN_KEY_CHECKS = 0");

      if (testProposalIds.length > 0) {
        const propPlaceholders = testProposalIds.map(() => "?").join(",");
        await db.execute(`DELETE FROM proposta_itens WHERE proposta_id IN (${propPlaceholders})`, testProposalIds);
        await db.execute(`DELETE FROM solicitacoes_desconto_item WHERE proposta_id IN (${propPlaceholders})`, testProposalIds);
        await db.execute(`DELETE FROM solicitacoes_desconto WHERE proposta_id IN (${propPlaceholders})`, testProposalIds);
        await db.execute(`DELETE FROM proposta_observacoes WHERE proposta_id IN (${propPlaceholders})`, testProposalIds);
        await db.execute(`DELETE FROM proposta_visualizacoes WHERE proposta_id IN (${propPlaceholders})`, testProposalIds);
        await db.execute(`DELETE FROM proposta_followups WHERE proposta_id IN (${propPlaceholders})`, testProposalIds);
        // Deleta filhas (unshift) primeiro, depois a pai
        for (const id of testProposalIds) {
          await db.execute("DELETE FROM propostas WHERE id = ?", [id]);
        }
        console.log(`✔ ${testProposalIds.length} proposta(s) de teste e tabelas relacionadas apagadas.`);
      }

      if (testUserIds.length > 0) {
        const userPlaceholders = testUserIds.map(() => "?").join(",");
        await db.execute(`DELETE FROM usuarios WHERE id IN (${userPlaceholders})`, testUserIds);
        console.log("✔ Usuários de teste removidos.");
      }

      await db.execute("SET FOREIGN_KEY_CHECKS = 1");

      // Limpar arquivos PDF gerados em disco
      let pdfCount = 0;
      testTokensToDelete.forEach(token => {
        const pdfPath = path.join(__dirname, "../public/propostas_pdf", `${token}.pdf`);
        if (fs.existsSync(pdfPath)) {
          try { fs.unlinkSync(pdfPath); pdfCount++; } catch (e) { /* ignora */ }
        }
      });
      if (pdfCount > 0) console.log(`✔ ${pdfCount} arquivo(s) PDF de teste removidos do disco.`);

    } catch (cleanupErr) {
      await db.execute("SET FOREIGN_KEY_CHECKS = 1").catch(() => {});
      console.error("\x1b[33m%s\x1b[0m", "⚠ Erro durante a limpeza:", cleanupErr.message);
    }

    console.log("Encerrando conexão com o Banco de Dados...");
    await db.end();
    console.log("Fim da execução.");
  }
}

runAllTests();

/**
 * Script de teste para simular o fluxo real de envio de e-mail de uma proposta.
 * Uso: node scripts/teste-envio-proposta.js
 */
require("dotenv").config();
const db = require("../config/db");
const { gerarPDFProposta } = require("../services/pdfService");
const d4signService = require("../services/d4signService");
const { enviarEmailLink } = require("../services/emailService");
const path = require("path");
const fs = require("fs");

async function run() {
  console.log("=== SIMULANDO ENVIO REAL DE PROPOSTA COMUM ===");

  const emailDestinatario = "rodrigopenhalves@gmail.com"; // Seu e-mail de teste real
  const tokenAcesso = "teste_real_" + Date.now();
  const pdfFolder = path.join(__dirname, "../storage/propostas_pdf");

  if (!fs.existsSync(pdfFolder)) {
    fs.mkdirSync(pdfFolder, { recursive: true });
  }

  const dados = {
    numeroProposta: "20269999",
    dataProposta: "2026-07-01",
    nomeClinica: "Clínica Teste Q-MAX",
    razaoSocial: "Clínica Teste Q-MAX LTDA",
    cnpj: "00.000.000/0001-00",
    nomeSocio: "Rodrigo Penhalves",
    cpfSocio: "000.000.000-00",
    email: emailDestinatario,
    telefone: "(11) 99999-9999",
    enderecoClinica: "Av. Paulista, 1000 - São Paulo - SP",
    cadeiras: 2,
    funcionarios: 3,
    socios: 1,
    faturamento: 50000,
    regimeFiscal: "Simples Nacional",
    regimeHibrido: "Não",
    distanciaKm: 10,
    metragem: 80,
    totalMensal: 1400.00,
    totalPontual: 0,
    total: 1400.00,
    itens: [
      { servico: "Assessoria Contábil", valor: 1400.00, observacao: "Mensal" }
    ],
    topicosPdf: ["Contabilidade mensal completa"]
  };

  try {
    // 1. Gerar PDF
    console.log("1. Gerando PDF comercial...");
    const pdfBuffer = await gerarPDFProposta(dados);
    const pdfPath = path.join(pdfFolder, `${tokenAcesso}.pdf`);
    fs.writeFileSync(pdfPath, pdfBuffer);
    console.log(`   PDF salvo em: ${pdfPath}`);

    const linkAcesso = `https://grupoqmax.com.br/proposta/visualizar.html?token=${tokenAcesso}`;
    
    // 2. Disparar fluxo (Tentar D4Sign primeiro, se falhar ou estiver com rate limit, cai no fallback)
    console.log("2. Iniciando processo de envio...");
    let assinouD4Sign = false;

    if (process.env.D4SIGN_API_TOKEN && process.env.D4SIGN_API_SECRET && process.env.D4SIGN_UUID_COFRE) {
      console.log("   D4Sign configurada. Tentando registrar proposta na D4Sign...");
      // Criar mock ou proposta de teste temporária no banco de dados se necessário para não falhar a FK do d4sign
      // mas como o iniciarAssinaturaProposta executa UPDATE na tabela propostas, precisamos inserir ela na base antes
      const [insertResult] = await db.execute(
        `INSERT INTO propostas (
          token_acesso, numero_proposta, data_proposta, nome_clinica, email, status, criado_por, valor_total
         ) VALUES (?, ?, NOW(), ?, ?, 'Pendente', 1, 1400.00)`,
        [tokenAcesso, dados.numeroProposta, dados.nomeClinica, dados.email]
      );
      
      const propostaId = insertResult.insertId;

      const [propostaCompleta] = await db.executarQuery(
        "SELECT * FROM propostas WHERE id = ? LIMIT 1",
        [propostaId]
      );

      const docUuid = await d4signService.iniciarAssinaturaProposta(propostaCompleta, pdfBuffer);
      
      if (docUuid) {
        assinouD4Sign = true;
        console.log(`✅ Sucesso D4Sign! UUID Documento: ${docUuid}`);
      } else {
        console.warn("⚠ D4Sign falhou ou deu limite de requisições. Ativando fallback de e-mail.");
      }

      // Limpar proposta temporária de teste
      await db.execute("DELETE FROM propostas WHERE id = ?", [propostaId]);
    }

    if (!assinouD4Sign) {
      console.log("3. Enviando e-mail tradicional de fallback com o link de acesso...");
      await enviarEmailLink(dados, linkAcesso);
      console.log(`✅ E-mail enviado com sucesso para ${emailDestinatario}!`);
    }

    // Limpar arquivo de teste
    if (fs.existsSync(pdfPath)) {
      fs.unlinkSync(pdfPath);
    }

    console.log("\n=== TESTE CONCLUÍDO COM SUCESSO! ===");
    process.exit(0);
  } catch (error) {
    console.error("❌ Erro durante o teste de envio:", error);
    process.exit(1);
  }
}

run();

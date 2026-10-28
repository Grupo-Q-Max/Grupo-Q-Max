// Envia uma proposta odontológica fictícia para o sandbox da D4Sign.
// Todos os signatários (cliente e internos) viram plus-addresses de D4SIGN_EMAIL_INTERNO_TESTE.
// Uso: node tests/test-d4sign-sandbox.js
require("./exigir-env-test");
require("dotenv").config({ path: require("path").resolve(process.cwd(), ".env.test") });

const emailTeste = process.env.D4SIGN_EMAIL_INTERNO_TESTE;
if (!String(process.env.D4SIGN_API_URL || "").includes("sandbox")) {
  console.error("✖ D4SIGN_API_URL do .env.test não aponta para o sandbox. Abortando.");
  process.exit(1);
}
if (!emailTeste || !emailTeste.includes("@")) {
  console.error("✖ Defina D4SIGN_EMAIL_INTERNO_TESTE no .env.test (ex.: voce@gmail.com). Abortando.");
  process.exit(1);
}

// Nenhum e-mail da Finora sai: SMTP vira log e as funções de envio usadas no fluxo são trocadas (Resend vai por HTTP)
const nodemailer = require("nodemailer");
nodemailer.createTransport = () => ({
  sendMail: async (m) => {
    console.log(`[stub nodemailer] to=${m.to} subject=${m.subject}`);
    return { messageId: "stub" };
  },
});
const emailService = require("../services/emailService");
emailService.enviarEmailAssinatura = async (dados, link) => console.log(`[stub e-mail] assinatura para ${dados.email}: ${link}`);
emailService.enviarEmailContratoEnviadoD4SignDiretores = async () => console.log("[stub e-mail] aviso aos diretores");

// Sem banco: configuracoes_sistema vazia (só .env.test vale) e o UPDATE de propostas vira no-op
const db = require("../config/db");
db.executarQuery = async () => [];
db.execute = async () => [{ affectedRows: 0 }];

const { testarConexaoD4Sign, iniciarAssinaturaProposta } = require("../services/d4signService");
const { gerarPDFProposta } = require("../services/pdfService");

const [usuario, dominio] = emailTeste.split("@");
const numero = `TESTE-${Date.now()}`;
const proposta = {
  id: 0,
  numero_proposta: numero,
  numeroProposta: numero,
  tipo_proposta: "finora",
  tipoProposta: "finora",
  nome_clinica: "Clínica Odontológica Sorriso Teste",
  nomeClinica: "Clínica Odontológica Sorriso Teste",
  nome_socio: "Dra. Ana Teste",
  nomeSocio: "Dra. Ana Teste",
  email: `${usuario}+cliente@${dominio}`,
  telefone: "",
  cnpj: "00.000.000/0001-00",
  cadeiras: 4,
  dentistas_parceiros: 3,
  dentistasParceiros: 3,
  socios: 2,
  sociosDetalhados: [{ nome: "Dr. Bruno Teste", email: `${usuario}+socio@${dominio}` }],
  funcionarios: 6,
  dataProposta: new Date().toISOString().slice(0, 10),
  itens: [
    { servico: "Assessoria Financeira FINORA", observacao: "Mensal", valor: 1500 },
    { servico: "Diagnóstico Financeiro Inicial", observacao: "Pontual", valor: 800 },
  ],
  totalMensal: 1500,
  totalPontual: 800,
  total: 2300,
  isContrato: true,
};

(async () => {
  const conexao = await testarConexaoD4Sign();
  if (!conexao.success) {
    console.error("✖ Conexão com o sandbox falhou:", conexao.erro);
    console.error("  Confira D4SIGN_API_TOKEN, D4SIGN_API_SECRET e D4SIGN_UUID_COFRE no .env.test (chaves do sandbox).");
    process.exit(1);
  }
  console.log(`✔ Sandbox OK (${conexao.totalCofres} cofre(s)); cofre configurado: ${conexao.cofreConfigurado}`);

  const pdf = await gerarPDFProposta(proposta);
  console.log(`✔ PDF gerado (${pdf.length} bytes)`);

  const uuid = await iniciarAssinaturaProposta(proposta, pdf);
  console.log(`\n✔ Documento no sandbox. UUID: ${uuid}`);
  console.log(`  Signatários: ${proposta.email}, ${usuario}+socio@${dominio}, ${usuario}+hugo@${dominio}, ${usuario}+testemunha@${dominio}, ${usuario}+financeiro@${dominio}`);
  process.exit(0);
})().catch((err) => {
  console.error("✖ Falhou:", err.message);
  process.exit(1);
});

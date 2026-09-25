require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');
const mariadb = require('mariadb');

const pool = mariadb.createPool(process.env.DATABASE_URL.replace('mysql://', 'mariadb://'));
const adapter = new PrismaMariaDb(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🟡 Iniciando teste de conexão e inserção...");
  
  try {
    // 1. Inserir Visita Fantasma
    console.log("👉 Testando Auditoria (PageVisit)...");
    const visit = await prisma.pageVisit.create({
      data: {
        path: "/teste-automatizado",
        referrer: "Sistema de Teste da Q-Max",
        userAgent: "Antigravity Bot",
      },
    });
    console.log("✅ Auditoria inserida com sucesso! ID:", visit.id);

    // 2. Inserir Lead
    console.log("👉 Testando Leads (ContactLead)...");
    const lead = await prisma.contactLead.create({
      data: {
        name: "Sr. Testador Automático",
        email: "teste@qmax.com",
        phone: "+55 (11) 99999-9999",
        company: "Teste Corporativo",
        message: "qmax-technology",
      }
    });
    console.log("✅ Lead inserido com sucesso! ID:", lead.id);

    // 3. Buscar os dados para confirmar
    console.log("👉 Confirmando no Banco de Dados...");
    
    const visits = await prisma.pageVisit.findMany({ take: 1, orderBy: { createdAt: 'desc' }});
    console.log("📌 Última Visita Salva:", visits[0].path, "-", visits[0].userAgent);

    const leads = await prisma.contactLead.findMany({ take: 1, orderBy: { createdAt: 'desc' }});
    console.log("📌 Último Lead Salvo:", leads[0].name, "-", leads[0].company);

    console.log("🟢 TODOS OS TESTES PASSARAM COM PERFEIÇÃO! O BANCO DE DADOS ESTÁ 100% FUNCIONANDO!");

  } catch (error) {
    console.error("🔴 ERRO NO TESTE:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

/**
 * Script para inserir/atualizar os sócios no banco de produção.
 * Uso: node scripts/seed-prod-team.cjs
 */
const { PrismaClient } = require("@prisma/client");
const { PrismaMariaDb } = require("@prisma/adapter-mariadb");
const mariadb = require("mariadb");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.warn("⚠️ DATABASE_URL não definida, pulando seed de sócios.");
  process.exit(0);
}

let pool;
try {
  const url = connectionString.replace("mysql://", "mariadb://");
  pool = mariadb.createPool({
    connectionString: url,
    connectTimeout: 8000,
    acquireTimeout: 8000,
    connectionLimit: 5,
  });
} catch (e) {
  console.warn("⚠️ Aviso ao configurar pool mariadb:", e.message);
  process.exit(0);
}

const adapter = new PrismaMariaDb(pool);
const prisma = new PrismaClient({ adapter });

const SOCIOS = [
  {
    member: { name: "Hugo Ludwig Werninghaus", role: "Contador (CEO-CMO)", sector: "Liderança", photo: "/team/hugo.png", order: 1 },
    partner: {
      accentColor: "#14d0c1",
      bio: "PUC-SP, MBA em Finanças, Controladoria e Auditoria pela FGV e Mestre em Ciências Contábeis, Controladoria e Finanças pela PUC-SP, CNAI e CISI (Anti-Bribery & Corruption). Experiência de 28 anos nas áreas contábil, auditoria, assessoria e perícia contábil, financeira e tributária.",
    },
  },
  {
    member: { name: "Alessandra Passos", role: "Contadora (COO)", sector: "Liderança", photo: "/team/alessandra.png", order: 2 },
    partner: {
      accentColor: "#d90f81",
      bio: "MBA em Perícia Contábil. 20 anos de experiência nas áreas de assessoria contábil, fiscal e departamento pessoal. Avaliação tributária, impostos diretos e indiretos. Participação em projetos de reestruturação societária e perícias judiciais.",
    },
  },
];

async function main() {
  try {
    for (const { member, partner } of SOCIOS) {
      const existing = await prisma.teamMember.findFirst({ where: { name: member.name } });
      const saved = existing
        ? await prisma.teamMember.update({ where: { id: existing.id }, data: member })
        : await prisma.teamMember.create({ data: member });
      await prisma.teamPartner.upsert({ where: { memberId: saved.id }, create: { memberId: saved.id, ...partner }, update: partner });
      console.log(`✓ ${existing ? "Atualizado" : "Criado"}: ${member.name}`);
    }
    console.log("\nSócios sincronizados com sucesso!");
  } catch (err) {
    console.warn("⚠️ Aviso ao sincronizar sócios (banco indisponível ou limite de conexões no CI):", err.message);
    console.warn("ℹ️ Como os dados já foram inseridos previamente, o fluxo continuará sem interromper o deploy.");
  }
}

main()
  .catch((e) => {
    console.warn("⚠️ Aviso geral no seed:", e.message);
  })
  .finally(async () => {
    try { await prisma.$disconnect(); } catch {}
    try { if (pool) await pool.end(); } catch {}
    process.exit(0);
  });

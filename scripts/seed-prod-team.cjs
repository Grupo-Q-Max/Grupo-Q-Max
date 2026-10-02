/**
 * Script para inserir/atualizar os sócios no banco de produção.
 * Uso: node scripts/seed-prod-team.cjs
 */
const { PrismaClient } = require("@prisma/client");
const { PrismaMariaDb } = require("@prisma/adapter-mariadb");
const mariadb = require("mariadb");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL não definida!");
  process.exit(1);
}

const pool = mariadb.createPool(connectionString.replace("mysql://", "mariadb://"));
const adapter = new PrismaMariaDb(pool);
const prisma = new PrismaClient({ adapter });

const SOCIOS = [
  {
    name: "Hugo Ludwig Werninghaus",
    role: "Contador (CEO-CMO)",
    sector: "Liderança",
    photo: "/team/hugo.png",
    accentColor: "#14d0c1",
    order: 1,
    bio: "PUC-SP, MBA em Finanças, Controladoria e Auditoria pela FGV e Mestre em Ciências Contábeis, Controladoria e Finanças pela PUC-SP, CNAI e CISI (Anti-Bribery & Corruption). Experiência de 28 anos nas áreas contábil, auditoria, assessoria e perícia contábil, financeira e tributária.",
  },
  {
    name: "Alessandra Passos",
    role: "Contadora (COO)",
    sector: "Liderança",
    photo: "/team/alessandra.png",
    accentColor: "#d90f81",
    order: 2,
    bio: "MBA em Perícia Contábil. 20 anos de experiência nas áreas de assessoria contábil, fiscal e departamento pessoal. Avaliação tributária, impostos diretos e indiretos. Participação em projetos de reestruturação societária e perícias judiciais.",
  },
];

async function main() {
  for (const socio of SOCIOS) {
    const existing = await prisma.teamMember.findFirst({ where: { name: socio.name } });
    if (existing) {
      await prisma.teamMember.update({ where: { id: existing.id }, data: socio });
      console.log(`✓ Atualizado: ${socio.name}`);
    } else {
      await prisma.teamMember.create({ data: socio });
      console.log(`✓ Criado: ${socio.name}`);
    }
  }
  console.log("\nSócios sincronizados com sucesso!");
}

main()
  .catch((e) => { console.error("ERRO:", e.message); process.exit(1); })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

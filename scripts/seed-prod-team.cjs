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

/**
 * Backfill (2026-10-19): members still flagged with the legacy TeamMember.showOnSite become partners, copying
 * the site profile that lived on TeamMember. Clearing the flag in the same transaction makes it run once per
 * member, so a partner removed in the admin isn't recreated on the next deploy.
 */
async function backfillPartners() {
  const pending = await prisma.teamMember.findMany({
    where: { showOnSite: true },
    select: { id: true, name: true, accentColor: true, linkedin: true, bio: true },
  });
  for (const m of pending) {
    await prisma.$transaction([
      prisma.teamPartner.upsert({
        where: { memberId: m.id },
        create: { memberId: m.id, accentColor: m.accentColor, linkedin: m.linkedin, bio: m.bio },
        update: {},
      }),
      prisma.teamMember.update({ where: { id: m.id }, data: { showOnSite: false } }),
    ]);
    console.log(`✓ Sócio migrado: ${m.name}`);
  }
}

async function main() {
  await backfillPartners();
  for (const { member, partner } of SOCIOS) {
    const existing = await prisma.teamMember.findFirst({ where: { name: member.name } });
    const saved = existing
      ? await prisma.teamMember.update({ where: { id: existing.id }, data: member })
      : await prisma.teamMember.create({ data: member });
    await prisma.teamPartner.upsert({ where: { memberId: saved.id }, create: { memberId: saved.id, ...partner }, update: partner });
    console.log(`✓ ${existing ? "Atualizado" : "Criado"}: ${member.name}`);
  }
  console.log("\nSócios sincronizados com sucesso!");
}

main()
  .catch((e) => { console.error("ERRO:", e.message); process.exit(1); })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

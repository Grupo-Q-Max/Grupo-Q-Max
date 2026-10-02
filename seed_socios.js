const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.teamMember.create({
    data: {
      name: "Hugo Ludwig Werninghaus",
      role: "Contador (CEO-CMO)",
      photo: "/team/hugo.png",
      bio: "PUC-SP, MBA em Finanças, Controladoria e Auditoria pela FGV e Mestre em Ciências Contábeis, Controladoria e Finanças pela PUC-SP, CNAI e CISI (Anti- Bribery & Corruption). Experiência de 28 anos nas áreas contábil, auditoria, assessoria e perícia contábil, financeira e tributária.",
      order: 1
    }
  });

  await prisma.teamMember.create({
    data: {
      name: "Alessandra Passos",
      role: "Contadora (COO)",
      photo: "/team/alessandra.png",
      bio: "MBA em Perícia Contábil. 20 anos de experiência nas áreas de assessoria contábil, fiscal e departamento pessoal. Avaliação tributária, impostos diretos e indiretos. Participação em projetos de reestruturação societária e perícias judiciais.",
      order: 2
    }
  });

  console.log("Sócios inseridos com sucesso!");
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });

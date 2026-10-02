const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const pipeline = await prisma.crmPipeline.create({
    data: {
      name: "qxback",
      stages: {
        create: [
          { name: "Prospecção", order: 1 },
          { name: "Qualificação", order: 2 },
          { name: "Proposta", order: 3 },
          { name: "Fechamento", order: 4 }
        ]
      }
    }
  });
  console.log("Created pipeline:", pipeline.name);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });

import { CrmButtons } from "@/components/crm/CrmButtons";
import { CrmWorkspace } from "@/components/crm/CrmWorkspace";
import { CrmPipelineSettings } from "@/components/crm/CrmPipelineSettings";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CRMPage() {
  // Fetch pipeline with stages and cards
  let pipeline = await prisma.crmPipeline.findFirst({
    include: {
      stages: {
        orderBy: { order: "asc" },
        include: {
          cards: {
            orderBy: { order: "asc" }
          }
        }
      }
    }
  });

  // Automatically create a default pipeline if none exists yet!
  if (!pipeline) {
    pipeline = await prisma.crmPipeline.create({
      data: {
        name: "Pipeline Comercial Principal",
        stages: {
          create: [
            { name: "Novos Leads", order: 0 },
            { name: "Em Contato", order: 1 },
            { name: "Proposta Enviada", order: 2 },
            { name: "Fechado Ganho", order: 3 }
          ]
        }
      },
      include: {
        stages: {
          orderBy: { order: "asc" },
          include: { cards: true }
        }
      }
    });

    // Create a demo card so the board isn't empty!
    if (pipeline.stages[0]) {
      await prisma.crmCard.create({
        data: {
          title: "Auditoria Fiscal e Tributária",
          company: "TechCorp Brasil S/A",
          value: 45000.00,
          stageId: pipeline.stages[0].id
        }
      });
      // Refresh to include card
      pipeline = await prisma.crmPipeline.findUnique({
        where: { id: pipeline.id },
        include: { stages: { orderBy: { order: "asc" }, include: { cards: { orderBy: { order: "asc" } } } } }
      });
    }
  }

  return (
    <>
      <header className="crm-header">
        <h1 className="crm-header__title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {pipeline?.name || "Pipeline"}
          {pipeline && <CrmPipelineSettings pipeline={pipeline} />}
        </h1>
        <CrmButtons pipeline={pipeline} />
      </header>

      {pipeline && <CrmWorkspace pipeline={{
        ...pipeline,
        stages: pipeline.stages.map(stage => ({
          ...stage,
          cards: stage.cards.map(card => ({
            ...card,
            value: card.value.toNumber()
          }))
        }))
      }} />}
    </>
  );
}

import { CrmButtons } from "@/components/crm/CrmButtons";
import { CrmWorkspace } from "@/components/crm/CrmWorkspace";
import { CrmPipelineSettings } from "@/components/crm/CrmPipelineSettings";
import { PipelineSelector } from "@/components/crm/PipelineSelector";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CRMPage({ searchParams }: { searchParams: { pipelineId?: string } }) {
  const allPipelines = await prisma.crmPipeline.findMany({
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' }
  });
  let pipeline = await prisma.crmPipeline.findFirst({
    where: searchParams.pipelineId ? { id: searchParams.pipelineId } : undefined,
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

    if (pipeline.stages[0]) {
      await prisma.crmCard.create({
        data: {
          title: "Auditoria Fiscal e Tributária",
          company: "TechCorp Brasil S/A",
          value: 45000.00,
          stageId: pipeline.stages[0].id
        }
      });
      pipeline = await prisma.crmPipeline.findUnique({
        where: { id: pipeline.id },
        include: { stages: { orderBy: { order: "asc" }, include: { cards: { orderBy: { order: "asc" } } } } }
      });
    }
    
    // Add to allPipelines list so dropdown works immediately
    if (pipeline) {
      allPipelines.push({ id: pipeline.id, name: pipeline.name });
    }
  }

  return (
    <>
      <header className="crm-header">
        <h1 className="crm-header__title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <PipelineSelector pipelines={allPipelines} currentPipelineId={pipeline?.id || ""} />
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

import Link from "next/link";
import { Zap } from "lucide-react";
import { CrmButtons } from "@/components/crm/CrmButtons";
import { CrmWorkspace } from "@/components/crm/CrmWorkspace";
import { CrmPipelineSettings } from "@/components/crm/CrmPipelineSettings";
import { PipelineSelector } from "@/components/crm/PipelineSelector";
import { prisma } from "@/lib/prisma";
import { cardListInclude, serializeListCard } from "@/lib/crm-deal";

const pipelineInclude = {
  stages: {
    orderBy: { order: "asc" as const },
    include: { cards: { orderBy: { order: "asc" as const }, include: cardListInclude } },
  },
};

async function createDefaultPipeline() {
  return prisma.crmPipeline.create({
    data: {
      name: "Pipeline Comercial Principal",
      stages: {
        create: [
          { name: "Novos Leads", order: 0 },
          { name: "Em Contato", order: 1 },
          { name: "Proposta Enviada", order: 2 },
          { name: "Fechado Ganho", order: 3 },
        ],
      },
    },
  });
}

/**
 * The CRM board (header + kanban/list/activities). Rendered by /crm and by
 * /crm/deal/details/[number], which opens the deal panel over the board.
 */
export async function CrmBoardPage({ pipelineId, openDealId }: { pipelineId?: string; openDealId?: string }) {
  let pipelines = await prisma.crmPipeline.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true } });
  if (pipelines.length === 0) {
    const created = await createDefaultPipeline();
    pipelines = [{ id: created.id, name: created.name }];
  }

  // Selected pipeline, falling back to the first one
  const selectedId = pipelines.find((p) => p.id === pipelineId)?.id ?? pipelines[0].id;
  const pipeline = await prisma.crmPipeline.findUniqueOrThrow({ where: { id: selectedId }, include: pipelineInclude });

  // Serialize Decimal/relations so the pipeline can be passed to Client Components
  const serializedPipeline = {
    ...pipeline,
    stages: pipeline.stages.map((stage) => ({ ...stage, cards: stage.cards.map(serializeListCard) })),
  };

  return (
    <>
      <header className="crm-header">
        <h1 className="crm-header__title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {pipelines.length > 1 ? (
            <PipelineSelector pipelines={pipelines} currentPipelineId={pipeline.id} />
          ) : (
            pipeline.name
          )}
          <CrmPipelineSettings pipeline={serializedPipeline} />
          <Link
            href={`/crm/automation/${pipeline.id}`}
            className="btn-secondary"
            style={{ padding: '8px 12px', fontSize: '13px', whiteSpace: 'nowrap', textDecoration: 'none', background: 'transparent', borderColor: 'rgba(255,255,255,0.1)' }}
            title="Regras de automação e gatilhos"
          >
            <Zap size={16} /> Regras de automação
          </Link>
        </h1>
        <CrmButtons pipeline={serializedPipeline} />
      </header>

      <CrmWorkspace key={pipeline.id} pipeline={serializedPipeline} initialDealId={openDealId} />
    </>
  );
}

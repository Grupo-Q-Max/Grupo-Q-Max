import Link from "next/link";
import { cookies } from "next/headers";
import { Zap } from "lucide-react";
import { CrmButtons } from "@/components/crm/CrmButtons";
import { CrmWorkspace } from "@/components/crm/CrmWorkspace";
import { CrmPipelineRename, CrmPipelineSettings } from "@/components/crm/CrmPipelineSettings";
import { prisma } from "@/lib/prisma";
import { currentPermissions, visiblePipelineWhere } from "@/lib/crm-access";
import { isQxbackStage } from "@/lib/crm-qxback";
import { readSession, SESSION_COOKIE } from "@/lib/auth";
import { activeCard, cardListInclude, serializeListCard } from "@/lib/crm-deal";

const pipelineInclude = {
  stages: {
    orderBy: { order: "asc" as const },
    include: { cards: { where: activeCard, orderBy: { order: "asc" as const }, include: cardListInclude } },
  },
  groups: { select: { groupId: true } },
  members: { select: { memberId: true } },
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
  const can = await currentPermissions();
  if ((await prisma.crmPipeline.count()) === 0) await createDefaultPipeline();
  const visible = await visiblePipelineWhere();

  // Selected pipeline when visible, else the first visible one (same order as the sidebar)
  const pipeline =
    (pipelineId && (await prisma.crmPipeline.findFirst({ where: { id: pipelineId, ...visible }, include: pipelineInclude }))) ||
    (await prisma.crmPipeline.findFirst({
      where: visible,
      orderBy: [{ space: { order: "asc" } }, { order: "asc" }, { createdAt: "asc" }],
      include: pipelineInclude,
    }));
  if (!pipeline) {
    return (
      <header className="crm-header">
        <h1 className="crm-header__title">Nenhum pipeline disponível para o seu grupo.</h1>
      </header>
    );
  }
  const qxback = pipeline.stages.some((stage) => isQxbackStage(stage.id));
  // Choices for the pipeline settings and the "Criar Pipeline" modal
  const [spaces, groups, members] = await Promise.all([
    prisma.crmSpace.findMany({ orderBy: { order: "asc" }, select: { id: true, name: true } }),
    can.has("pipeline.edit") ? prisma.crmGroup.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, isAdmin: true } }) : [],
    can.has("pipeline.edit")
      ? prisma.teamMember.findMany({ where: { crmActive: true, email: { not: null } }, orderBy: { name: "asc" }, select: { id: true, name: true, role: true } })
      : [],
  ]);

  // Serialize Decimal/relations so the pipeline can be passed to Client Components
  const serializedPipeline = {
    ...pipeline,
    stages: pipeline.stages.map((stage) => ({ ...stage, cards: stage.cards.map(serializeListCard) })),
  };

  const title = pipeline.name;

  return (
    <>
      <header className="crm-header">
        <h1 className="crm-header__title crm-header__title--board">
          {can.has("pipeline.edit") ? (
            <CrmPipelineRename pipeline={{ id: pipeline.id, name: pipeline.name }}>{title}</CrmPipelineRename>
          ) : (
            title
          )}
          {qxback && (
            <span className="crm-badge" title="Recebe e envia negócios do programa de indicações QXBACK">
              Integrado QXBACK
            </span>
          )}
          {can.has("pipeline.edit") && <CrmPipelineSettings pipeline={serializedPipeline} options={{ spaces, groups, members }} />}
          {can.has("automation.view") && (
            <Link
              href={`/crm/automation/${pipeline.id}`}
              className="btn-secondary"
              style={{ padding: '8px 12px', fontSize: '13px', whiteSpace: 'nowrap', textDecoration: 'none', background: 'transparent', borderColor: 'rgba(255,255,255,0.1)' }}
              title="Regras de automação e gatilhos"
            >
              <Zap size={16} /> <span className="crm-hide-mobile">Regras de automação</span>
            </Link>
          )}
        </h1>
        <CrmButtons pipeline={serializedPipeline} spaces={spaces} currentMemberId={readSession((await cookies()).get(SESSION_COOKIE)?.value)} />
      </header>

      <CrmWorkspace key={pipeline.id} pipeline={serializedPipeline} initialDealId={openDealId} />
    </>
  );
}

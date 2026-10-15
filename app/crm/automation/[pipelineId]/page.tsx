import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { boardAutomations } from "@/lib/crm-automation";
import { currentPermissions, visiblePipelineWhere } from "@/lib/crm-access";
import { CrmForbidden } from "@/components/crm/CrmForbidden";
import { CrmAutomationBoard } from "@/components/crm/automation/CrmAutomationBoard";
import type { AutomationStage, CustomField } from "@/components/crm/automation/types";

export const dynamic = "force-dynamic";

/** /crm/automation/<pipelineId> — "Regras de automação e gatilhos" of a pipeline (like Bitrix24). */
export default async function AutomationPage({ params }: { params: Promise<{ pipelineId: string }> }) {
  const { pipelineId } = await params;
  if (!(await currentPermissions()).has("automation.view")) return <CrmForbidden />;
  const visible = await visiblePipelineWhere();

  const [pipeline, pipelines, members] = await Promise.all([
    prisma.crmPipeline.findFirst({
      where: { id: pipelineId, ...visible },
      include: {
        stages: {
          orderBy: { order: "asc" },
          include: {
            automations: boardAutomations,
            triggers: { orderBy: { order: "asc" }, include: { conditions: { orderBy: { order: "asc" } } } },
          },
        },
      },
    }),
    prisma.crmPipeline.findMany({ where: visible, orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
    prisma.teamMember.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);
  if (!pipeline) notFound();

  // Dates and JSON columns → plain values for the client component
  const stages = JSON.parse(JSON.stringify(pipeline.stages)) as AutomationStage[];
  const customFields = (Array.isArray(pipeline.fieldsConfig) ? pipeline.fieldsConfig : []) as CustomField[];

  return (
    <CrmAutomationBoard
      key={pipeline.id}
      pipeline={{ id: pipeline.id, name: pipeline.name }}
      pipelines={pipelines}
      initialStages={stages}
      customFields={customFields}
      members={members}
    />
  );
}

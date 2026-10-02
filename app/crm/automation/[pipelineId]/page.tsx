import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CrmAutomationBoard } from "@/components/crm/automation/CrmAutomationBoard";
import type { AutomationStage, CustomField } from "@/components/crm/automation/types";

export const dynamic = "force-dynamic";

/** /crm/automation/<pipelineId> — "Regras de automação e gatilhos" of a pipeline (like Bitrix24). */
export default async function AutomationPage({ params }: { params: Promise<{ pipelineId: string }> }) {
  const { pipelineId } = await params;

  const [pipeline, pipelines, members] = await Promise.all([
    prisma.crmPipeline.findUnique({
      where: { id: pipelineId },
      include: {
        stages: {
          orderBy: { order: "asc" },
          include: {
            automations: {
              orderBy: { order: "asc" },
              include: {
                headers: { orderBy: { order: "asc" } },
                conditions: { orderBy: { order: "asc" } },
                activity: true,
                dealUpdate: true,
                notify: true,
              },
            },
            triggers: { orderBy: { order: "asc" }, include: { conditions: { orderBy: { order: "asc" } } } },
          },
        },
      },
    }),
    prisma.crmPipeline.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
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

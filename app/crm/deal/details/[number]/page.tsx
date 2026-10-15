import { notFound } from "next/navigation";
import { CrmBoardPage } from "@/components/crm/CrmBoardPage";
import { prisma } from "@/lib/prisma";
import { visiblePipelineWhere } from "@/lib/crm-access";

export const dynamic = "force-dynamic";

/** /crm/deal/details/<number> — the board with the deal panel open (like Bitrix24). */
export default async function DealDetailsPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const dealNumber = Number(number);
  if (!Number.isInteger(dealNumber) || dealNumber <= 0) notFound();

  const deal = await prisma.crmCard.findFirst({
    where: { number: dealNumber, stage: { pipeline: await visiblePipelineWhere() } },
    select: { id: true, stage: { select: { pipelineId: true } } },
  });
  if (!deal) notFound();

  return <CrmBoardPage pipelineId={deal.stage.pipelineId} openDealId={deal.id} />;
}

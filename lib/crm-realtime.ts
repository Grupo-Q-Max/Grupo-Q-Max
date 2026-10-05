import { prisma } from "@/lib/prisma";
import { publish, subscribe } from "@/lib/realtime";

export type PipelineChangedEvent = { type: "pipeline.changed"; pipelineId: string };

const pipelineChannel = (pipelineId: string) => `crm:pipeline:${pipelineId}`;

export function notifyPipelineChanged(pipelineId: string) {
  publish<PipelineChangedEvent>(pipelineChannel(pipelineId), { type: "pipeline.changed", pipelineId });
}

export async function notifyStageChanged(stageId: string) {
  const stage = await prisma.crmStage.findUnique({ where: { id: stageId }, select: { pipelineId: true } });
  if (stage) notifyPipelineChanged(stage.pipelineId);
}

export function subscribeToPipeline(pipelineId: string, handler: (event: PipelineChangedEvent) => void) {
  return subscribe<PipelineChangedEvent>(pipelineChannel(pipelineId), handler);
}

export type MemberNotifiedEvent = { type: "member.notified"; memberId: string };

const memberChannel = (memberId: string) => `crm:member:${memberId}`;

/** Tells the member's open CRM tabs that they got a new notification. */
export function notifyMember(memberId: string) {
  publish<MemberNotifiedEvent>(memberChannel(memberId), { type: "member.notified", memberId });
}

export function subscribeToMember(memberId: string, handler: (event: MemberNotifiedEvent) => void) {
  return subscribe<MemberNotifiedEvent>(memberChannel(memberId), handler);
}

import { prisma } from "@/lib/prisma";
import { pipelineWhereFor } from "@/lib/crm-access";
import { notifyMember } from "@/lib/crm-realtime";
import { findMentions } from "@/lib/crm-mentions";

/**
 * Bell notification about a card for each member, except the author and members who are
 * blocked or can't see the card's pipeline. Call after the change is committed.
 */
async function notifyAboutCard(cardId: string, memberIds: string[], message: string, authorId: string | null) {
  for (const memberId of new Set(memberIds)) {
    if (memberId === authorId) continue;
    const sees = await prisma.crmCard.count({
      where: { id: cardId, stage: { pipeline: await pipelineWhereFor(memberId) } },
    });
    if (!sees) continue;
    await prisma.crmNotification.create({ data: { memberId, cardId, message } });
    notifyMember(memberId);
  }
}

const authorName = async (authorId: string | null) =>
  (authorId && (await prisma.teamMember.findUnique({ where: { id: authorId }, select: { name: true } }))?.name) || "Alguém";

/** Notifies the members mentioned as "@Full Name" in a comment of the card. */
export async function notifyMentions(cardId: string, text: string, authorId: string | null) {
  if (!text.includes("@")) return;
  const members = await prisma.teamMember.findMany({ where: { crmActive: true }, select: { id: true, name: true } });
  const ids = findMentions(text, members);
  if (!ids.length) return;
  const card = await prisma.crmCard.findUnique({ where: { id: cardId }, select: { number: true, title: true } });
  if (!card) return;
  await notifyAboutCard(cardId, ids, `${await authorName(authorId)} mencionou você em #${card.number} "${card.title}"`, authorId);
}

/** Tells the new responsible that the card was assigned to them (not when they assigned themselves). */
export async function notifyAssigned(cardId: string, authorId: string | null) {
  const card = await prisma.crmCard.findUnique({
    where: { id: cardId },
    select: { number: true, title: true, responsibleId: true, stage: { select: { pipeline: { select: { kind: true } } } } },
  });
  if (!card?.responsibleId) return;
  const what = card.stage.pipeline.kind === "TASKS" ? "a tarefa" : "o negócio";
  await notifyAboutCard(cardId, [card.responsibleId], `${await authorName(authorId)} atribuiu a você ${what} #${card.number} "${card.title}"`, authorId);
}

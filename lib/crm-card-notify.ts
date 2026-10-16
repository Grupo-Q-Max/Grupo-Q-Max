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

/**
 * Notifies the members mentioned as "@Full Name" in a comment of the card. On an edit, pass the old
 * text: only members it did not mention yet are notified. Returns the ids of the mentioned members.
 */
export async function notifyMentions(cardId: string, text: string, authorId: string | null, previousText = "") {
  if (!text.includes("@")) return [];
  const members = await prisma.teamMember.findMany({ where: { crmActive: true }, select: { id: true, name: true } });
  const before = new Set(findMentions(previousText, members));
  const ids = findMentions(text, members).filter((id) => !before.has(id));
  if (!ids.length) return [];
  const card = await prisma.crmCard.findUnique({ where: { id: cardId }, select: { number: true, title: true } });
  if (!card) return [];
  await notifyAboutCard(cardId, ids, `${await authorName(authorId)} mencionou você em #${card.number} "${card.title}"`, authorId);
  return ids;
}

/**
 * Tells the card's observers and responsible about a change (new comment, column move), except
 * `skip` (e.g. members already notified by a mention). `message` gets the author's name and "#12 "title"".
 */
export async function notifyWatchers(cardId: string, authorId: string | null, message: (author: string, card: string) => string, skip: string[] = []) {
  const card = await prisma.crmCard.findUnique({
    where: { id: cardId },
    select: { number: true, title: true, responsibleId: true, observers: { select: { memberId: true } } },
  });
  if (!card) return;
  const ids = [card.responsibleId, ...card.observers.map((o) => o.memberId)].filter((id): id is string => !!id && !skip.includes(id));
  if (!ids.length) return;
  await notifyAboutCard(cardId, ids, message(await authorName(authorId), `#${card.number} "${card.title}"`), authorId);
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

/** Tells the card's observers and responsible that it moved to another column. */
export async function notifyMoved(cardId: string, stageId: string, authorId: string | null) {
  const stage = await prisma.crmStage.findUnique({ where: { id: stageId }, select: { name: true } });
  if (stage) await notifyWatchers(cardId, authorId, (author, card) => `${author} moveu ${card} para "${stage.name}"`);
}

import { prisma } from "@/lib/prisma";
import { cardWhereFor, pipelineWhereFor } from "@/lib/crm-access";
import { notifyMember } from "@/lib/crm-realtime";
import { findMentions } from "@/lib/crm-mentions";

/**
 * Bell notification about a card for each member, except the author and members who are
 * blocked or can't see the card (its pipeline, or the card itself when private). Call after the change is committed.
 */
async function notifyAboutCard(cardId: string, memberIds: string[], message: string, authorId: string | null) {
  for (const memberId of new Set(memberIds)) {
    if (memberId === authorId) continue;
    const sees = await prisma.crmCard.count({
      where: { id: cardId, stage: { pipeline: await pipelineWhereFor(memberId) }, ...(await cardWhereFor(memberId)) },
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
 * Tells the card's observers, responsible and co-assignees about a change (new comment, column move), except
 * `skip` (e.g. members already notified by a mention). `message` gets the author's name and "#12 "title"".
 */
export async function notifyWatchers(cardId: string, authorId: string | null, message: (author: string, card: string) => string, skip: string[] = []) {
  const card = await prisma.crmCard.findUnique({
    where: { id: cardId },
    select: { number: true, title: true, responsibleId: true, observers: { select: { memberId: true } }, assignees: { select: { memberId: true } } },
  });
  if (!card) return;
  const ids = [card.responsibleId, ...card.assignees.map((a) => a.memberId), ...card.observers.map((o) => o.memberId)].filter((id): id is string => !!id && !skip.includes(id));
  if (!ids.length) return;
  await notifyAboutCard(cardId, ids, message(await authorName(authorId), `#${card.number} "${card.title}"`), authorId);
}

/**
 * Tells whoever may fix automation rules (admins and the "automation.edit" permission) that a rule
 * failed for good on a card. A member who still has an unread failure of the same rule is not
 * notified again, so a broken rule on many cards doesn't flood the bell.
 */
export async function notifyRuleFailed(cardId: string, ruleName: string, error: string | null) {
  const editors = { OR: [{ isAdmin: true }, { permissions: { some: { permission: "automation.edit" } } }] };
  const defaultEdits = await prisma.crmGroup.count({ where: { isDefault: true, ...editors } });
  const prefix = `A automação "${ruleName}" falhou`;
  const members = await prisma.teamMember.findMany({
    where: {
      crmActive: true,
      OR: [{ crmGroup: editors }, ...(defaultEdits ? [{ crmGroupId: null }] : [])],
      notifications: { none: { readAt: null, message: { startsWith: prefix } } },
    },
    select: { id: true },
  });
  if (!members.length) return;
  const card = await prisma.crmCard.findUnique({ where: { id: cardId }, select: { number: true, title: true } });
  if (!card) return;
  const reason = error ? `: ${error.slice(0, 160)}` : "";
  await notifyAboutCard(cardId, members.map((m) => m.id), `${prefix} em #${card.number} "${card.title}"${reason}`, null);
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

/**
 * After a card is done (WON): tells the observers and responsible of each card it was blocking
 * that has no other open blocker left. No-op when the card is not WON, so callers can run it
 * after any status change.
 */
export async function notifyUnblocked(cardId: string, authorId: string | null) {
  const card = await prisma.crmCard.findUnique({
    where: { id: cardId },
    select: {
      number: true,
      title: true,
      status: true,
      blocks: {
        where: { card: { status: "OPEN", archivedAt: null, isTemplate: false, blockedBy: { none: { blockedBy: { status: "OPEN" } } } } },
        select: { cardId: true },
      },
    },
  });
  if (card?.status !== "WON") return;
  for (const { cardId: blockedId } of card.blocks) {
    await notifyWatchers(blockedId, authorId, (author, blocked) => `${blocked} foi desbloqueada: ${author} concluiu #${card.number} "${card.title}"`);
  }
}

/** Tells the members added as co-assignees ("Corresponsáveis") that the card was assigned to them. */
export async function notifyNewAssignees(cardId: string, before: string[], authorId: string | null) {
  const card = await prisma.crmCard.findUnique({
    where: { id: cardId },
    select: { number: true, title: true, assignees: { select: { memberId: true } }, stage: { select: { pipeline: { select: { kind: true } } } } },
  });
  const added = card?.assignees.map((a) => a.memberId).filter((id) => !before.includes(id)) ?? [];
  if (!card || !added.length) return;
  const where = card.stage.pipeline.kind === "TASKS" ? "na tarefa" : "no negócio";
  await notifyAboutCard(cardId, added, `${await authorName(authorId)} adicionou você como corresponsável ${where} #${card.number} "${card.title}"`, authorId);
}

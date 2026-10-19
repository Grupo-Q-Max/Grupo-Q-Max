import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatMinutes } from "@/components/crm/deal/types";
import { DealValidationError } from "@/lib/crm-deal";
import { fireTriggers } from "@/lib/crm-automation";

type Tx = Prisma.TransactionClient;

/** Whole minutes between two instants (a running timer counts from start to now). */
export const elapsedMinutes = (startedAt: Date, endedAt: Date) => Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 60_000));

/**
 * Re-caches CrmCard.spentMinutes as the sum of its finished entries and records the change in the
 * card history (by `actorId`). Returns the stage, so the caller can refresh the open boards; a card whose
 * time just went past its estimate is added to `exceeded` (the ESTIMATE_EXCEEDED trigger, see withTriggers).
 */
async function syncSpent(tx: Tx, cardId: string, actorId: string | null, exceeded: string[]) {
  const [card, sum] = await Promise.all([
    tx.crmCard.findUniqueOrThrow({ where: { id: cardId }, select: { spentMinutes: true, estimateMinutes: true, stageId: true } }),
    tx.crmTimeEntry.aggregate({ where: { cardId, endedAt: { not: null } }, _sum: { minutes: true } }),
  ]);
  const spent = sum._sum.minutes ?? null;
  const estimate = card.estimateMinutes;
  if (estimate != null && (card.spentMinutes ?? 0) <= estimate && (spent ?? 0) > estimate) exceeded.push(cardId);
  if (spent !== card.spentMinutes) {
    await tx.crmCard.update({
      where: { id: cardId },
      data: {
        spentMinutes: spent,
        history: {
          create: {
            type: "FIELD_CHANGED",
            data: { field: "spentMinutes", label: "Tempo gasto", from: formatMinutes(card.spentMinutes), to: formatMinutes(spent) },
            actorId,
          },
        },
      },
    });
  }
  return card.stageId;
}

/**
 * spentMinutes typed by hand before the timer existed has no entries: turn it into one (no member)
 * before the first entry, so the new sum doesn't drop it.
 */
async function keepLegacySpent(tx: Tx, cardId: string) {
  const card = await tx.crmCard.findUniqueOrThrow({ where: { id: cardId }, select: { spentMinutes: true, updatedAt: true, _count: { select: { timeEntries: true } } } });
  if (!card.spentMinutes || card._count.timeEntries) return;
  await tx.crmTimeEntry.create({ data: { cardId, startedAt: card.updatedAt, endedAt: card.updatedAt, minutes: card.spentMinutes } });
}

/** Stops the member's running timer (on any card). Returns the stages of the cards touched. */
async function stopRunning(tx: Tx, memberId: string, now: Date, exceeded: string[]) {
  const running = await tx.crmTimeEntry.findMany({ where: { memberId, endedAt: null }, select: { id: true, cardId: true, startedAt: true } });
  const stages: string[] = [];
  for (const entry of running) {
    // Conditional claim: a concurrent stop of the same entry doesn't count it twice
    const { count } = await tx.crmTimeEntry.updateMany({
      where: { id: entry.id, endedAt: null },
      data: { endedAt: now, minutes: elapsedMinutes(entry.startedAt, now) },
    });
    if (count) stages.push(await syncSpent(tx, entry.cardId, memberId, exceeded));
  }
  return stages;
}

/**
 * Runs a time change in a transaction, then fires ESTIMATE_EXCEEDED for the cards whose time crossed their
 * estimate (after the commit, so the trigger sees the new time). Returns the stages touched.
 */
async function withTriggers(change: (tx: Tx, exceeded: string[]) => Promise<string[]>) {
  const exceeded: string[] = [];
  const stages = await prisma.$transaction((tx) => change(tx, exceeded));
  for (const cardId of exceeded) await fireTriggers(cardId, { type: "ESTIMATE_EXCEEDED" });
  return stages;
}

/** Starts the member's timer on a card, stopping the one running elsewhere first (one timer per person). */
export function startTimer(memberId: string, cardId: string) {
  return withTriggers(async (tx, exceeded) => {
    const now = new Date();
    const stages = await stopRunning(tx, memberId, now, exceeded);
    await keepLegacySpent(tx, cardId);
    await tx.crmTimeEntry.create({ data: { cardId, memberId, startedAt: now } });
    const card = await tx.crmCard.findUniqueOrThrow({ where: { id: cardId }, select: { stageId: true } });
    return [...stages, card.stageId];
  });
}

export function stopTimer(memberId: string) {
  return withTriggers((tx, exceeded) => stopRunning(tx, memberId, new Date(), exceeded));
}

/** Time typed by hand ("Registrar tempo"): a finished entry ending now. */
export function logTime(memberId: string, cardId: string, minutes: number) {
  if (!Number.isInteger(minutes) || minutes <= 0 || minutes > 24 * 60) throw new DealValidationError("Informe de 1 minuto a 24 horas.");
  return withTriggers(async (tx, exceeded) => {
    await keepLegacySpent(tx, cardId);
    const now = new Date();
    await tx.crmTimeEntry.create({ data: { cardId, memberId, startedAt: new Date(now.getTime() - minutes * 60_000), endedAt: now, minutes } });
    return [await syncSpent(tx, cardId, memberId, exceeded)];
  });
}

/** Deletes an entry: its author or an admin only. */
export function deleteEntry(id: string, memberId: string, isAdmin: boolean) {
  return withTriggers(async (tx, exceeded) => {
    const entry = await tx.crmTimeEntry.findUnique({ where: { id }, select: { cardId: true, memberId: true } });
    if (!entry) return [];
    if (entry.memberId !== memberId && !isAdmin) throw new DealValidationError("Só quem registrou o tempo (ou um administrador) pode excluí-lo.");
    await tx.crmTimeEntry.delete({ where: { id } });
    return [await syncSpent(tx, entry.cardId, memberId, exceeded)];
  });
}

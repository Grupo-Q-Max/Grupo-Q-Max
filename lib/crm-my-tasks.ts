import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyMember } from "@/lib/crm-realtime";
import { ACTIVITY_LABELS } from "@/components/crm/deal/types";
import { dueState, todayKey } from "@/lib/crm-due";

/** End of a Brazilian day, so date-only closeDates sort among activity deadlines of that day. */
const endOfDay = (day: string) => new Date(`${day}T23:59:59.999-03:00`);

export type MyTaskItem = {
  key: string;
  kind: "card" | "activity";
  label: string;
  title: string;
  /** Pipeline / stage for cards, parent deal for activities */
  context: string;
  number: number;
  due: string | null;
  dateOnly: boolean;
};

/**
 * /crm/me — open cards the member is responsible for and their pending activities with a
 * deadline, in pipelines they can see, soonest due first (cards without closeDate last).
 */
export async function listMyTasks(memberId: string, visible: Prisma.CrmPipelineWhereInput) {
  // ponytail: no pagination; add when someone owns more than a few hundred open items
  const [cards, activities] = await Promise.all([
    prisma.crmCard.findMany({
      where: { responsibleId: memberId, status: "OPEN", stage: { pipeline: visible } },
      take: 500,
      select: { id: true, number: true, title: true, closeDate: true, stage: { select: { name: true, pipeline: { select: { name: true, kind: true } } } } },
    }),
    prisma.crmActivity.findMany({
      where: { responsibleId: memberId, completed: false, type: { not: "COMMENT" }, deadline: { not: null }, card: { stage: { pipeline: visible } } },
      take: 500,
      select: { id: true, type: true, title: true, deadline: true, card: { select: { number: true, title: true } } },
    }),
  ]);

  const items: (MyTaskItem & { sort: number })[] = [
    ...cards.map((c) => ({
      key: `c${c.id}`,
      kind: "card" as const,
      label: c.stage.pipeline.kind === "TASKS" ? "Tarefa" : "Negócio",
      title: c.title,
      context: `${c.stage.pipeline.name} · ${c.stage.name}`,
      number: c.number,
      due: c.closeDate?.toISOString() ?? null,
      dateOnly: true,
      sort: c.closeDate ? endOfDay(c.closeDate.toISOString().slice(0, 10)).getTime() : Infinity,
    })),
    ...activities.map((a) => ({
      key: `a${a.id}`,
      kind: "activity" as const,
      label: ACTIVITY_LABELS[a.type],
      title: a.title,
      context: `#${a.card.number} ${a.card.title}`,
      number: a.card.number,
      due: a.deadline!.toISOString(),
      dateOnly: false,
      sort: a.deadline!.getTime(),
    })),
  ];
  return items.sort((a, b) => a.sort - b.sort).map(({ sort: _, ...item }) => item);
}

/**
 * Notifies the responsible once per task card (TASKS pipelines, by closeDate) and per pending
 * activity (by deadline) that is due today or overdue. `remindedFor` keeps the date already
 * reminded: a new date gets a new reminder, and the conditional claim makes the ticker and the
 * external cron safe to overlap.
 */
export async function remindDueTasks(limit = 100) {
  const today = todayKey();
  const cardCutoff = new Date(`${today}T00:00:00Z`); // closeDate is a DATE stored at UTC midnight
  const activityCutoff = endOfDay(today);
  const cardPending = { OR: [{ remindedFor: null }, { remindedFor: { not: { equals: prisma.crmCard.fields.closeDate } } }] } satisfies Prisma.CrmCardWhereInput;
  const activityPending = { OR: [{ remindedFor: null }, { remindedFor: { not: { equals: prisma.crmActivity.fields.deadline } } }] } satisfies Prisma.CrmActivityWhereInput;

  const [cards, activities] = await Promise.all([
    prisma.crmCard.findMany({
      where: {
        ...cardPending,
        status: "OPEN",
        closeDate: { lte: cardCutoff },
        responsible: { crmActive: true },
        stage: { pipeline: { kind: "TASKS" } },
      },
      take: limit,
      select: { id: true, number: true, title: true, closeDate: true, responsibleId: true },
    }),
    prisma.crmActivity.findMany({
      where: {
        ...activityPending,
        completed: false,
        type: { not: "COMMENT" },
        deadline: { lte: activityCutoff },
        responsible: { crmActive: true },
      },
      take: limit,
      select: { id: true, type: true, title: true, deadline: true, cardId: true, responsibleId: true, card: { select: { number: true } } },
    }),
  ]);

  const reminders = [
    ...cards.map((c) => ({
      memberId: c.responsibleId!,
      cardId: c.id,
      message: `Tarefa #${c.number} "${c.title}" ${dueState(c.closeDate, true) === "overdue" ? "está atrasada" : "vence hoje"}`,
      claim: (tx: Prisma.TransactionClient) =>
        tx.crmCard.updateMany({ where: { id: c.id, closeDate: c.closeDate, ...cardPending }, data: { remindedFor: c.closeDate } }),
    })),
    ...activities.map((a) => ({
      memberId: a.responsibleId!,
      cardId: a.cardId,
      message: `${ACTIVITY_LABELS[a.type]} "${a.title}" (negócio #${a.card.number}) ${dueState(a.deadline, false) === "overdue" ? "está atrasada" : "vence hoje"}`,
      claim: (tx: Prisma.TransactionClient) =>
        tx.crmActivity.updateMany({ where: { id: a.id, deadline: a.deadline, ...activityPending }, data: { remindedFor: a.deadline } }),
    })),
  ];

  let sent = 0;
  for (const { claim, ...notification } of reminders) {
    const created = await prisma.$transaction(async (tx) => {
      if (!(await claim(tx)).count) return false;
      await tx.crmNotification.create({ data: notification });
      return true;
    });
    if (!created) continue;
    notifyMember(notification.memberId);
    sent++;
  }
  return sent;
}

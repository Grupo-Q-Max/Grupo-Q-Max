import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyMember } from "@/lib/crm-realtime";
import { ACTIVITY_LABELS } from "@/components/crm/deal/types";
import { dueAt, dueState, todayKey } from "@/lib/crm-due";
import { escapeHtml, sendMail } from "@/lib/mail";
import { activeCard } from "@/lib/crm-deal";

/** End of a Brazilian day, so date-only closeDates sort among activity deadlines of that day. */
const endOfDay = (day: string) => new Date(`${day}T23:59:59.999-03:00`);

export type MyTaskItem = {
  key: string;
  kind: "card" | "activity";
  label: string;
  title: string;
  /** Pipeline / stage for cards, parent deal for activities */
  context: string;
  /** Pipeline name (of the parent card for activities), for the filters */
  pipeline: string;
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
      where: { responsibleId: memberId, status: "OPEN", ...activeCard, stage: { pipeline: visible } },
      take: 500,
      select: { id: true, number: true, title: true, closeDate: true, dueTime: true, stage: { select: { name: true, pipeline: { select: { name: true, kind: true } } } } },
    }),
    prisma.crmActivity.findMany({
      where: { responsibleId: memberId, completed: false, type: { not: "COMMENT" }, deadline: { not: null }, card: { ...activeCard, stage: { pipeline: visible } } },
      take: 500,
      select: { id: true, type: true, title: true, deadline: true, card: { select: { number: true, title: true, stage: { select: { pipeline: { select: { name: true } } } } } } },
    }),
  ]);

  const items: (MyTaskItem & { sort: number })[] = [
    ...cards.map((c) => ({
      key: `c${c.id}`,
      kind: "card" as const,
      label: c.stage.pipeline.kind === "TASKS" ? "Tarefa" : "Negócio",
      title: c.title,
      context: `${c.stage.pipeline.name} · ${c.stage.name}`,
      pipeline: c.stage.pipeline.name,
      number: c.number,
      // With a due time the card is due at that instant, like an activity deadline
      due: c.closeDate ? (c.dueTime ? dueAt(c.closeDate, c.dueTime) : c.closeDate).toISOString() : null,
      dateOnly: !c.dueTime,
      sort: c.closeDate ? dueAt(c.closeDate, c.dueTime).getTime() : Infinity,
    })),
    ...activities.map((a) => ({
      key: `a${a.id}`,
      kind: "activity" as const,
      label: ACTIVITY_LABELS[a.type],
      title: a.title,
      context: `#${a.card.number} ${a.card.title}`,
      pipeline: a.card.stage.pipeline.name,
      number: a.card.number,
      due: a.deadline!.toISOString(),
      dateOnly: false,
      sort: a.deadline!.getTime(),
    })),
  ];
  return items.sort((a, b) => a.sort - b.sort).map(({ sort: _, ...item }) => item);
}

const appBase = () => (process.env.APP_URL || "https://qmaxbrasil.com.br").replace(/\/+$/, "");

/**
 * Notifies the responsible (bell + e-mail) once per task card (TASKS pipelines, by closeDate) and per pending
 * activity (by deadline) that is due today or overdue, and once per task card due tomorrow. `remindedFor`
 * (`dueSoonRemindedFor` for the day-before notice) keeps the date already reminded: a new date gets a new
 * reminder, and the conditional claim makes the ticker and the external cron safe to overlap. Task cards with a
 * due time and `reminderMinutes` also get a notice that many minutes before (`timeRemindedFor` = that instant).
 */
export async function remindDueTasks(limit = 100) {
  const today = todayKey();
  const cardCutoff = new Date(`${today}T00:00:00Z`); // closeDate is a DATE stored at UTC midnight
  const activityCutoff = endOfDay(today);
  const cardPending = { OR: [{ remindedFor: null }, { remindedFor: { not: { equals: prisma.crmCard.fields.closeDate } } }] } satisfies Prisma.CrmCardWhereInput;
  const activityPending = { OR: [{ remindedFor: null }, { remindedFor: { not: { equals: prisma.crmActivity.fields.deadline } } }] } satisfies Prisma.CrmActivityWhereInput;
  const tomorrow = new Date(cardCutoff.getTime() + 86_400_000);
  const dueSoonPending = {
    OR: [{ dueSoonRemindedFor: null }, { dueSoonRemindedFor: { not: { equals: prisma.crmCard.fields.closeDate } } }],
  } satisfies Prisma.CrmCardWhereInput;

  const [cards, activities, dueSoon, beforeDue] = await Promise.all([
    prisma.crmCard.findMany({
      where: {
        ...cardPending,
        status: "OPEN",
        ...activeCard,
        closeDate: { lte: cardCutoff },
        responsible: { crmActive: true },
        stage: { pipeline: { kind: "TASKS" } },
      },
      take: limit,
      select: { id: true, number: true, title: true, closeDate: true, responsibleId: true, responsible: { select: { email: true } } },
    }),
    prisma.crmActivity.findMany({
      where: {
        ...activityPending,
        completed: false,
        type: { not: "COMMENT" },
        deadline: { lte: activityCutoff },
        responsible: { crmActive: true },
        card: activeCard,
      },
      take: limit,
      select: { id: true, type: true, title: true, deadline: true, cardId: true, responsibleId: true, responsible: { select: { email: true } }, card: { select: { number: true } } },
    }),
    // Task cards due tomorrow get a heads-up the day before
    prisma.crmCard.findMany({
      where: {
        ...dueSoonPending,
        status: "OPEN",
        ...activeCard,
        closeDate: tomorrow,
        responsible: { crmActive: true },
        stage: { pipeline: { kind: "TASKS" } },
      },
      take: limit,
      select: { id: true, number: true, title: true, closeDate: true, responsibleId: true, responsible: { select: { email: true } } },
    }),
    // Task cards with a due time and "lembrar X min antes" (lead up to a week)
    prisma.crmCard.findMany({
      where: {
        status: "OPEN",
        ...activeCard,
        dueTime: { not: null },
        reminderMinutes: { not: null },
        closeDate: { gte: cardCutoff, lte: new Date(cardCutoff.getTime() + 8 * 86_400_000) },
        responsible: { crmActive: true },
        stage: { pipeline: { kind: "TASKS" } },
      },
      // ponytail: the "remind now?" check runs in JS on the soonest `limit` cards; filter by instant in SQL if a week holds more
      orderBy: [{ closeDate: "asc" }, { dueTime: "asc" }],
      take: limit,
      select: {
        id: true,
        number: true,
        title: true,
        closeDate: true,
        dueTime: true,
        reminderMinutes: true,
        timeRemindedFor: true,
        responsibleId: true,
        responsible: { select: { email: true } },
      },
    }),
  ]);
  const now = Date.now();
  const timed = beforeDue.flatMap((c) => {
    const due = dueAt(c.closeDate!, c.dueTime);
    const remindAt = new Date(due.getTime() - c.reminderMinutes! * 60_000);
    return remindAt.getTime() <= now && now < due.getTime() && c.timeRemindedFor?.getTime() !== remindAt.getTime() ? [{ ...c, due, remindAt }] : [];
  });

  const reminders = [
    ...cards.map((c) => ({
      email: c.responsible?.email,
      number: c.number,
      memberId: c.responsibleId!,
      cardId: c.id,
      message: `Tarefa #${c.number} "${c.title}" ${dueState(c.closeDate, true) === "overdue" ? "está atrasada" : "vence hoje"}`,
      claim: (tx: Prisma.TransactionClient) =>
        tx.crmCard.updateMany({ where: { id: c.id, closeDate: c.closeDate, ...cardPending }, data: { remindedFor: c.closeDate } }),
    })),
    ...activities.map((a) => ({
      email: a.responsible?.email,
      number: a.card.number,
      memberId: a.responsibleId!,
      cardId: a.cardId,
      message: `${ACTIVITY_LABELS[a.type]} "${a.title}" (negócio #${a.card.number}) ${dueState(a.deadline, false) === "overdue" ? "está atrasada" : "vence hoje"}`,
      claim: (tx: Prisma.TransactionClient) =>
        tx.crmActivity.updateMany({ where: { id: a.id, deadline: a.deadline, ...activityPending }, data: { remindedFor: a.deadline } }),
    })),
    ...dueSoon.map((c) => ({
      email: c.responsible?.email,
      number: c.number,
      memberId: c.responsibleId!,
      cardId: c.id,
      message: `Tarefa #${c.number} "${c.title}" vence amanhã`,
      claim: (tx: Prisma.TransactionClient) =>
        tx.crmCard.updateMany({ where: { id: c.id, closeDate: c.closeDate, ...dueSoonPending }, data: { dueSoonRemindedFor: c.closeDate } }),
    })),
    ...timed.map((c) => ({
      email: c.responsible?.email,
      number: c.number,
      memberId: c.responsibleId!,
      cardId: c.id,
      message: `Tarefa #${c.number} "${c.title}" vence ${todayKey(c.due) === today ? "hoje" : `em ${c.due.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`} às ${c.dueTime}`,
      // Same date, time and lead as read, not yet reminded for this instant
      claim: (tx: Prisma.TransactionClient) =>
        tx.crmCard.updateMany({
          where: {
            id: c.id,
            closeDate: c.closeDate,
            dueTime: c.dueTime,
            reminderMinutes: c.reminderMinutes,
            OR: [{ timeRemindedFor: null }, { timeRemindedFor: { not: c.remindAt } }],
          },
          data: { timeRemindedFor: c.remindAt },
        }),
    })),
  ];

  let sent = 0;
  for (const { claim, email, number, ...notification } of reminders) {
    const created = await prisma.$transaction(async (tx) => {
      if (!(await claim(tx)).count) return false;
      await tx.crmNotification.create({ data: notification });
      return true;
    });
    if (!created) continue;
    notifyMember(notification.memberId);
    sent++;
    if (email) {
      const link = `${appBase()}/crm/deal/details/${number}`;
      // The bell already has it: a mail failure is logged, never retried
      await sendMail(email, "Lembrete de prazo no CRM", `<p>${escapeHtml(notification.message)}.</p><p><a href="${link}">Abrir no CRM</a></p>`).catch((error) =>
        console.error("[crm-my-tasks] reminder e-mail failed:", error instanceof Error ? error.message : error)
      );
    }
  }
  return sent;
}

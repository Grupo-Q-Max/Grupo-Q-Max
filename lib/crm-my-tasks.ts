import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyMember } from "@/lib/crm-realtime";
import { ACTIVITY_LABELS } from "@/components/crm/deal/types";
import { dueAt, dueState, reminderBase, todayKey } from "@/lib/crm-due";
import { escapeHtml, sendMail } from "@/lib/mail";
import { activeCard } from "@/lib/crm-deal";
import { fireTriggers } from "@/lib/crm-automation";
import { seenCardWhereFor } from "@/lib/crm-access";

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
  /** Task cards with subtasks: how many are done */
  subtasks?: { done: number; total: number };
};

/** The member's running timer (one at most, see lib/crm-time.ts), for the "Minhas tarefas" banner. */
export async function runningTimer(memberId: string) {
  const entry = await prisma.crmTimeEntry.findFirst({
    where: { memberId, endedAt: null },
    select: { startedAt: true, card: { select: { number: true, title: true } } },
  });
  return entry && { startedAt: entry.startedAt.toISOString(), number: entry.card.number, title: entry.card.title };
}

export type RunningTimer = NonNullable<Awaited<ReturnType<typeof runningTimer>>>;

/**
 * /crm/me — open cards the member is responsible for (or a co-assignee of) and their pending activities with a
 * deadline, in pipelines they can see, soonest due first (cards without closeDate last).
 */
export async function listMyTasks(memberId: string, visible: Prisma.CrmPipelineWhereInput) {
  // ponytail: no pagination; add when someone owns more than a few hundred open items
  const [cards, activities] = await Promise.all([
    prisma.crmCard.findMany({
      where: { OR: [{ responsibleId: memberId }, { assignees: { some: { memberId } } }], status: "OPEN", ...activeCard, stage: { pipeline: visible } },
      take: 500,
      select: {
        id: true,
        number: true,
        title: true,
        closeDate: true,
        dueTime: true,
        subtasks: { where: activeCard, select: { status: true } },
        stage: { select: { name: true, pipeline: { select: { name: true, kind: true } } } },
      },
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
      ...(c.subtasks.length > 0 && { subtasks: { done: c.subtasks.filter((s) => s.status === "WON").length, total: c.subtasks.length } }),
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

const appBase = () => (process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://grupoqmax.com.br").replace(/\/+$/, "");

/** Active co-assignees of a task card: they get its reminders too */
const coAssignees = { where: { member: { crmActive: true } }, select: { memberId: true, member: { select: { email: true } } } } as const;

type Recipient = { memberId: string; email: string | null | undefined };
/** Responsible first, then the co-assignees (without repeating the responsible) */
const cardRecipients = (c: { responsibleId: string | null; responsible: { email: string | null } | null; assignees: { memberId: string; member: { email: string | null } }[] }): Recipient[] => [
  { memberId: c.responsibleId!, email: c.responsible?.email },
  ...c.assignees.filter((a) => a.memberId !== c.responsibleId).map((a) => ({ memberId: a.memberId, email: a.member.email })),
];

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
      select: { id: true, number: true, title: true, closeDate: true, responsibleId: true, responsible: { select: { email: true } }, assignees: coAssignees },
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
      select: { id: true, number: true, title: true, closeDate: true, responsibleId: true, responsible: { select: { email: true } }, assignees: coAssignees },
    }),
    // Task cards with "lembrar X antes" (lead up to a week); without a due time it counts from 09:00 of the day
    prisma.crmCard.findMany({
      where: {
        status: "OPEN",
        ...activeCard,
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
        assignees: coAssignees,
      },
    }),
  ]);
  const now = Date.now();
  const timed = beforeDue.flatMap((c) => {
    const due = dueAt(c.closeDate!, c.dueTime);
    const remindAt = new Date(reminderBase(c.closeDate!, c.dueTime).getTime() - c.reminderMinutes! * 60_000);
    return remindAt.getTime() <= now && now < due.getTime() && c.timeRemindedFor?.getTime() !== remindAt.getTime() ? [{ ...c, due, remindAt }] : [];
  });

  const reminders: {
    to: { memberId: string; email: string | null | undefined }[];
    number: number;
    cardId: string;
    message: string;
    claim: (tx: Prisma.TransactionClient) => Prisma.PrismaPromise<Prisma.BatchPayload>;
    /** Runs once the reminder was claimed and sent */
    onSent?: () => Promise<unknown>;
  }[] = [
    ...cards.map((c) => ({
      to: cardRecipients(c),
      number: c.number,
      cardId: c.id,
      message: `Tarefa #${c.number} "${c.title}" ${dueState(c.closeDate, true) === "overdue" ? "está atrasada" : "vence hoje"}`,
      claim: (tx: Prisma.TransactionClient) =>
        tx.crmCard.updateMany({ where: { id: c.id, closeDate: c.closeDate, ...cardPending }, data: { remindedFor: c.closeDate } }),
      // Same once-per-deadline claim drives the "Prazo chegou" trigger
      // ponytail: tasks without an active responsible get no reminder, so no trigger either; give the trigger its own claim column if that matters
      onSent: () => fireTriggers(c.id, { type: "DUE_REACHED" }),
    })),
    ...activities.map((a) => ({
      to: [{ memberId: a.responsibleId!, email: a.responsible?.email }],
      number: a.card.number,
      cardId: a.cardId,
      message: `${ACTIVITY_LABELS[a.type]} "${a.title}" (negócio #${a.card.number}) ${dueState(a.deadline, false) === "overdue" ? "está atrasada" : "vence hoje"}`,
      claim: (tx: Prisma.TransactionClient) =>
        tx.crmActivity.updateMany({ where: { id: a.id, deadline: a.deadline, ...activityPending }, data: { remindedFor: a.deadline } }),
    })),
    ...dueSoon.map((c) => ({
      to: cardRecipients(c),
      number: c.number,
      cardId: c.id,
      message: `Tarefa #${c.number} "${c.title}" vence amanhã`,
      claim: (tx: Prisma.TransactionClient) =>
        tx.crmCard.updateMany({ where: { id: c.id, closeDate: c.closeDate, ...dueSoonPending }, data: { dueSoonRemindedFor: c.closeDate } }),
    })),
    ...timed.map((c) => ({
      to: cardRecipients(c),
      number: c.number,
      cardId: c.id,
      message: `Tarefa #${c.number} "${c.title}" vence ${todayKey(c.due) === today ? "hoje" : `em ${c.due.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`}${c.dueTime ? ` às ${c.dueTime}` : ""}`,
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
  for (const { claim, to, number, onSent, ...notification } of reminders) {
    // One claim per card/activity; every recipient gets the bell in the same transaction
    const created = await prisma.$transaction(async (tx) => {
      if (!(await claim(tx)).count) return false;
      await tx.crmNotification.createMany({ data: to.map(({ memberId }) => ({ ...notification, memberId })) });
      return true;
    });
    if (!created) continue;
    sent++;
    await onSent?.();
    for (const { memberId, email } of to) {
      notifyMember(memberId);
      if (!email) continue;
      const link = `${appBase()}/crm/deal/details/${number}`;
      // The bell already has it: a mail failure is logged, never retried
      await sendMail(email, "Lembrete de prazo no CRM", `<p>${escapeHtml(notification.message)}.</p><p><a href="${link}">Abrir no CRM</a></p>`).catch((error) =>
        console.error("[crm-my-tasks] reminder e-mail failed:", error instanceof Error ? error.message : error)
      );
    }
  }
  return sent;
}

const CHANGE_TYPES = ["FIELD_CHANGED", "STAGE_CHANGED", "STATUS_CHANGED"];
const STATUS_NAMES: Record<string, string> = { OPEN: "Aberta", WON: "Concluída", LOST: "Perdida" };
/** Quiet time after the last change before the summary goes out (the deal panel saves field by field) */
const CHANGE_MAIL_DELAY = 5 * 60_000;

type ChangeData = { label?: string; from?: unknown; to?: unknown };
const shown = (value: unknown) => escapeHtml(value == null || value === "" ? "—" : String(value));

/**
 * E-mails the responsible of a task card (TASKS pipelines) one summary of what other people (or automations)
 * changed on it: fields, column/status and new comments, once no change came in for CHANGE_MAIL_DELAY.
 * `changesMailedAt` is the cursor of what was already covered; the conditional claim makes the ticker and
 * the external cron safe to overlap. Changes made by the responsible move the cursor without a mail.
 */
export async function mailTaskChanges(limit = 100) {
  const now = Date.now();
  // ponytail: only cards changed in the last day are scanned; a ticker down for longer skips those changes
  const recent = { gt: new Date(now - 86_400_000) };
  const cards = await prisma.crmCard.findMany({
    where: {
      ...activeCard,
      stage: { pipeline: { kind: "TASKS" } },
      responsible: { crmActive: true, email: { not: null } },
      OR: [{ history: { some: { type: { in: CHANGE_TYPES }, createdAt: recent } } }, { activities: { some: { type: "COMMENT", createdAt: recent } } }],
    },
    take: limit,
    select: { id: true, number: true, title: true, changesMailedAt: true, responsibleId: true, responsible: { select: { email: true } } },
  });

  let sent = 0;
  for (const card of cards) {
    const since = { gt: card.changesMailedAt };
    const [history, comments] = await Promise.all([
      prisma.crmHistory.findMany({
        where: { cardId: card.id, type: { in: CHANGE_TYPES }, createdAt: since },
        select: { type: true, data: true, actorId: true, createdAt: true, actor: { select: { name: true } } },
      }),
      prisma.crmActivity.findMany({
        where: { cardId: card.id, type: "COMMENT", createdAt: since },
        select: { title: true, authorId: true, createdAt: true, author: { select: { name: true } } },
      }),
    ]);
    const entries = [
      ...history.map((h) => {
        const d = (h.data ?? {}) as ChangeData;
        const text =
          h.type === "STAGE_CHANGED"
            ? `<b>Coluna</b>: ${shown(d.from)} → ${shown(d.to)}`
            : h.type === "STATUS_CHANGED"
              ? `<b>Status</b>: ${shown(STATUS_NAMES[String(d.from)] ?? d.from)} → ${shown(STATUS_NAMES[String(d.to)] ?? d.to)}`
              : "from" in d || "to" in d
                ? `<b>${shown(d.label)}</b>: ${shown(d.from)} → ${shown(d.to)}`
                : `<b>${shown(d.label)}</b> alterado`;
        return { at: h.createdAt, actorId: h.actorId, author: h.actor?.name ?? "Automação", text };
      }),
      ...comments.map((c) => ({
        at: c.createdAt,
        actorId: c.authorId,
        author: c.author?.name ?? "Alguém",
        text: `<b>Comentário</b>: "${escapeHtml(c.title.length > 300 ? `${c.title.slice(0, 300)}…` : c.title)}"`,
      })),
    ].sort((a, b) => a.at.getTime() - b.at.getTime());
    const last = entries.at(-1)?.at;
    if (!last || now - last.getTime() < CHANGE_MAIL_DELAY) continue;

    const { count } = await prisma.crmCard.updateMany({ where: { id: card.id, changesMailedAt: card.changesMailedAt }, data: { changesMailedAt: last } });
    if (!count) continue;
    const lines = entries.filter((e) => e.actorId !== card.responsibleId);
    if (!lines.length || !(await prisma.crmCard.count({ where: { id: card.id, ...(await seenCardWhereFor(card.responsibleId)) } }))) continue;

    const link = `${appBase()}/crm/deal/details/${card.number}`;
    const html =
      `<p>A tarefa <b>#${card.number} "${escapeHtml(card.title)}"</b> foi alterada:</p>` +
      `<ul>${lines.map((e) => `<li>${e.text} <small>(${escapeHtml(e.author)})</small></li>`).join("")}</ul>` +
      `<p><a href="${link}">Abrir no CRM</a></p>`;
    // The cursor already moved: a mail failure is logged, never retried
    await sendMail(card.responsible!.email!, `Tarefa #${card.number} "${card.title}" foi alterada`, html).then(
      () => sent++,
      (error) => console.error("[crm-my-tasks] change e-mail failed:", error instanceof Error ? error.message : error)
    );
  }
  return sent;
}

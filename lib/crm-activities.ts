import { prisma } from "@/lib/prisma";
import { notifyMember } from "@/lib/crm-realtime";
import { escapeHtml, sendMail } from "@/lib/mail";
import { activityBucket } from "@/lib/crm-activities-shared";

/** Open activities assigned to `memberId`, soonest deadline first (no deadline last). */
export async function listMyActivities(memberId: string) {
  const activities = await prisma.crmActivity.findMany({
    where: { responsibleId: memberId, completed: false, type: { not: "COMMENT" } },
    orderBy: [{ deadline: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    take: 500,
    select: {
      id: true,
      type: true,
      title: true,
      deadline: true,
      card: { select: { number: true, title: true } },
    },
  });
  return activities.map((a) => ({ ...a, bucket: activityBucket(a.deadline) }));
}

const appBase = () => (process.env.APP_URL || "https://qmaxbrasil.com.br").replace(/\/+$/, "");

/**
 * Notifies the responsible of every activity whose deadline passed (bell + e-mail), once per
 * deadline. Runs on the automation ticker/cron; the conditional claim makes concurrent calls safe.
 */
export async function remindOverdueActivities(limit = 50) {
  const due = await prisma.crmActivity.findMany({
    where: { completed: false, remindedAt: null, deadline: { lte: new Date() }, responsibleId: { not: null } },
    take: limit,
    select: {
      id: true,
      title: true,
      cardId: true,
      card: { select: { number: true, title: true } },
      responsible: { select: { id: true, email: true, crmActive: true } },
    },
  });

  let sent = 0;
  for (const activity of due) {
    const claimed = await prisma.crmActivity.updateMany({ where: { id: activity.id, remindedAt: null }, data: { remindedAt: new Date() } });
    const member = activity.responsible;
    if (!claimed.count || !member?.crmActive) continue;

    const message = `Atividade atrasada: "${activity.title}" no negócio #${activity.card.number} ${activity.card.title}`;
    await prisma.crmNotification.create({ data: { memberId: member.id, cardId: activity.cardId, message } });
    notifyMember(member.id);
    sent++;

    if (member.email) {
      const link = `${appBase()}/crm/deal/details/${activity.card.number}`;
      // The bell already has it: a mail failure is logged, never retried
      await sendMail(member.email, "Atividade atrasada no CRM", `<p>${escapeHtml(message)}.</p><p><a href="${link}">Abrir negócio</a></p>`).catch(
        (error) => console.error("[crm-activities] reminder e-mail failed:", error instanceof Error ? error.message : error)
      );
    }
  }
  return sent;
}

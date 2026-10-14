import { prisma } from "@/lib/prisma";
import { currentPermissions } from "@/lib/crm-access";
import { CrmForbidden } from "@/components/crm/CrmForbidden";
import { CrmReports } from "@/components/crm/reports/CrmReports";

export const dynamic = "force-dynamic";

/** /crm/reports — won/lost deals and values per period, the open-deal funnel and the monthly goals. */
export default async function ReportsPage() {
  const permissions = await currentPermissions();
  if (!permissions.has("report.view")) return <CrmForbidden />;

  const goalsFrom = new Date();
  goalsFrom.setMonth(goalsFrom.getMonth() - 2, 1);

  // ponytail: every deal goes to the client (scalar fields only) and is aggregated there;
  // move to groupBy in a /api/crm/reports route if the table grows past ~20k deals
  const [deals, pipelines, members, goalMembers, goals] = await Promise.all([
    prisma.crmCard.findMany({
      select: {
        id: true,
        number: true,
        title: true,
        value: true,
        status: true,
        closedAt: true,
        createdAt: true,
        source: true,
        dealType: true,
        responsibleId: true,
        stageId: true,
        stage: { select: { pipelineId: true } },
      },
    }),
    prisma.crmPipeline.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, stages: { orderBy: { order: "asc" }, select: { id: true, name: true } } },
    }),
    prisma.teamMember.findMany({ where: { responsibleDeals: { some: {} } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.teamMember.findMany({
      // CRM users (signed in at least once, or responsible for a deal) plus anyone who already has a goal
      where: { OR: [{ crmActive: true, OR: [{ microsoftOid: { not: null } }, { responsibleDeals: { some: {} } }] }, { goals: { some: {} } }] },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.crmGoal.findMany({ where: { month: { gte: goalsFrom } }, select: { memberId: true, month: true, amount: true } }),
  ]);

  return (
    <CrmReports
      deals={deals.map(({ stage, value, closedAt, createdAt, ...d }) => ({
        ...d,
        value: Number(value),
        closedAt: closedAt?.toISOString() ?? null,
        createdAt: createdAt.toISOString(),
        pipelineId: stage.pipelineId,
      }))}
      pipelines={pipelines}
      members={members}
      goalMembers={goalMembers}
      goals={goals.map((g) => ({ memberId: g.memberId, month: g.month.toISOString().slice(0, 7), amount: Number(g.amount) }))}
      canManageGoals={permissions.has("goal.manage")}
    />
  );
}

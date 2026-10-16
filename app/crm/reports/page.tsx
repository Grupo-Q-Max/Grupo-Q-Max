import { prisma } from "@/lib/prisma";
import { activeCard } from "@/lib/crm-deal";
import { currentPermissions, visiblePipelineWhere } from "@/lib/crm-access";
import { CrmForbidden } from "@/components/crm/CrmForbidden";
import { CrmReports } from "@/components/crm/reports/CrmReports";
import { CrmTaskReport } from "@/components/crm/reports/CrmTaskReport";

export const dynamic = "force-dynamic";

/** /crm/reports — won/lost deals and values per period, the open-deal funnel, the monthly goals and the task boards per responsible. */
export default async function ReportsPage() {
  const permissions = await currentPermissions();
  if (!permissions.has("report.view")) return <CrmForbidden />;

  const goalsFrom = new Date();
  goalsFrom.setMonth(goalsFrom.getMonth() - 2, 1);

  // Sales boards the user sees; task boards have no value to report
  const visible = await visiblePipelineWhere();
  const pipelineWhere = { ...visible, kind: "DEALS" as const };

  // ponytail: every deal goes to the client (scalar fields only) and is aggregated there;
  // move to groupBy in a /api/crm/reports route if the table grows past ~20k deals
  const [deals, pipelines, members, goalMembers, goals, tasks] = await Promise.all([
    prisma.crmCard.findMany({
      where: { ...activeCard, stage: { pipeline: pipelineWhere } },
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
      where: pipelineWhere,
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
    prisma.crmCard.findMany({
      where: { ...activeCard, stage: { pipeline: { ...visible, kind: "TASKS" } } },
      select: { responsibleId: true, status: true, closedAt: true, closeDate: true, createdAt: true, estimateMinutes: true, spentMinutes: true, responsible: { select: { id: true, name: true } } },
    }),
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
    >
      <CrmTaskReport
        tasks={tasks.map(({ responsible: _, closedAt, closeDate, createdAt, ...t }) => ({
          ...t,
          closedAt: closedAt?.toISOString() ?? null,
          closeDate: closeDate?.toISOString().slice(0, 10) ?? null,
          createdAt: createdAt.toISOString(),
        }))}
        members={[...new Map(tasks.flatMap((t) => (t.responsible ? [[t.responsible.id, t.responsible]] : []))).values()]}
      />
    </CrmReports>
  );
}

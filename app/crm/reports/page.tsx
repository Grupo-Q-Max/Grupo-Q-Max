import { prisma } from "@/lib/prisma";
import { currentPermissions } from "@/lib/crm-access";
import { CrmForbidden } from "@/components/crm/CrmForbidden";
import { CrmReports } from "@/components/crm/reports/CrmReports";

export const dynamic = "force-dynamic";

/** /crm/reports — won/lost deals and values per period, compared with an earlier period. */
export default async function ReportsPage() {
  if (!(await currentPermissions()).has("report.view")) return <CrmForbidden />;

  // ponytail: every deal goes to the client (scalar fields only) and is aggregated there;
  // move to groupBy in a /api/crm/reports route if the table grows past ~20k deals
  const [deals, pipelines, members] = await Promise.all([
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
        stage: { select: { pipelineId: true } },
      },
    }),
    prisma.crmPipeline.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
    prisma.teamMember.findMany({ where: { responsibleDeals: { some: {} } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
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
    />
  );
}

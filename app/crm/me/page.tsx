import { cookies } from "next/headers";
import { readSession, SESSION_COOKIE } from "@/lib/auth";
import { visiblePipelineWhere } from "@/lib/crm-access";
import { listMyTasks } from "@/lib/crm-my-tasks";
import { dueState } from "@/lib/crm-due";
import { prisma } from "@/lib/prisma";
import { CrmMyTasks } from "@/components/crm/CrmMyTasks";

export const dynamic = "force-dynamic";

function formatDue(due: string, dateOnly: boolean) {
  const date = new Date(due);
  return dateOnly
    ? date.toLocaleDateString("pt-BR", { timeZone: "UTC" })
    : date.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
}

/** /crm/me — "Minhas tarefas": open cards and pending activities of the signed-in member. */
export default async function MyTasksPage() {
  const memberId = readSession((await cookies()).get(SESSION_COOKIE)?.value);
  const visible = await visiblePipelineWhere();
  const [items, pipelines] = await Promise.all([
    memberId ? listMyTasks(memberId, visible) : [],
    prisma.crmPipeline.findMany({
      where: { AND: [visible, { kind: "TASKS" }] },
      orderBy: { name: "asc" },
      select: { id: true, name: true, stages: { orderBy: { order: "asc" }, take: 1, select: { id: true } } },
    }),
  ]);

  return (
    <CrmMyTasks
      memberId={memberId}
      items={items.map((item) => ({
        ...item,
        id: item.key,
        state: dueState(item.due ? new Date(item.due) : null, item.dateOnly),
        dueText: item.due ? formatDue(item.due, item.dateOnly) : "Sem prazo",
      }))}
      pipelines={pipelines.flatMap((p) => (p.stages[0] ? [{ id: p.id, name: p.name, firstStageId: p.stages[0].id }] : []))}
    />
  );
}

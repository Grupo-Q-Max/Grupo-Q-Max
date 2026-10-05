import type { CrmArea } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AREAS } from "@/lib/crm-areas";
import { notifyMember } from "@/lib/crm-realtime";

const DEFAULT_COLUMNS = ["Backlog", "Em andamento", "Concluído", "Aguardando"];

/** Board columns in order; creates the default ones on first use. */
export async function requestColumns() {
  const columns = await prisma.crmRequestColumn.findMany({ orderBy: { order: "asc" }, select: { id: true, name: true } });
  if (columns.length) return columns;
  // ponytail: two first-ever requests at the same instant could seed twice; delete the extra columns if it happens
  await prisma.crmRequestColumn.createMany({ data: DEFAULT_COLUMNS.map((name, order) => ({ name, order })) });
  return prisma.crmRequestColumn.findMany({ orderBy: { order: "asc" }, select: { id: true, name: true } });
}

/**
 * Notifies the members of the request's area in the CRM bell (OTHER: whoever may manage
 * requests). The author is skipped. Runs after the request is saved: a failure here only logs.
 */
export async function notifyRequestArea(request: { id: string; title: string; area: CrmArea; authorId: string | null }) {
  const managers = { OR: [{ isAdmin: true }, { permissions: { some: { permission: "request.manage" } } }] };
  const defaultManages = await prisma.crmGroup.count({ where: { isDefault: true, ...managers } });
  const members = await prisma.teamMember.findMany({
    where: {
      crmActive: true,
      ...(request.authorId && { NOT: { id: request.authorId } }),
      ...(request.area === "OTHER"
        ? { OR: [{ crmGroup: managers }, ...(defaultManages ? [{ crmGroupId: null }] : [])] }
        : { area: request.area }),
    },
    select: { id: true },
  });
  if (!members.length) return;

  const message = `Novo pedido para ${AREAS[request.area]}: ${request.title}`;
  await prisma.crmNotification.createMany({ data: members.map((m) => ({ memberId: m.id, requestId: request.id, message })) });
  members.forEach((m) => notifyMember(m.id));
}

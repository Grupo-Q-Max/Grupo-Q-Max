import type { CrmArea } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AREAS } from "@/lib/crm-areas";
import { notifyMember } from "@/lib/crm-realtime";

const DEFAULT_COLUMNS = ["Backlog", "Em andamento", "Concluído", "Aguardando"];
const DONE_COLUMN = "Concluído";
/** Days a request stays in the done column before it is archived. */
export const ARCHIVE_AFTER_DAYS = 7;

const columnSelect = { id: true, name: true, isDone: true } as const;

/** Board columns in order; creates the default ones on first use. */
export async function requestColumns() {
  const columns = await prisma.crmRequestColumn.findMany({ orderBy: { order: "asc" }, select: columnSelect });
  if (columns.length) return columns;
  // ponytail: two first-ever requests at the same instant could seed twice; delete the extra columns if it happens
  await prisma.crmRequestColumn.createMany({
    data: DEFAULT_COLUMNS.map((name, order) => ({ name, order, isDone: name === DONE_COLUMN })),
  });
  return prisma.crmRequestColumn.findMany({ orderBy: { order: "asc" }, select: columnSelect });
}

/**
 * Archives the requests that have been in the done column for ARCHIVE_AFTER_DAYS.
 * ponytail: runs when /crm/requests loads instead of on a timer; nobody sees a request
 * without opening that page. Move it to instrumentation-node.ts if something else needs it on time.
 */
export function archiveCompleted() {
  const before = new Date(Date.now() - ARCHIVE_AFTER_DAYS * 24 * 60 * 60 * 1000);
  return prisma.crmRequest.updateMany({
    where: { archivedAt: null, completedAt: { lt: before } },
    data: { archivedAt: new Date() },
  });
}

/** The author and the `request.manage` users may edit, archive and delete a request. */
export const canEditRequest = (memberId: string | null, canManage: boolean, authorId: string | null) =>
  canManage || (!!memberId && authorId === memberId);

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

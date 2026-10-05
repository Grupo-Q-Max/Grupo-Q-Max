import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { readSession, SESSION_COOKIE } from "@/lib/auth";
import { currentPermissions } from "@/lib/crm-access";
import { archiveCompleted, canEditRequest, requestColumns } from "@/lib/crm-requests";
import { CrmRequests } from "@/components/crm/CrmRequests";

export const dynamic = "force-dynamic";

/**
 * /crm/requests — improvement requests: everyone sees their own and those addressed to their area;
 * `request.manage` sees all on a board.
 */
export default async function RequestsPage() {
  const memberId = readSession((await cookies()).get(SESSION_COOKIE)?.value);
  const canManage = (await currentPermissions()).has("request.manage");

  const area = memberId
    ? (await prisma.teamMember.findUnique({ where: { id: memberId }, select: { area: true } }))?.area
    : null;

  await archiveCompleted();
  const [columns, requests] = await Promise.all([
    requestColumns(),
    prisma.crmRequest.findMany({
      // No session (site admin cookie only) and no permission = nothing to list
      where: canManage ? {} : { OR: [{ authorId: memberId ?? "-" }, ...(area ? [{ area }] : [])] },
      // Active first (NULL sorts first in MariaDB), so archived ones never push them past the limit
      orderBy: [{ archivedAt: "asc" }, canManage ? { order: "asc" } : { createdAt: "desc" }],
      take: 500, // ponytail: no pagination; add when requests pass a few hundred
      select: {
        id: true,
        type: true,
        area: true,
        title: true,
        description: true,
        columnId: true,
        authorId: true,
        createdAt: true,
        archivedAt: true,
        author: { select: { name: true } },
      },
    }),
  ]);

  return (
    <CrmRequests
      canManage={canManage}
      canCreate={!!memberId}
      columns={columns}
      requests={requests.map(({ author, authorId, createdAt, archivedAt, ...r }) => ({
        ...r,
        mine: !!memberId && authorId === memberId,
        canEdit: canEditRequest(memberId, canManage, authorId),
        archived: !!archivedAt,
        author: author?.name ?? "Usuário removido",
        createdAt: createdAt.toISOString(),
      }))}
    />
  );
}

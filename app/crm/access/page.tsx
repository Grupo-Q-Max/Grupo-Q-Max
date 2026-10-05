import { prisma } from "@/lib/prisma";
import { currentPermissions, ensureGroups } from "@/lib/crm-access";
import { CrmForbidden } from "@/components/crm/CrmForbidden";
import { CrmAccessManager } from "@/components/crm/CrmAccessManager";

export const dynamic = "force-dynamic";

/** /crm/access — access groups, their permissions and the group of each CRM user. */
export default async function AccessPage() {
  if (!(await currentPermissions()).has("access.manage")) return <CrmForbidden />;
  await ensureGroups();

  const [groups, members] = await Promise.all([
    prisma.crmGroup.findMany({
      orderBy: [{ isAdmin: "desc" }, { name: "asc" }],
      select: { id: true, name: true, isAdmin: true, isDefault: true, permissions: { select: { permission: true } } },
    }),
    // Only members with a login use the CRM
    prisma.teamMember.findMany({
      where: { email: { not: null } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, crmGroupId: true, emailVerifiedAt: true, showOnSite: true },
    }),
  ]);

  return (
    <CrmAccessManager
      groups={groups.map(({ permissions, ...g }) => ({ ...g, permissions: permissions.map((p) => p.permission) }))}
      // Pending = invited (or self-registered) but never confirmed; only those not on the site can be cancelled here
      members={members.map(({ emailVerifiedAt, showOnSite, ...m }) => ({
        ...m,
        pending: !emailVerifiedAt,
        cancellable: !emailVerifiedAt && !showOnSite,
      }))}
    />
  );
}

import { currentPermissions } from "@/lib/crm-access";
import { ARCHIVE_AFTER_DAYS, requestColumns } from "@/lib/crm-requests";
import { prisma } from "@/lib/prisma";
import { CrmForbidden } from "@/components/crm/CrmForbidden";
import { CrmSettings } from "@/components/crm/CrmSettings";

export const dynamic = "force-dynamic";

/** /crm/settings — CRM settings: spaces, improvement requests' done column and the entry to access levels. */
export default async function SettingsPage() {
  const permissions = await currentPermissions();
  const canRequests = permissions.has("request.manage");
  const canAccess = permissions.has("access.manage");
  const canSpaces = permissions.has("space.manage");
  if (!canRequests && !canAccess && !canSpaces) return <CrmForbidden />;
  const spaces = canSpaces
    ? await prisma.crmSpace.findMany({ orderBy: { order: "asc" }, select: { id: true, name: true, _count: { select: { pipelines: true } } } })
    : null;
  return (
    <CrmSettings
      columns={canRequests ? await requestColumns() : null}
      spaces={spaces?.map((s) => ({ id: s.id, name: s.name, pipelines: s._count.pipelines })) ?? null}
      archiveAfterDays={ARCHIVE_AFTER_DAYS}
      canAccess={canAccess}
    />
  );
}

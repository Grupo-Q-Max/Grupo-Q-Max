import { currentPermissions } from "@/lib/crm-access";
import { ARCHIVE_AFTER_DAYS, requestColumns } from "@/lib/crm-requests";
import { CrmForbidden } from "@/components/crm/CrmForbidden";
import { CrmSettings } from "@/components/crm/CrmSettings";

export const dynamic = "force-dynamic";

/** /crm/settings — CRM settings: improvement requests' done column and the entry to access levels. */
export default async function SettingsPage() {
  const permissions = await currentPermissions();
  const canRequests = permissions.has("request.manage");
  const canAccess = permissions.has("access.manage");
  if (!canRequests && !canAccess) return <CrmForbidden />;
  return (
    <CrmSettings
      columns={canRequests ? await requestColumns() : null}
      archiveAfterDays={ARCHIVE_AFTER_DAYS}
      canAccess={canAccess}
    />
  );
}

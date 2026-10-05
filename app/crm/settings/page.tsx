import { currentPermissions } from "@/lib/crm-access";
import { ARCHIVE_AFTER_DAYS, requestColumns } from "@/lib/crm-requests";
import { CrmForbidden } from "@/components/crm/CrmForbidden";
import { CrmSettings } from "@/components/crm/CrmSettings";

export const dynamic = "force-dynamic";

/** /crm/settings — CRM settings; today only the improvement requests' done column. */
export default async function SettingsPage() {
  if (!(await currentPermissions()).has("request.manage")) return <CrmForbidden />;
  return <CrmSettings columns={await requestColumns()} archiveAfterDays={ARCHIVE_AFTER_DAYS} />;
}

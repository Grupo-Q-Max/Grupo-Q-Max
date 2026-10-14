import { cookies } from "next/headers";
import { readSession, SESSION_COOKIE } from "@/lib/auth";
import { listMyActivities } from "@/lib/crm-activities";
import { CrmMyActivities } from "@/components/crm/CrmMyActivities";

export const dynamic = "force-dynamic";

/** /crm/activities — open activities assigned to the signed-in member, by deadline. */
export default async function MyActivitiesPage() {
  const memberId = readSession((await cookies()).get(SESSION_COOKIE)?.value);
  const activities = memberId ? await listMyActivities(memberId) : [];

  return (
    <CrmMyActivities
      activities={activities.map(({ deadline, ...a }) => ({ ...a, deadline: deadline?.toISOString() ?? null }))}
    />
  );
}

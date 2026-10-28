import "./crm.css";
import "./deal.css";
import "./automation.css";
import { CrmSidebar, type SidebarSpace } from "@/components/crm/CrmSidebar";
import { CrmAccessProvider } from "@/components/crm/CrmAccess";
import { cookies } from "next/headers";
import { currentPermissions, isCrmAdmin, visiblePipelineWhere } from "@/lib/crm-access";
import { readSession, SESSION_COOKIE } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function CRMLayout({ children }: { children: React.ReactNode }) {
  const permissions = [...(await currentPermissions())];
  const memberId = readSession((await cookies()).get(SESSION_COOKIE)?.value);
  const isAdmin = await isCrmAdmin(memberId);
  const pipelineSelect = { where: await visiblePipelineWhere(), orderBy: [{ order: "asc" as const }, { createdAt: "asc" as const }], select: { id: true, name: true, kind: true } };
  const [spaces, loose] = await Promise.all([
    prisma.crmSpace.findMany({ orderBy: { order: "asc" }, select: { id: true, name: true, pipelines: pipelineSelect } }),
    prisma.crmPipeline.findMany({ ...pipelineSelect, where: { ...pipelineSelect.where, spaceId: null } }),
  ]);
  // Pipelines without a team go under "Geral". Empty teams are hidden, except for whoever can
  // move pipelines (drag and drop needs every team as a drop target)
  const canMove = permissions.includes("pipeline.edit");
  const sidebarSpaces: SidebarSpace[] = [
    ...(loose.length || canMove ? [{ id: "", name: "Geral", pipelines: loose }] : []),
    ...spaces.filter((space) => canMove || space.pipelines.length > 0),
  ];

  return (
    <CrmAccessProvider permissions={permissions} memberId={memberId} isAdmin={isAdmin}>
      <div className="crm-layout">
        <CrmSidebar spaces={sidebarSpaces} />
        <main className="crm-main">
          {children}
        </main>
      </div>
    </CrmAccessProvider>
  );
}

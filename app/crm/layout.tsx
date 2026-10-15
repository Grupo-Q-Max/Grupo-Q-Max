import "./crm.css";
import "./deal.css";
import "./automation.css";
import { CrmSidebar, type SidebarSpace } from "@/components/crm/CrmSidebar";
import { CrmAccessProvider } from "@/components/crm/CrmAccess";
import { currentPermissions, visiblePipelineWhere } from "@/lib/crm-access";
import { prisma } from "@/lib/prisma";

export default async function CRMLayout({ children }: { children: React.ReactNode }) {
  const permissions = [...(await currentPermissions())];
  const pipelineSelect = { where: await visiblePipelineWhere(), orderBy: [{ order: "asc" as const }, { createdAt: "asc" as const }], select: { id: true, name: true, kind: true } };
  const [spaces, loose] = await Promise.all([
    prisma.crmSpace.findMany({ orderBy: { order: "asc" }, select: { id: true, name: true, pipelines: pipelineSelect } }),
    prisma.crmPipeline.findMany({ ...pipelineSelect, where: { ...pipelineSelect.where, spaceId: null } }),
  ]);
  // Pipelines without a space go under "Geral"; spaces with nothing visible are hidden
  const sidebarSpaces: SidebarSpace[] = [
    ...(loose.length ? [{ id: "", name: "Geral", pipelines: loose }] : []),
    ...spaces.filter((space) => space.pipelines.length > 0),
  ];

  return (
    <CrmAccessProvider permissions={permissions}>
      <div className="crm-layout">
        <CrmSidebar spaces={sidebarSpaces} />
        <main className="crm-main">
          {children}
        </main>
      </div>
    </CrmAccessProvider>
  );
}

import "./crm.css";
import "./deal.css";
import "./automation.css";
import { CrmSidebar } from "@/components/crm/CrmSidebar";
import { CrmAccessProvider } from "@/components/crm/CrmAccess";
import { currentPermissions } from "@/lib/crm-access";

export default async function CRMLayout({ children }: { children: React.ReactNode }) {
  const permissions = [...(await currentPermissions())];
  return (
    <CrmAccessProvider permissions={permissions}>
      <div className="crm-layout">
        <CrmSidebar />
        <main className="crm-main">
          {children}
        </main>
      </div>
    </CrmAccessProvider>
  );
}

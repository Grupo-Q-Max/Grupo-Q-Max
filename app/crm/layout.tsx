import "./crm.css";
import "./deal.css";
import { CrmSidebar } from "@/components/crm/CrmSidebar";

export default function CRMLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="crm-layout">
      <CrmSidebar />
      <main className="crm-main">
        {children}
      </main>
    </div>
  );
}

import type { Metadata } from "next";
import { MicrosoftLogin } from "@/components/crm/MicrosoftLogin";
import { microsoftConfig } from "@/lib/microsoft-auth";
import "./login.css";

// Reads the Entra ID app at request time (App Service settings), not at build time
export const dynamic = "force-dynamic";

// The root layout says index + canonical "/"; the CRM sign-in is neither
export const metadata: Metadata = {
  title: "Entrar no CRM",
  robots: { index: false, follow: false },
  alternates: { canonical: "/login" },
};

export default function LoginPage() {
  let config;
  try {
    config = microsoftConfig();
  } catch (error) {
    console.error("[login]", error instanceof Error ? error.message : error);
    return (
      <main className="crm-login">
        <div className="crm-login__card">
          <p className="crm-login__error" role="alert">
            O login com Microsoft ainda não está configurado. Fale com o administrador.
          </p>
        </div>
      </main>
    );
  }
  // Tenant and client IDs are public (they go in the Microsoft login URL); the allowed domains stay here
  return <MicrosoftLogin tenantId={config.tenantId} clientId={config.clientId} />;
}

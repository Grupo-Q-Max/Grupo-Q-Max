import Link from "next/link";

/** Shown instead of a CRM page the user's group can't access. */
export function CrmForbidden() {
  return (
    <>
      <header className="crm-header">
        <h1 className="crm-header__title">Acesso negado</h1>
      </header>
      <div className="crm-content crm-forbidden">
        <p>Seu grupo de acesso não permite abrir esta página. Fale com um administrador do CRM.</p>
        <Link href="/crm" className="btn-secondary">
          Voltar aos pipelines
        </Link>
      </div>
    </>
  );
}

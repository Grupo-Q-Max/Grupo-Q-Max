"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Download, Upload, Users } from "lucide-react";
import { matches } from "@/lib/text-search";
import { downloadCsv } from "@/lib/csv";
import { alertDialog } from "@/components/ui/Dialogs";
import { useCan, useViewer } from "./CrmAccess";

type DealLink = { number: number; title: string };

export type ContactRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  company: string | null;
  deals: DealLink[];
};

export type CompanyRow = {
  id: string;
  name: string;
  document: string | null;
  phone: string | null;
  email: string | null;
  contacts: number;
  deals: DealLink[];
};

function Deals({ deals }: { deals: DealLink[] }) {
  if (!deals.length) return <>—</>;
  return (
    <span className="crm-contacts__deals">
      {deals.map((d) => (
        <Link key={d.number} href={`/crm/deal/details/${d.number}`}>
          #{d.number} {d.title}
        </Link>
      ))}
    </span>
  );
}

const Phone = ({ value }: { value: string | null }) => (value ? <a href={`tel:${value}`}>{value}</a> : <>—</>);
const Email = ({ value }: { value: string | null }) => (value ? <a href={`mailto:${value}`}>{value}</a> : <>—</>);

export function CrmContacts({ contacts, companies }: { contacts: ContactRow[]; companies: CompanyRow[] }) {
  const [view, setView] = useState<"contacts" | "companies">("contacts");
  const [search, setSearch] = useState("");
  const shownContacts = contacts.filter((c) => matches(search, c.name, c.email, c.phone, c.company));
  const shownCompanies = companies.filter((c) => matches(search, c.name, c.email, c.phone, c.document));
  const dealList = (deals: DealLink[]) => deals.map((d) => `#${d.number} ${d.title}`).join(", ");
  const can = useCan();
  // LGPD: bulk export of personal data only for CRM admins (fewer copies of contact lists outside the system)
  const { isAdmin } = useViewer();
  const router = useRouter();
  const [importing, setImporting] = useState(false);

  const importCsv = async (file: File | undefined) => {
    if (!file) return;
    setImporting(true);
    try {
      const res = await fetch("/api/crm/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: await file.text() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) return alertDialog(data?.error ?? "Não foi possível importar o arquivo.");
      await alertDialog(
        `${data.created} contato(s) criado(s), ${data.updated} atualizado(s) (mesmo e-mail ou telefone)` +
          (data.skipped ? `, ${data.skipped} linha(s) sem nome ignorada(s).` : ".")
      );
      router.refresh();
    } finally {
      setImporting(false);
    }
  };

  // Exports what is on screen (current tab and search)
  const exportCsv = () =>
    view === "contacts"
      ? downloadCsv("contatos.csv", [
          ["Nome", "Empresa", "Telefone", "E-mail", "Negócios"],
          ...shownContacts.map((c) => [c.name, c.company, c.phone, c.email, dealList(c.deals)]),
        ])
      : downloadCsv("empresas.csv", [
          ["Nome", "CNPJ", "Telefone", "E-mail", "Contatos", "Negócios"],
          ...shownCompanies.map((c) => [c.name, c.document, c.phone, c.email, c.contacts, dealList(c.deals)]),
        ]);

  return (
    <>
      <header className="crm-header">
        <h1 className="crm-header__title">Contatos</h1>
        <div className="crm-toolbar__views">
          <button className={`view-btn ${view === "contacts" ? "is-active" : ""}`} onClick={() => setView("contacts")}>
            <Users size={16} /> Contatos ({contacts.length})
          </button>
          <button className={`view-btn ${view === "companies" ? "is-active" : ""}`} onClick={() => setView("companies")}>
            <Building2 size={16} /> Empresas ({companies.length})
          </button>
        </div>
        {isAdmin && (
          <button
            type="button"
            className="btn-secondary"
            onClick={exportCsv}
            disabled={!(view === "contacts" ? shownContacts : shownCompanies).length}
          >
            <Download size={16} /> Exportar CSV
          </button>
        )}
        {can("deal.create") && (
          <label
            className="btn-secondary"
            title='CSV com cabeçalho: Nome, E-mail, Telefone, Empresa, CNPJ ("Nome" obrigatório)'
            aria-disabled={importing}
          >
            <Upload size={16} /> {importing ? "Importando…" : "Importar CSV"}
            <input
              type="file"
              accept=".csv,text/csv"
              hidden
              disabled={importing}
              onChange={(e) => {
                void importCsv(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
        )}
      </header>
      <div className="crm-content crm-access">
        <input
          type="search"
          className="crm-access__select crm-contacts__search"
          placeholder={view === "contacts" ? "Buscar por nome, e-mail, telefone ou empresa" : "Buscar por nome, CNPJ, e-mail ou telefone"}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Buscar"
        />

        {view === "contacts" ? (
          shownContacts.length ? (
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Empresa</th>
                  <th>Telefone</th>
                  <th>E-mail</th>
                  <th>Negócios</th>
                </tr>
              </thead>
              <tbody>
                {shownContacts.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.company ?? "—"}</td>
                    <td><Phone value={c.phone} /></td>
                    <td><Email value={c.email} /></td>
                    <td><Deals deals={c.deals} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="crm-contacts__empty">
              {search.trim() ? "Nenhum contato encontrado." : "Nenhum contato salvo ainda. Contatos criados nos negócios aparecem aqui."}
            </p>
          )
        ) : shownCompanies.length ? (
          <table className="crm-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>CNPJ</th>
                <th>Telefone</th>
                <th>E-mail</th>
                <th>Contatos</th>
                <th>Negócios</th>
              </tr>
            </thead>
            <tbody>
              {shownCompanies.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.document ?? "—"}</td>
                  <td><Phone value={c.phone} /></td>
                  <td><Email value={c.email} /></td>
                  <td>{c.contacts}</td>
                  <td><Deals deals={c.deals} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="crm-contacts__empty">
            {search.trim() ? "Nenhuma empresa encontrada." : "Nenhuma empresa salva ainda. Empresas criadas nos negócios aparecem aqui."}
          </p>
        )}
      </div>
    </>
  );
}

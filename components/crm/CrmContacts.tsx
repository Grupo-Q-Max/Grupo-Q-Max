"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, Users } from "lucide-react";
import { matches } from "@/lib/text-search";

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

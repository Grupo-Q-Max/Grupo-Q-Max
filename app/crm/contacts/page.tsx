import { prisma } from "@/lib/prisma";
import { CrmContacts } from "@/components/crm/CrmContacts";

export const dynamic = "force-dynamic";

// ponytail: no pagination, filtered on the client; search on the server when the list passes this
const LIMIT = 1000;

/** /crm/contacts — contacts and companies saved from the deal cards. */
export default async function ContactsPage() {
  const [contacts, companies] = await Promise.all([
    prisma.crmContact.findMany({
      orderBy: { name: "asc" },
      take: LIMIT,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        company: { select: { name: true } },
        deals: { select: { deal: { select: { number: true, title: true } } } },
      },
    }),
    prisma.crmCompany.findMany({
      orderBy: { name: "asc" },
      take: LIMIT,
      select: {
        id: true,
        name: true,
        document: true,
        phone: true,
        email: true,
        _count: { select: { contacts: true } },
        deals: { select: { number: true, title: true } },
      },
    }),
  ]);

  return (
    <CrmContacts
      contacts={contacts.map(({ company, deals, ...c }) => ({
        ...c,
        company: company?.name ?? null,
        deals: deals.map((d) => d.deal),
      }))}
      companies={companies.map(({ _count, ...c }) => ({ ...c, contacts: _count.contacts }))}
    />
  );
}

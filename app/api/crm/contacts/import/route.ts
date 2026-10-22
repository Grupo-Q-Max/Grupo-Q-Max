import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { denyUnless } from "@/lib/crm-access";
import { companyIdByName, findOrCreateContact } from "@/lib/crm-deal";
import { parseCsv } from "@/lib/csv";

const MAX_ROWS = 2000;
/** Default VarChar(191) of the String columns */
const cut = (value: string | undefined) => value?.trim().slice(0, 191) || null;
const normalize = (header: string) => header.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");

/** Accepted header names (normalized) for each column */
const COLUMNS = {
  name: ["nome", "name", "contato"],
  email: ["email"],
  phone: ["telefone", "phone", "celular", "whatsapp"],
  company: ["empresa", "company"],
  document: ["cnpj", "documento", "document"],
} as const;

/**
 * POST /api/crm/contacts/import { csv } — contacts (and their companies) from a CSV with a header row.
 * Rows matching an existing contact by e-mail or phone update it instead of duplicating (findOrCreateContact).
 */
export async function POST(req: Request) {
  const denied = await denyUnless("deal.create");
  if (denied) return denied;
  try {
    const { csv } = await req.json();
    if (typeof csv !== "string" || !csv.trim()) return NextResponse.json({ error: "Arquivo vazio." }, { status: 400 });

    const [header = [], ...rows] = parseCsv(csv);
    const index = Object.fromEntries(
      Object.entries(COLUMNS).map(([key, names]) => [key, header.findIndex((h) => (names as readonly string[]).includes(normalize(h)))])
    ) as Record<keyof typeof COLUMNS, number>;
    if (index.name < 0) return NextResponse.json({ error: 'O arquivo precisa de uma coluna "Nome".' }, { status: 400 });
    if (rows.length > MAX_ROWS) return NextResponse.json({ error: `Máximo de ${MAX_ROWS} linhas por arquivo.` }, { status: 400 });

    let created = 0;
    let updated = 0;
    let skipped = 0;
    for (const row of rows) {
      const at = (key: keyof typeof COLUMNS) => (index[key] >= 0 ? row[index[key]] : undefined);
      const name = cut(at("name"));
      if (!name) {
        skipped++;
        continue;
      }
      const email = cut(at("email"))?.toLowerCase() ?? null;
      const document = cut(at("document"));
      const companyName = cut(at("company"));
      // A CNPJ wins over the name: it is unique (CrmCompany.document)
      const companyId =
        (document && (await prisma.crmCompany.findUnique({ where: { document }, select: { id: true } }))?.id) ||
        (document && companyName && (await prisma.crmCompany.create({ data: { name: companyName, document } })).id) ||
        (await companyIdByName(prisma, companyName));
      const result = await findOrCreateContact(prisma, { name, email, phone: cut(at("phone")), companyId });
      if (result.created) created++;
      else updated++;
    }
    return NextResponse.json({ created, updated, skipped });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Não foi possível importar o arquivo." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const LIMIT = 8;

/**
 * Autocomplete for the deal panel, so existing companies, contacts and catalog
 * products are linked instead of duplicated.
 * GET /api/crm/lookup?type=company|contact|product&q=...
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const type = url.searchParams.get("type");
    const q = (url.searchParams.get("q") ?? "").trim();
    if (q.length < 2) return NextResponse.json([]);

    if (type === "company") {
      const companies = await prisma.crmCompany.findMany({
        where: { OR: [{ name: { contains: q } }, { document: { contains: q } }] },
        orderBy: { name: "asc" },
        take: LIMIT,
      });
      return NextResponse.json(
        companies.map((c) => ({
          id: c.id,
          name: c.name,
          document: c.document ?? "",
          phone: c.phone ?? "",
          email: c.email ?? "",
          address: c.address ?? "",
          info: c.info ?? "",
        }))
      );
    }

    if (type === "contact") {
      const contacts = await prisma.crmContact.findMany({
        where: { OR: [{ name: { contains: q } }, { email: { contains: q } }, { phone: { contains: q } }] },
        orderBy: { name: "asc" },
        take: LIMIT,
      });
      return NextResponse.json(
        contacts.map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone ?? "",
          email: c.email ?? "",
          address: c.address ?? "",
          info: c.info ?? "",
        }))
      );
    }

    if (type === "product") {
      const products = await prisma.crmProduct.findMany({
        where: { name: { contains: q } },
        orderBy: { name: "asc" },
        take: LIMIT,
      });
      return NextResponse.json(products.map((p) => ({ id: p.id, name: p.name, price: p.price.toNumber() })));
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

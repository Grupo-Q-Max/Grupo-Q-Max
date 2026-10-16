import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { visiblePipelineWhere } from "@/lib/crm-access";
import { activeCard } from "@/lib/crm-deal";

const LIMIT = 8;

/**
 * Autocomplete for the deal panel, so existing companies, contacts and catalog
 * products are linked instead of duplicated.
 * GET /api/crm/lookup?type=company|contact|product&q=...
 * type=card&pipelineId=...: cards of a pipeline the user sees, by title or #number ("Bloqueada por").
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

    if (type === "card") {
      // Without pipelineId: any board the user sees ("Vínculos"), with the board name
      const pipelineId = url.searchParams.get("pipelineId");
      const number = Number(q.replace(/^#/, ""));
      const cards = await prisma.crmCard.findMany({
        where: {
          ...activeCard,
          stage: { ...(pipelineId && { pipelineId }), pipeline: await visiblePipelineWhere() },
          OR: [{ title: { contains: q } }, ...(Number.isInteger(number) && number > 0 ? [{ number }] : [])],
        },
        orderBy: { number: "desc" },
        take: LIMIT,
        select: { id: true, number: true, title: true, status: true, stage: { select: { pipeline: { select: { name: true } } } } },
      });
      return NextResponse.json(
        cards.map(({ stage, ...c }) => ({ ...c, name: `#${c.number} ${c.title}${pipelineId ? "" : ` · ${stage.pipeline.name}`}` }))
      );
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

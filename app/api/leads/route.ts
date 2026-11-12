import { NextRequest, NextResponse, after } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { isAdminToken } from "@/lib/settings";
import { ADMIN_COOKIE } from "@/lib/auth";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { escapeHtml, sendMail } from "@/lib/mail";

// Prisma String columns are varchar(191)
const field = (value: unknown) => (typeof value === "string" ? value.trim().slice(0, 191) : "");

/** Public lead form (QuickLeadModal). Open endpoint: validated, rate limited, answers only success. */
export async function POST(req: NextRequest) {
  const wait = await rateLimit(`lead:ip:${clientIp(req)}`, 5, 10 * 60_000);
  if (wait) return tooManyRequests(wait);

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const data = {
    name: field(body.name),
    email: field(body.email),
    phone: field(body.phone),
    company: field(body.company) || null,
    message: field(body.message),
  };
  if (!data.name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  try {
    await prisma.contactLead.create({ data });

    // Injeta automaticamente no primeiro estágio do funil do CRM
    const defaultStage = await prisma.crmStage.findFirst({
      orderBy: { order: "asc" },
      select: { id: true },
    });
    if (defaultStage) {
      await prisma.crmCard.create({
        data: {
          title: data.company ? `${data.name} (${data.company})` : data.name,
          stageId: defaultStage.id,
          source: "Site Oficial Grupo Q-Max",
          sourceInfo: data.message || undefined,
          referredBy: data.phone || undefined,
          comment: `Lead captado no site oficial.\nE-mail: ${data.email}\nTelefone: ${data.phone}\nEmpresa: ${data.company || "Não informada"}\nMensagem: ${data.message || "Sem mensagem adicional"}`,
        },
      }).catch((err) => console.error("Falha ao registrar card automático no CRM:", err));
    }
  } catch (error) {
    console.error("Error creating lead:", error);
    return NextResponse.json({ error: "Failed to save lead" }, { status: 500 });
  }

  const notifyTo = process.env.LEADS_NOTIFY_TO?.trim();
  if (notifyTo) {
    after(async () => {
      const rows = [
        ["Nome", data.name],
        ["Empresa", data.company ?? ""],
        ["Telefone", data.phone],
        ["E-mail", data.email],
        ["Mensagem", data.message],
      ]
        .filter(([, value]) => value)
        .map(([label, value]) => `<p><strong>${label}:</strong> ${escapeHtml(value)}</p>`)
        .join("");
      try {
        await sendMail(notifyTo, `Novo lead no site: ${data.name}`, rows);
      } catch (error) {
        console.error("Error sending lead e-mail:", error instanceof Error ? error.message : error);
      }
    });
  }

  return NextResponse.json({ success: true });
}

export async function GET() {
  const cookieStore = await cookies();
  if (!isAdminToken(cookieStore.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const leads = await prisma.contactLead.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    return NextResponse.json(leads);
  } catch (error) {
    console.error("Error fetching leads:", error);
    return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
  }
}

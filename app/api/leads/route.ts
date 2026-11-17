import { NextRequest, NextResponse, after } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { isAdminToken } from "@/lib/settings";
import { ADMIN_COOKIE } from "@/lib/auth";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { escapeHtml, sendMail } from "@/lib/mail";
import { legal } from "@/data/site";

// Prisma String columns are varchar(191)
const field = (value: unknown) => (typeof value === "string" ? value.trim().slice(0, 191) : "");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Brazilian phone: 10 to 13 digits once punctuation is removed (with or without +55). */
const validPhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 13;
};

/**
 * Public lead form (QuickLeadModal). Open endpoint: validated, rate limited, answers only success.
 * LGPD: refuses the lead without the visitor's explicit consent and records when and which policy
 * version was accepted. Keeps only the fields the form asks for (data minimisation).
 */
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
  if (body.consent !== true) return NextResponse.json({ error: "Consent is required" }, { status: 400 });
  if (data.name.length < 2) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (data.email && !EMAIL_RE.test(data.email)) return NextResponse.json({ error: "Invalid e-mail" }, { status: 400 });
  if (data.phone && !validPhone(data.phone)) return NextResponse.json({ error: "Invalid phone" }, { status: 400 });

  try {
    await prisma.contactLead.create({
      data: { ...data, consentAt: new Date(), privacyVersion: legal.privacyVersion },
    });

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

async function isAdmin() {
  const cookieStore = await cookies();
  return isAdminToken(cookieStore.get(ADMIN_COOKIE)?.value);
}

export async function GET() {
  if (!(await isAdmin())) {
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

/**
 * Deletes leads for a data subject request (LGPD Art. 18, VI). Admin only.
 * `?id=` removes one lead; `?email=` and/or `?phone=` remove every lead of that person.
 */
export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const params = req.nextUrl.searchParams;
  const id = params.get("id")?.trim();
  const email = params.get("email")?.trim();
  const phone = params.get("phone")?.trim();
  if (!id && !email && !phone) {
    return NextResponse.json({ error: "id, email or phone is required" }, { status: 400 });
  }
  const or = [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])];
  try {
    const { count } = await prisma.contactLead.deleteMany({ where: id ? { id } : { OR: or } });
    return NextResponse.json({ deleted: count });
  } catch (error) {
    console.error("Error deleting lead:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Failed to delete lead" }, { status: 500 });
  }
}

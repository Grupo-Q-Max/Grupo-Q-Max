import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Webhook receptor de leads de Eventos (Finora Experience).
 * Chamado pelo backend de eventos (CrmService) sempre que um participante se cadastra
 * ou ganha um prêmio no estande.
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
      return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
    }

    const lead = payload.lead || {};
    const event = payload.event || {};
    const prize = payload.prize;
    const type = payload.type || "lead";

    const name = typeof lead.name === "string" ? lead.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "Nome do lead ausente" }, { status: 400 });
    }

    const email = typeof lead.email === "string" ? lead.email.trim() : "";
    const phone = typeof lead.phone === "string" ? lead.phone.trim() : "";
    const clinic = typeof lead.clinic === "string" ? lead.clinic.trim() : "";
    const cro = typeof lead.cro === "string" ? lead.cro.trim() : "";
    const croState = typeof lead.croState === "string" ? lead.croState.trim() : "";
    const chairsCount = typeof lead.chairsCount === "number" ? lead.chairsCount : null;
    const eventName = event.name || "Finora Experience";
    const eventSlug = event.slug || "invictus";

    // 1. Salva ou atualiza na tabela de ContactLead
    await prisma.contactLead.create({
      data: {
        name,
        email,
        phone,
        company: clinic || "Clínica Odontológica",
        message: `Lead captado no evento ${eventName}.\nCRO: ${cro}/${croState}\nCadeiras: ${chairsCount ?? "Não informado"}\nPrêmio: ${prize?.name || "Aguardando giro"}\nTipo do evento: ${type}`,
      },
    }).catch((err) => console.error("Erro ao salvar ContactLead de evento:", err));

    // 2. Localiza o primeiro estágio de entrada do CRM
    const defaultStage = await prisma.crmStage.findFirst({
      orderBy: { order: "asc" },
      select: { id: true },
    });

    if (!defaultStage) {
      return NextResponse.json({ success: true, message: "Lead registrado em ContactLead (CRM sem estágios configurados)" });
    }

    // Classificação
    const isVipChairs = (chairsCount || 0) >= 6;
    const cardTitle = clinic ? `${name} (${clinic})` : name;
    const prizeInfo = prize?.name ? ` | Ganhou: ${prize.name}` : "";

    // 3. Cria o Card no Kanban do CRM Q-Max
    const card = await prisma.crmCard.create({
      data: {
        title: cardTitle,
        stageId: defaultStage.id,
        source: `Evento: ${eventName}`,
        sourceInfo: `CRO ${cro}/${croState} · ${chairsCount ? `${chairsCount} cadeiras` : "Cadeiras N/I"}${prizeInfo}`,
        referredBy: phone || undefined,
        comment: [
          `🎪 Lead captado no estande: ${eventName} (${eventSlug})`,
          `👤 Nome: ${name}`,
          `📱 WhatsApp: ${phone || "Não informado"}`,
          `✉️ E-mail: ${email || "Não informado"}`,
          `🏥 Clínica: ${clinic || "Não informada"}`,
          `🦷 CRO: ${cro ? `${cro}/${croState}` : "Não informado"}`,
          `💺 Cadeiras: ${chairsCount ? `${chairsCount} cadeiras` : "Não informado"}${isVipChairs ? " (Clínica Grande Porte / VIP)" : ""}`,
          `🎁 Prêmio na Roleta: ${prize?.name || "Aguardando giro / Não sorteado"}`,
          `🕒 Data Cadastro: ${lead.registeredAt || new Date().toISOString()}`,
        ].join("\n"),
        customData: {
          eventSlug,
          eventId: event.id,
          participationId: payload.participation?.id,
          chairsCount,
          croNumber: cro,
          croState,
          prizeName: prize?.name || null,
          isVipChairs,
          origin: "finora-experience",
        },
      },
    });

    return NextResponse.json({ success: true, dealId: card.id, number: card.number });
  } catch (error) {
    console.error("Erro no webhook de leads do evento:", error);
    return NextResponse.json({ error: "Erro interno ao processar lead" }, { status: 500 });
  }
}

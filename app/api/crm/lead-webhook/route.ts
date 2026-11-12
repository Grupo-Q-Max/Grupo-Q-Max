import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Retorna ou cria o pipeline/funil dedicado exclusivo para eventos no CRM.
 * Garante que os leads do evento fiquem isolados do funil comercial geral.
 */
async function getOrCreateEventPipeline(eventName: string, eventSlug: string) {
  // 1. Garante o espaço (Space) "Eventos" na barra lateral do CRM
  let space = await prisma.crmSpace.findUnique({
    where: { name: "Eventos" },
  }).catch(() => null);

  if (!space) {
    space = await prisma.crmSpace.create({
      data: {
        name: "Eventos",
        order: 2,
      },
    }).catch(async () => {
      return prisma.crmSpace.findUnique({ where: { name: "Eventos" } });
    });
  }

  const pipelineName =
    eventName.toLowerCase().includes("invictus") || eventSlug.toLowerCase().includes("invictus")
      ? "Finora Experience - Invictus"
      : `Evento - ${eventName || "Finora Experience"}`;

  // 2. Busca pipeline existente
  let pipeline = await prisma.crmPipeline.findFirst({
    where: { name: pipelineName },
    include: {
      stages: { orderBy: { order: "asc" } },
    },
  });

  if (!pipeline) {
    pipeline = await prisma.crmPipeline.create({
      data: {
        name: pipelineName,
        spaceId: space?.id ?? null,
        kind: "DEALS",
        order: 0,
        stages: {
          create: [
            { name: "🎪 Cadastrado no Estande", order: 0, color: "#3b82f6" },
            { name: "📲 1º Contato (WhatsApp)", order: 1, color: "#8b5cf6" },
            { name: "📅 Diagnóstico Agendado", order: 2, color: "#ec4899" },
            { name: "💼 Proposta Apresentada", order: 3, color: "#f59e0b" },
            { name: "🏆 Fechado / Cliente", order: 4, color: "#10b981" },
            { name: "❌ Sem Retorno / Perdido", order: 5, color: "#64748b" },
          ],
        },
      },
      include: {
        stages: { orderBy: { order: "asc" } },
      },
    });
  }

  return pipeline;
}

/**
 * Garante ou busca tags no CRM (ex: "Finora Invictus", "VIP (6+ Cadeiras)")
 */
async function getOrCreateTag(name: string, color: string) {
  try {
    const existing = await prisma.crmTag.findUnique({ where: { name } });
    if (existing) return existing.id;
    const created = await prisma.crmTag.create({ data: { name, color } });
    return created.id;
  } catch {
    const fallback = await prisma.crmTag.findUnique({ where: { name } });
    return fallback?.id ?? null;
  }
}

/**
 * Webhook receptor de leads de Eventos (Finora Experience).
 * Cria cards exclusivamente dentro do Pipeline dedicado de Eventos.
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
    const participationId = payload.participation?.id ? Number(payload.participation.id) : null;

    const name = typeof lead.name === "string" ? lead.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "Nome do lead ausente" }, { status: 400 });
    }

    const email = typeof lead.email === "string" ? lead.email.trim() : "";
    const phone = typeof lead.phone === "string" ? lead.phone.trim() : "";
    const clinic = typeof lead.clinic === "string" ? lead.clinic.trim() : "";
    const cro = typeof lead.cro === "string" ? lead.cro.trim() : "";
    const croState = typeof lead.croState === "string" ? lead.croState.trim() : "";
    const city = typeof lead.city === "string" ? lead.city.trim() : "";
    const state = typeof lead.state === "string" ? lead.state.trim() : "";
    const chairsCount = typeof lead.chairsCount === "number" ? lead.chairsCount : null;
    const eventName = event.name || "Finora Experience";
    const eventSlug = event.slug || "invictus";

    // 1. Salva ou atualiza histórico na tabela ContactLead
    await prisma.contactLead.create({
      data: {
        name,
        email,
        phone,
        company: clinic || "Clínica Odontológica",
        message: [
          `Lead captado no evento: ${eventName} (${eventSlug})`,
          `CRO: ${cro ? `${cro}/${croState}` : "N/I"}`,
          `Cidade/UF: ${city || "N/I"} - ${state || "N/I"}`,
          `Cadeiras: ${chairsCount ?? "Não informado"}`,
          `Prêmio: ${prize?.name || "Aguardando giro na roleta"}`,
          `Tipo webhook: ${type}`,
        ].join("\n"),
      },
    }).catch((err) => console.error("Erro ao salvar ContactLead de evento:", err));

    // 2. Obtém o Pipeline dedicado exclusivo para este Evento
    const pipeline = await getOrCreateEventPipeline(eventName, eventSlug);
    const entryStage = pipeline.stages[0];

    if (!entryStage) {
      return NextResponse.json({
        success: true,
        message: "Lead registrado em ContactLead (Pipeline sem estágios)",
      });
    }

    // 3. Classificação e formatação
    const isVipChairs = (chairsCount || 0) >= 6;
    const cardTitle = clinic ? `${name} · ${clinic}` : name;
    const prizeInfo = prize?.name ? ` | 🎁 Prêmio: ${prize.name}` : "";

    // 4. Prevenção de duplicidade: se este participante já tiver card no funil de eventos
    const existingCards = await prisma.crmCard.findMany({
      where: {
        stage: { pipelineId: pipeline.id },
        OR: [
          ...(phone ? [{ referredBy: phone }] : []),
          ...(participationId ? [{ customData: { path: "$.participationId", equals: participationId } }] : []),
        ],
      },
      take: 1,
    });

    const existingCard = existingCards[0];

    if (existingCard) {
      // Se já existe e recebemos atualização de prêmio da roleta
      const updatedComment = [
        existingCard.comment || "",
        "",
        `--- Atualização (${new Date().toLocaleTimeString("pt-BR")}) ---`,
        prize?.name ? `🎁 Roleta Girada: Ganhou "${prize.name}"` : `Tipo de evento: ${type}`,
      ].join("\n").trim();

      const updatedCard = await prisma.crmCard.update({
        where: { id: existingCard.id },
        data: {
          comment: updatedComment,
          sourceInfo: `CRO ${cro}/${croState} · ${chairsCount ? `${chairsCount} cadeiras` : "Cadeiras N/I"}${prizeInfo}`,
          customData: {
            ...(existingCard.customData as object || {}),
            prizeName: prize?.name || null,
            rouletteDrawnAt: prize?.drawnAt || null,
          },
        },
      });

      return NextResponse.json({
        success: true,
        updated: true,
        dealId: updatedCard.id,
        number: updatedCard.number,
        pipelineId: pipeline.id,
        pipelineName: pipeline.name,
      });
    }

    // 5. Prepara tags do CRM
    const tagIds: string[] = [];
    const eventTagId = await getOrCreateTag("Finora Invictus", "#3b82f6");
    if (eventTagId) tagIds.push(eventTagId);

    if (isVipChairs) {
      const vipTagId = await getOrCreateTag("VIP (6+ Cadeiras)", "#f59e0b");
      if (vipTagId) tagIds.push(vipTagId);
    }

    // 6. Criação do Card exclusivo no Kanban de Eventos
    const card = await prisma.crmCard.create({
      data: {
        title: cardTitle,
        stageId: entryStage.id,
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
          `📍 Localização: ${city || "N/I"} - ${state || "N/I"}`,
          `💺 Cadeiras: ${chairsCount ? `${chairsCount} cadeiras` : "Não informado"}${isVipChairs ? " ⭐ [CLÍNICA GRANDE PORTE / VIP]" : ""}`,
          `🎁 Prêmio na Roleta: ${prize?.name || "Aguardando giro na roleta"}`,
          `🕒 Data Cadastro: ${lead.registeredAt || new Date().toISOString()}`,
        ].join("\n"),
        customData: {
          eventSlug,
          eventId: event.id,
          participationId,
          chairsCount,
          croNumber: cro,
          croState,
          city,
          state,
          prizeName: prize?.name || null,
          isVipChairs,
          origin: "finora-experience",
        },
        tags: tagIds.length > 0 ? {
          create: tagIds.map((tagId) => ({ tagId })),
        } : undefined,
      },
    });

    return NextResponse.json({
      success: true,
      created: true,
      dealId: card.id,
      number: card.number,
      pipelineId: pipeline.id,
      pipelineName: pipeline.name,
      stageName: entryStage.name,
    });
  } catch (error) {
    console.error("Erro no webhook de leads do evento:", error);
    return NextResponse.json({ error: "Erro interno ao processar lead" }, { status: 500 });
  }
}

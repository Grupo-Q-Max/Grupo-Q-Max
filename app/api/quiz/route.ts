import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const wait = await rateLimit(`quiz:ip:${clientIp(req)}`, 10, 10 * 60_000);
  if (wait) return tooManyRequests(wait);

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const { name, email, phone, score, totalQuestions, answers, mysteryGuess } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
  }

  const cleanName = name.trim().slice(0, 191);
  const cleanEmail = typeof email === "string" ? email.trim().slice(0, 191) : "";
  const cleanPhone = typeof phone === "string" ? phone.trim().slice(0, 50) : "";
  const cleanScore = typeof score === "number" ? score : 0;
  const cleanTotal = typeof totalQuestions === "number" ? totalQuestions : 12;
  const cleanGuess = typeof mysteryGuess === "string" ? mysteryGuess.trim().slice(0, 200) : "";

  try {
    // 1. Salva como lead do contato
    await prisma.contactLead.create({
      data: {
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        company: "Participante Quiz Q-Max",
        message: `Pontuação no Quiz: ${cleanScore}/${cleanTotal} acertos.\nPalpite pessoa misteriosa: ${cleanGuess || "Nenhum"}\nRespostas detalhadas registradas.`,
      },
    });

    // 2. Injeta automaticamente no primeiro estágio do funil do CRM
    const defaultStage = await prisma.crmStage.findFirst({
      orderBy: { order: "asc" },
      select: { id: true },
    });

    if (defaultStage) {
      await prisma.crmCard.create({
        data: {
          title: `${cleanName} · Quiz Q-Max (${cleanScore}/${cleanTotal})`,
          stageId: defaultStage.id,
          source: "Quiz Q-Max",
          sourceInfo: `Acertos: ${cleanScore} de ${cleanTotal} (${Math.round((cleanScore / cleanTotal) * 100)}%)`,
          referredBy: cleanPhone || undefined,
          comment: `Participante completou o Quiz Q-Max!\nNome: ${cleanName}\nE-mail: ${cleanEmail}\nWhatsApp: ${cleanPhone}\nPontuação: ${cleanScore}/${cleanTotal}\nPalpite da Pessoa Misteriosa: ${cleanGuess || "Não informado"}`,
          customData: {
            quizScore: cleanScore,
            quizTotal: cleanTotal,
            mysteryGuess: cleanGuess,
            completedAt: new Date().toISOString(),
          },
        },
      }).catch((err) => console.error("Erro ao criar card no CRM pelo Quiz:", err));
    }

    return NextResponse.json({ success: true, score: cleanScore, total: cleanTotal });
  } catch (error) {
    console.error("Erro ao salvar resultado do Quiz:", error);
    return NextResponse.json({ error: "Erro interno ao registrar resultado" }, { status: 500 });
  }
}

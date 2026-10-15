import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { denyUnless } from "@/lib/crm-access";
import { isMonthKey, monthStart } from "@/lib/crm-goals";

/** Sets a member's goal for a month ("YYYY-MM"); an empty or zero amount removes it. */
export async function PUT(req: Request) {
  const denied = await denyUnless("goal.manage");
  if (denied) return denied;

  const { memberId, month, amount } = await req.json().catch(() => ({}));
  const value = amount === null || amount === "" ? 0 : Number(amount);
  if (typeof memberId !== "string" || !isMonthKey(month) || !Number.isFinite(value) || value < 0 || value >= 1e10) {
    return NextResponse.json({ error: "Meta inválida." }, { status: 400 });
  }
  if (!(await prisma.teamMember.findUnique({ where: { id: memberId }, select: { id: true } }))) {
    return NextResponse.json({ error: "Responsável não encontrado." }, { status: 404 });
  }

  const key = { memberId_month: { memberId, month: monthStart(month) } };
  if (!value) {
    await prisma.crmGoal.deleteMany({ where: key.memberId_month });
    return NextResponse.json({ memberId, month, amount: 0 });
  }
  const amountFixed = value.toFixed(2);
  await prisma.crmGoal.upsert({
    where: key,
    create: { ...key.memberId_month, amount: amountFixed },
    update: { amount: amountFixed },
  });
  return NextResponse.json({ memberId, month, amount: Number(amountFixed) });
}

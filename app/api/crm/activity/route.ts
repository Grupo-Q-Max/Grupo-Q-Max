import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { cardId, type, content, dueDate } = await req.json();
    if (!cardId || !content) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const activity = await prisma.crmActivity.create({
      data: {
        cardId,
        type,
        content,
        dueDate: dueDate ? new Date(dueDate) : null
      }
    });

    return NextResponse.json(activity);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

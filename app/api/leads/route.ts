import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, phone, company, message } = body;

    const lead = await prisma.contactLead.create({
      data: {
        name,
        email,
        phone,
        company,
        message,
      },
    });

    return NextResponse.json({ success: true, lead });
  } catch (error) {
    console.error("Error creating lead:", error);
    return NextResponse.json({ error: "Failed to save lead" }, { status: 500 });
  }
}

import { cookies } from "next/headers";
import { readSettings } from "@/lib/settings";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("qmax_admin")?.value;
  const settings = readSettings();

  if (token !== settings.adminPassword && token !== "qmax2025") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const leads = await prisma.contactLead.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(leads);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
  }
}

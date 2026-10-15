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
import { isAdminToken } from "@/lib/settings";
import { ADMIN_COOKIE } from "@/lib/auth";

export async function GET() {
  const cookieStore = await cookies();
  if (!isAdminToken(cookieStore.get(ADMIN_COOKIE)?.value)) {
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

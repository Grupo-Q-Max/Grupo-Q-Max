import fs from "fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { denyUnlessPipeline } from "@/lib/crm-access";
import { attachmentPath } from "@/lib/crm-attachments";

/** Downloads an attachment, only for users who see its card's pipeline. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const attachment = await prisma.crmAttachment.findUnique({ where: { id }, select: { cardId: true, fileName: true, originalName: true, mimeType: true } });
  const hidden = await denyUnlessPipeline({ cardId: attachment?.cardId });
  if (hidden || !attachment) return hidden ?? NextResponse.json({ error: "Not found" }, { status: 404 });

  const data = await fs.readFile(attachmentPath(attachment.fileName)).catch(() => null);
  if (!data) return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
  return new NextResponse(data, {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(attachment.originalName)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}

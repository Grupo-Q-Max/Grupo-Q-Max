import fs from "fs/promises";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { denyUnless, denyUnlessPipeline } from "@/lib/crm-access";
import { sessionMemberId } from "@/lib/auth";
import {
  ATTACHMENT_TYPES,
  MAX_ATTACHMENT_BYTES,
  attachmentExtension,
  attachmentPath,
  attachmentSelect,
} from "@/lib/crm-attachments";

/** Attachments of a card (`?cardId=`), newest first. */
export async function GET(req: Request) {
  const cardId = new URL(req.url).searchParams.get("cardId");
  if (!cardId) return NextResponse.json({ error: "Missing cardId" }, { status: 400 });
  const hidden = await denyUnlessPipeline({ cardId });
  if (hidden) return hidden;

  const attachments = await prisma.crmAttachment.findMany({ where: { cardId }, orderBy: { createdAt: "desc" }, select: attachmentSelect });
  return NextResponse.json(attachments);
}

/** Uploads a file to a card: multipart `cardId` + `file`. */
export async function POST(req: Request) {
  try {
    const denied = await denyUnless("deal.edit");
    if (denied) return denied;
    const form = await req.formData();
    const cardId = form.get("cardId");
    const file = form.get("file");
    if (typeof cardId !== "string" || !(file instanceof File)) return NextResponse.json({ error: "Arquivo ausente." }, { status: 400 });
    const hidden = await denyUnlessPipeline({ cardId });
    if (hidden) return hidden;

    const ext = attachmentExtension(file.name);
    if (!ATTACHMENT_TYPES[ext]) return NextResponse.json({ error: "Tipo de arquivo não permitido." }, { status: 400 });
    if (file.size === 0 || file.size > MAX_ATTACHMENT_BYTES) {
      return NextResponse.json({ error: "O arquivo deve ter até 8 MB." }, { status: 400 });
    }

    const fileName = `${randomUUID()}.${ext}`;
    await fs.writeFile(attachmentPath(fileName), Buffer.from(await file.arrayBuffer()));
    try {
      const attachment = await prisma.crmAttachment.create({
        data: {
          cardId,
          fileName,
          originalName: file.name.slice(0, 255),
          mimeType: ATTACHMENT_TYPES[ext],
          size: file.size,
          uploadedById: sessionMemberId(req),
        },
        select: attachmentSelect,
      });
      return NextResponse.json(attachment);
    } catch (error) {
      await fs.rm(attachmentPath(fileName), { force: true });
      throw error;
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/** Deletes an attachment (`?id=`) and its file. */
export async function DELETE(req: Request) {
  try {
    const denied = await denyUnless("deal.edit");
    if (denied) return denied;
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const attachment = await prisma.crmAttachment.findUnique({ where: { id }, select: { cardId: true, fileName: true } });
    const hidden = await denyUnlessPipeline({ cardId: attachment?.cardId });
    if (hidden || !attachment) return hidden ?? NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.crmAttachment.delete({ where: { id } });
    await fs.rm(attachmentPath(attachment.fileName), { force: true });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

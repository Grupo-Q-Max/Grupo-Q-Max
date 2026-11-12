import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { denyUnless } from "@/lib/crm-access";
import { sessionMemberId } from "@/lib/auth";
import { isPermission } from "@/lib/crm-permissions";
import { hasCode, isNotFound, isUniqueViolation } from "@/lib/prisma-errors";

/** Valid, distinct permission keys of a request body, as rows for CrmGroupPermission. */
const permissionRows = (value: unknown) =>
  [...new Set(Array.isArray(value) ? value.filter(isPermission) : [])].map((permission) => ({ permission }));

const nameTaken = (error: unknown) =>
  isUniqueViolation(error)
    ? NextResponse.json({ error: "Já existe um grupo com este nome." }, { status: 409 })
    : null;

/** Creates a group: `{ name, permissions: string[] }`. */
export async function POST(req: Request) {
  try {
    const denied = await denyUnless("access.manage");
    if (denied) return denied;
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "Informe o nome do grupo." }, { status: 400 });

    const group = await prisma.crmGroup.create({ data: { name, permissions: { create: permissionRows(body.permissions) } } });
    return NextResponse.json(group);
  } catch (error) {
    const taken = nameTaken(error);
    if (taken) return taken;
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * Updates a group: `{ id, name?, permissions?, isDefault? }`. `permissions` replace the current
 * ones (ignored for the admin group, which has all); `isDefault: true` moves the default flag to it.
 */
export async function PUT(req: Request) {
  try {
    const denied = await denyUnless("access.manage");
    if (denied) return denied;
    const body = await req.json();
    const current = await prisma.crmGroup.findUnique({ where: { id: String(body.id ?? "") } });
    if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const name = body.name === undefined ? undefined : String(body.name).trim();
    if (name === "") return NextResponse.json({ error: "Informe o nome do grupo." }, { status: 400 });
    if (body.isDefault === true && current.isAdmin) {
      return NextResponse.json({ error: "O grupo de administradores não pode ser o grupo padrão." }, { status: 400 });
    }

    const group = await prisma.$transaction(async (tx) => {
      if (body.isDefault === true) await tx.crmGroup.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
      return tx.crmGroup.update({
        where: { id: current.id },
        data: {
          ...(name && { name }),
          ...(body.isDefault === true && { isDefault: true }),
          ...(body.permissions !== undefined &&
            !current.isAdmin && { permissions: { deleteMany: {}, create: permissionRows(body.permissions) } }),
        },
      });
    });
    return NextResponse.json(group);
  } catch (error) {
    const taken = nameTaken(error);
    if (taken) return taken;
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/** Deletes a group; its members fall back to the default group. The admin and default groups can't be deleted. */
export async function DELETE(req: Request) {
  try {
    const denied = await denyUnless("access.manage");
    if (denied) return denied;
    const id = new URL(req.url).searchParams.get("id") ?? "";
    const group = await prisma.crmGroup.findUnique({ where: { id } });
    if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (group.isAdmin || group.isDefault) {
      return NextResponse.json({ error: "O grupo de administradores e o grupo padrão não podem ser excluídos." }, { status: 400 });
    }

    await prisma.crmGroup.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * Updates a member's access: `{ memberId, groupId? }` moves them to a group (`groupId: null` = default
 * group); `{ memberId, crmActive? }` blocks (false) or unblocks them.
 */
export async function PATCH(req: Request) {
  try {
    const denied = await denyUnless("access.manage");
    if (denied) return denied;
    const body = await req.json();
    const memberId = String(body.memberId ?? "");
    if (!memberId) return NextResponse.json({ error: "Missing memberId" }, { status: 400 });
    if (body.crmActive === false && memberId === sessionMemberId(req)) {
      return NextResponse.json({ error: "Você não pode bloquear a si mesmo." }, { status: 400 });
    }

    await prisma.teamMember.update({
      where: { id: memberId },
      data: {
        ...("groupId" in body && { crmGroupId: body.groupId ? String(body.groupId) : null }),
        ...(typeof body.crmActive === "boolean" && { crmActive: body.crmActive }),
      },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (hasCode(error, "P2003") || isNotFound(error)) {
      return NextResponse.json({ error: "Usuário ou grupo não encontrado." }, { status: 404 });
    }
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

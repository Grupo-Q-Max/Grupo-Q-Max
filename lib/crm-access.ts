import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession, SESSION_COOKIE } from "@/lib/auth";
import { isAdminToken } from "@/lib/settings";
import { ALL_PERMISSIONS, DEFAULT_USER_PERMISSIONS, isPermission, type Permission } from "@/lib/crm-permissions";

const groupSelect = { isAdmin: true, permissions: { select: { permission: true } } } as const;

let groupsReady: Promise<void> | null = null;

/** Creates "Administradores" (every permission) and "Usuários" (the default group) the first time the CRM runs. */
export function ensureGroups() {
  groupsReady ??= (async () => {
    if (await prisma.crmGroup.count()) return;
    await prisma.$transaction([
      prisma.crmGroup.create({ data: { name: "Administradores", isAdmin: true } }),
      prisma.crmGroup.create({
        data: {
          name: "Usuários",
          isDefault: true,
          permissions: { create: DEFAULT_USER_PERMISSIONS.map((permission) => ({ permission })) },
        },
      }),
    ]);
  })().catch((error) => {
    groupsReady = null;
    throw error;
  });
  return groupsReady;
}

/** Permissions of a team member: those of their group, or of the default group when they have none. Blocked members have none. */
export async function memberPermissions(memberId: string | null): Promise<Set<Permission>> {
  if (!memberId) return new Set();
  await ensureGroups();
  const member = await prisma.teamMember.findUnique({ where: { id: memberId }, select: { crmActive: true, crmGroup: { select: groupSelect } } });
  if (!member?.crmActive) return new Set();
  const group = member.crmGroup ?? (await prisma.crmGroup.findFirst({ where: { isDefault: true }, select: groupSelect }));
  if (!group) return new Set();
  if (group.isAdmin) return new Set(ALL_PERMISSIONS);
  return new Set(group.permissions.map((p) => p.permission).filter(isPermission));
}

/**
 * Permissions of the current request (pages, layouts and route handlers). The site
 * admin (/admin cookie) may always manage access, so a CRM without any admin can be recovered.
 */
export async function currentPermissions() {
  const jar = await cookies();
  const permissions = await memberPermissions(readSession(jar.get(SESSION_COOKIE)?.value));
  if (isAdminToken(jar.get("qmax_admin")?.value)) permissions.add("access.manage");
  return permissions;
}

/** 403 response when the current user lacks `permission`, else null: `const denied = await denyUnless("x"); if (denied) return denied;` */
export async function denyUnless(permission: Permission) {
  if ((await currentPermissions()).has(permission)) return null;
  return NextResponse.json({ error: "Você não tem permissão para esta ação." }, { status: 403 });
}

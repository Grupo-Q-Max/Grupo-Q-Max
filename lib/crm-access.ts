import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ADMIN_COOKIE, readSession, SESSION_COOKIE } from "@/lib/auth";
import { isAdminToken } from "@/lib/settings";
import { ALL_PERMISSIONS, DEFAULT_USER_PERMISSIONS, isPermission, type Permission } from "@/lib/crm-permissions";

const groupSelect = { id: true, isAdmin: true, permissions: { select: { permission: true } } } as const;

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

/**
 * crmGroupId change for the /admin "Administrador do CRM" switch: true moves the member to the
 * admin group, false takes them out of it (to the default group). Other groups are left alone.
 */
export async function adminGroupChange(crmAdmin: unknown, currentGroupId: string | null) {
  if (typeof crmAdmin !== "boolean") return {};
  await ensureGroups();
  const admin = await prisma.crmGroup.findFirst({ where: { isAdmin: true }, select: { id: true } });
  if (!admin) return {};
  if (crmAdmin) return { crmGroupId: admin.id };
  return currentGroupId === admin.id ? { crmGroupId: null } : {};
}

/** Group of a team member, or the default group when they have none. Null for blocked or unknown members. */
async function memberGroup(memberId: string | null) {
  if (!memberId) return null;
  await ensureGroups();
  const member = await prisma.teamMember.findUnique({ where: { id: memberId }, select: { crmActive: true, crmGroup: { select: groupSelect } } });
  if (!member?.crmActive) return null;
  return member.crmGroup ?? (await prisma.crmGroup.findFirst({ where: { isDefault: true }, select: groupSelect }));
}

/** Permissions of a team member: those of their group, or of the default group when they have none. Blocked members have none. */
export async function memberPermissions(memberId: string | null): Promise<Set<Permission>> {
  const group = await memberGroup(memberId);
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
  if (isAdminToken(jar.get(ADMIN_COOKIE)?.value)) permissions.add("access.manage");
  return permissions;
}

/** 403 response when the current user lacks `permission`, else null: `const denied = await denyUnless("x"); if (denied) return denied;` */
export async function denyUnless(permission: Permission) {
  if ((await currentPermissions()).has(permission)) return null;
  return NextResponse.json({ error: "Você não tem permissão para esta ação." }, { status: 403 });
}

/**
 * Pipelines the current user sees: admin groups see all; others see pipelines with no group
 * and no member (open to everyone), or opened to their group or to them. Use as `where` on CrmPipeline.
 */
export async function visiblePipelineWhere(): Promise<Prisma.CrmPipelineWhereInput> {
  return pipelineWhereFor(readSession((await cookies()).get(SESSION_COOKIE)?.value));
}

/** visiblePipelineWhere for any member (e.g. who may be notified about a card). Blocked members see only open pipelines. */
export async function pipelineWhereFor(memberId: string | null): Promise<Prisma.CrmPipelineWhereInput> {
  const group = await memberGroup(memberId);
  if (group?.isAdmin) return {};
  return {
    OR: [
      { groups: { none: {} }, members: { none: {} } },
      ...(group && memberId
        ? [{ groups: { some: { groupId: group.id } } }, { members: { some: { memberId } } }]
        : []),
    ],
  };
}

type PipelineRef = { pipelineId?: string | null; stageId?: string | null; cardId?: string | null };

/** True when every given pipeline/stage/card exists and belongs to a pipeline the current user sees. */
export async function canSeePipeline(ref: PipelineRef) {
  const visible = await visiblePipelineWhere();
  const checks: Promise<number>[] = [];
  if (ref.pipelineId) checks.push(prisma.crmPipeline.count({ where: { id: ref.pipelineId, ...visible } }));
  if (ref.stageId) checks.push(prisma.crmStage.count({ where: { id: ref.stageId, pipeline: visible } }));
  if (ref.cardId) checks.push(prisma.crmCard.count({ where: { id: ref.cardId, stage: { pipeline: visible } } }));
  return checks.length > 0 && (await Promise.all(checks)).every((n) => n > 0);
}

/** 404 when the pipeline/stage/card is missing or hidden from the current user (hidden looks missing), else null. */
export async function denyUnlessPipeline(ref: PipelineRef) {
  if (await canSeePipeline(ref)) return null;
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

import type { TeamMember, TeamPartner } from "@prisma/client";
import { isArea } from "@/lib/crm-areas";
import { isUniqueViolation } from "@/lib/prisma-errors";

/**
 * Team members live in the TeamMember table (they are also the CRM users:
 * responsável / observadores). Partners (sócios) also have a TeamPartner row with their profile on the site;
 * employees have none, so they can't appear there. The API keeps the shape the admin and the site already use,
 * where the photo is called `image`.
 */
export function toTeamDto(
  member: TeamMember & { crmGroup?: { isAdmin: boolean } | null; partner?: TeamPartner | null }
) {
  const { partner } = member;
  return {
    id: member.id,
    name: member.name,
    role: member.role,
    sector: member.sector,
    area: member.area,
    image: member.photo,
    order: member.order,
    email: member.email,
    /** Already signed in to the CRM with Microsoft */
    crmLinked: Boolean(member.microsoftOid),
    /** In the CRM admin group (every permission, sees every pipeline); needs `include: teamInclude` */
    crmAdmin: Boolean(member.crmGroup?.isAdmin),
    /** Site profile, only for partners; needs `include: teamInclude` */
    partner: partner
      ? { accentColor: partner.accentColor, linkedin: partner.linkedin, bio: partner.bio, visible: partner.visible }
      : null,
  };
}

/** Include for TeamMember queries whose result goes through toTeamDto. */
export const teamInclude = { crmGroup: { select: { isAdmin: true } }, partner: true } as const;

/** What the public site may see: partners only, without CRM login data. */
export function toPublicTeamDto(member: TeamMember & { partner: TeamPartner }) {
  const { email, crmLinked, area, crmAdmin, partner, ...dto } = toTeamDto(member);
  const { accentColor, linkedin, bio } = member.partner;
  return { ...dto, accentColor, linkedin, bio };
}

/** 409 response for a duplicated CRM e-mail (unique constraint), else rethrows. */
export function emailTakenResponse(error: unknown) {
  if (isUniqueViolation(error)) {
    return Response.json({ error: "Este e-mail já é usado por outro membro" }, { status: 409 });
  }
  throw error;
}

const optionalText = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

type TeamFields = Partial<Pick<TeamMember, "name" | "role" | "sector" | "area" | "photo" | "order" | "email">>;

/**
 * Maps an API body to TeamMember columns, ignoring unknown and absent keys. `email` is the CRM login:
 * the member's Microsoft account is linked to it on their first sign-in.
 */
export function parseTeamInput(body: Record<string, unknown>): TeamFields {
  return {
    ...(typeof body.name === "string" && { name: body.name.trim() || "Novo Membro" }),
    ...(typeof body.role === "string" && { role: body.role.trim() }),
    ...(typeof body.sector === "string" && { sector: body.sector.trim() }),
    ...("area" in body && { area: isArea(body.area) ? body.area : null }),
    ...("image" in body && { photo: optionalText(body.image) }),
    ...(typeof body.order === "number" && { order: body.order }),
    ...("email" in body && { email: optionalText(body.email)?.toLowerCase() ?? null }),
  };
}

type PartnerFields = Partial<Pick<TeamPartner, "accentColor" | "linkedin" | "bio" | "visible">>;

/** Maps `body.partner` to TeamPartner columns; undefined when the body doesn't touch the partner profile. */
export function parsePartnerInput(body: Record<string, unknown>): PartnerFields | undefined {
  const p = body.partner;
  if (!p || typeof p !== "object") return undefined;
  const input = p as Record<string, unknown>;
  return {
    ...(typeof input.accentColor === "string" && { accentColor: input.accentColor }),
    ...("linkedin" in input && { linkedin: optionalText(input.linkedin) }),
    ...("bio" in input && { bio: optionalText(input.bio) }),
    ...(typeof input.visible === "boolean" && { visible: input.visible }),
  };
}

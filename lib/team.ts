import type { TeamMember } from "@prisma/client";
import { isArea } from "@/lib/crm-areas";

/**
 * Team members live in the TeamMember table (they are also the CRM users:
 * responsável / observadores). The API keeps the shape the admin and the site
 * already use, where the photo is called `image`.
 */
export function toTeamDto(member: TeamMember & { crmGroup?: { isAdmin: boolean } | null }) {
  return {
    id: member.id,
    name: member.name,
    role: member.role,
    sector: member.sector,
    area: member.area,
    image: member.photo,
    order: member.order,
    accentColor: member.accentColor,
    bio: member.bio,
    linkedin: member.linkedin,
    email: member.email,
    /** Already signed in to the CRM with Microsoft */
    crmLinked: Boolean(member.microsoftOid),
    showOnSite: member.showOnSite,
    /** In the CRM admin group (every permission, sees every pipeline); needs `include: teamInclude` */
    crmAdmin: Boolean(member.crmGroup?.isAdmin),
  };
}

/** Include for TeamMember queries whose result goes through toTeamDto. */
export const teamInclude = { crmGroup: { select: { isAdmin: true } } } as const;

/** What the public site may see: no CRM login data. */
export function toPublicTeamDto(member: TeamMember) {
  const { email, crmLinked, area, crmAdmin, ...dto } = toTeamDto(member);
  return dto;
}

/** 409 response for a duplicated CRM e-mail (unique constraint), else rethrows. */
export function emailTakenResponse(error: unknown) {
  if ((error as { code?: string })?.code === "P2002") {
    return Response.json({ error: "Este e-mail já é usado por outro membro" }, { status: 409 });
  }
  throw error;
}

const optionalText = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

type TeamFields = Partial<
  Pick<TeamMember, "name" | "role" | "sector" | "area" |"accentColor" | "photo" | "bio" | "linkedin" | "order" | "email" | "showOnSite">
>;

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
    ...(typeof body.accentColor === "string" && { accentColor: body.accentColor }),
    ...("image" in body && { photo: optionalText(body.image) }),
    ...("bio" in body && { bio: optionalText(body.bio) }),
    ...("linkedin" in body && { linkedin: optionalText(body.linkedin) }),
    ...(typeof body.order === "number" && { order: body.order }),
    ...(typeof body.showOnSite === "boolean" && { showOnSite: body.showOnSite }),
    ...("email" in body && { email: optionalText(body.email)?.toLowerCase() ?? null }),
  };
}

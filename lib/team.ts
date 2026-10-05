import type { TeamMember } from "@prisma/client";
import { hashPassword } from "@/lib/auth";

/**
 * Team members live in the TeamMember table (they are also the CRM users:
 * responsável / observadores). The API keeps the shape the admin and the site
 * already use, where the photo is called `image`.
 */
export function toTeamDto(member: TeamMember) {
  return {
    id: member.id,
    name: member.name,
    role: member.role,
    sector: member.sector,
    image: member.photo,
    order: member.order,
    accentColor: member.accentColor,
    bio: member.bio,
    linkedin: member.linkedin,
    email: member.email,
    hasPassword: Boolean(member.passwordHash),
    showOnSite: member.showOnSite,
  };
}

/** What the public site may see: no CRM login data. */
export function toPublicTeamDto(member: TeamMember) {
  const { email, hasPassword, ...dto } = toTeamDto(member);
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
  Pick<TeamMember, "name" | "role" | "sector" | "accentColor" | "photo" | "bio" | "linkedin" | "order" | "email" | "passwordHash" | "showOnSite" | "emailVerifiedAt">
>;

/** Maps an API body to TeamMember columns, ignoring unknown and absent keys. An empty `password` keeps the current one. */
export function parseTeamInput(body: Record<string, unknown>): TeamFields {
  return {
    ...(typeof body.name === "string" && { name: body.name.trim() || "Novo Membro" }),
    ...(typeof body.role === "string" && { role: body.role.trim() }),
    ...(typeof body.sector === "string" && { sector: body.sector.trim() }),
    ...(typeof body.accentColor === "string" && { accentColor: body.accentColor }),
    ...("image" in body && { photo: optionalText(body.image) }),
    ...("bio" in body && { bio: optionalText(body.bio) }),
    ...("linkedin" in body && { linkedin: optionalText(body.linkedin) }),
    ...(typeof body.order === "number" && { order: body.order }),
    ...(typeof body.showOnSite === "boolean" && { showOnSite: body.showOnSite }),
    ...("email" in body && { email: optionalText(body.email)?.toLowerCase() ?? null }),
    ...(typeof body.password === "string" && body.password && { passwordHash: hashPassword(body.password) }),
    // the admin vouches for the login it sets, so it needs no confirmation e-mail
    ...(("email" in body || (typeof body.password === "string" && body.password)) && { emailVerifiedAt: new Date() }),
  };
}

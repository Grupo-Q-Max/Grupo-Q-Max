import type { TeamMember } from "@prisma/client";

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
  };
}

const optionalText = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

type TeamFields = Partial<
  Pick<TeamMember, "name" | "role" | "sector" | "accentColor" | "photo" | "bio" | "linkedin" | "order">
>;

/** Maps an API body to TeamMember columns, ignoring unknown and absent keys. */
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
  };
}

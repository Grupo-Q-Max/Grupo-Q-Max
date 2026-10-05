import fs from "fs";
import path from "path";
import type { TeamMember } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getUploadsDir } from "@/lib/storage";

const GRAPH = "https://graph.microsoft.com/v1.0";

/**
 * Copies the Microsoft profile photo to a member that has none yet (a photo set in the admin is kept).
 * `accessToken` is a Graph token (User.Read) from the same sign-in; /me must return the member's own
 * oid, so a token of another account can't set this member's photo. Best effort: errors are only logged.
 */
export async function syncMicrosoftPhoto(member: TeamMember, accessToken: unknown) {
  if (member.photo || typeof accessToken !== "string" || !accessToken) return;
  try {
    const headers = { Authorization: `Bearer ${accessToken}` };
    const me = await fetch(`${GRAPH}/me?$select=id`, { headers });
    if (!me.ok || (await me.json()).id !== member.microsoftOid) return;

    // 404 = account without photo
    const res = await fetch(`${GRAPH}/me/photos/240x240/$value`, { headers });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !type.startsWith("image/")) return;

    const fileName = `team-${member.id}-${Date.now()}.${type.includes("png") ? "png" : "jpg"}`;
    fs.writeFileSync(path.join(getUploadsDir(), fileName), Buffer.from(await res.arrayBuffer()));
    await prisma.teamMember.update({ where: { id: member.id }, data: { photo: `/api/files/${fileName}` } });
  } catch (error) {
    console.warn("[auth/microsoft] photo sync failed", error);
  }
}

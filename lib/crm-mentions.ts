// @mentions in card comments (no Prisma), shared by the server and tests

/**
 * Ids of the members mentioned as "@Full Name" in `text` (case-insensitive, name not followed by
 * a letter or digit). Longer names are matched first and consumed, so "@Ana Paula" doesn't also
 * mention "Ana".
 */
export function findMentions(text: string, members: { id: string; name: string }[]) {
  let rest = text;
  const ids: string[] = [];
  for (const member of [...members].sort((a, b) => b.name.length - a.name.length)) {
    const name = member.name.trim();
    if (!name) continue;
    const pattern = new RegExp(`@${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "giu");
    if (!pattern.test(rest)) continue;
    ids.push(member.id);
    rest = rest.replace(pattern, " ");
  }
  return ids;
}

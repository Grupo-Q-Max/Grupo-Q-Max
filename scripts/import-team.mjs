/**
 * Moves the team from data/team.json into the TeamMember table (one-off migration).
 *
 *   node scripts/import-team.mjs            -> dry run, only prints what would change
 *   node scripts/import-team.mjs --apply    -> writes to the database in DATABASE_URL
 *
 * - Members are matched by name. Duplicated rows with the same name are merged
 *   into the oldest one (CRM references are moved to it) and the rest removed.
 * - Existing values in the database win; the JSON only fills empty columns
 *   (photo, bio) and the columns that didn't exist before (sector, accentColor, order).
 *
 * Run it after `prisma db push`, so the sector/accentColor columns exist.
 */
import "dotenv/config";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import mariadb from "mariadb";

const apply = process.argv.includes("--apply");
const jsonPath = path.join(process.cwd(), "data", "team.json");
const team = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const conn = await mariadb.createConnection(url.replace("mysql://", "mariadb://"));
const normalize = (name) => name.trim().toLowerCase();
const log = (msg) => console.log(`${apply ? "" : "[dry-run] "}${msg}`);

try {
  await conn.beginTransaction();
  const rows = await conn.query("SELECT * FROM TeamMember ORDER BY createdAt ASC");

  for (const member of team) {
    const matches = rows.filter((r) => normalize(r.name) === normalize(member.name));

    if (matches.length === 0) {
      log(`create "${member.name}"`);
      if (apply) {
        await conn.query(
          "INSERT INTO TeamMember (id, name, role, sector, photo, accentColor, bio, `order`, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))",
          [
            `c${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`,
            member.name,
            member.role ?? "",
            member.sector ?? "",
            member.image ?? null,
            member.accentColor ?? "#14d0c1",
            member.bio ?? null,
            member.order ?? 0,
          ]
        );
      }
      continue;
    }

    const [keep, ...duplicates] = matches;
    for (const dup of duplicates) {
      log(`merge duplicate "${dup.name}" ${dup.id} into ${keep.id}`);
      if (apply) {
        await conn.query("UPDATE CrmCard SET responsibleId = ? WHERE responsibleId = ?", [keep.id, dup.id]);
        await conn.query("UPDATE CrmActivity SET responsibleId = ? WHERE responsibleId = ?", [keep.id, dup.id]);
        await conn.query("UPDATE IGNORE CrmDealObserver SET memberId = ? WHERE memberId = ?", [keep.id, dup.id]);
        await conn.query("DELETE FROM TeamMember WHERE id = ?", [dup.id]);
      }
    }

    log(`update "${keep.name}" ${keep.id}: sector, accentColor, order${keep.photo ? "" : ", photo"}${keep.bio ? "" : ", bio"}`);
    if (apply) {
      await conn.query(
        "UPDATE TeamMember SET sector = ?, accentColor = ?, `order` = ?, photo = COALESCE(NULLIF(photo, ''), ?), bio = COALESCE(bio, ?), updatedAt = NOW(3) WHERE id = ?",
        [member.sector ?? "", member.accentColor ?? "#14d0c1", member.order ?? keep.order, member.image ?? null, member.bio ?? null, keep.id]
      );
    }
  }

  if (apply) await conn.commit();
  else await conn.rollback();

  const result = await conn.query("SELECT id, name, role, sector, photo, `order` FROM TeamMember ORDER BY `order`");
  console.table(result);
} catch (error) {
  await conn.rollback();
  throw error;
} finally {
  await conn.end();
}

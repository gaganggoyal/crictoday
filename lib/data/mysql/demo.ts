import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { academies, DEFAULT_ALLOW_DOMAINS, matches } from "@/lib/data/seed";
import { withTransaction } from "@/lib/data/mysql/pool";
import { insertAcademy, insertMatch, insertOffer } from "@/lib/data/mysql/rows";

/** Load the labelled DEMO catalogue from lib/data/seed.ts. Rows that already exist are kept. */
export async function seedDemo(pool: Pool, now: Date) {
  return withTransaction(pool, async (connection) => {
    const [matchRows] = await connection.query<RowDataPacket[]>(
      "SELECT slug FROM matches WHERE slug IN (?)",
      [matches.map((match) => match.slug)],
    );
    const [academyRows] = await connection.query<RowDataPacket[]>(
      "SELECT slug FROM academies WHERE slug IN (?)",
      [academies.map((academy) => academy.slug)],
    );
    const haveMatches = new Set(matchRows.map((row) => String(row.slug)));
    const haveAcademies = new Set(academyRows.map((row) => String(row.slug)));
    let addedMatches = 0;
    let addedAcademies = 0;
    for (const match of matches) {
      if (haveMatches.has(match.slug)) continue;
      await insertMatch(connection, { ...match, demo: true }, now);
      for (const offer of match.offers) await insertOffer(connection, match.id, offer, now);
      addedMatches += 1;
    }
    for (const academy of academies) {
      if (haveAcademies.has(academy.slug)) continue;
      await insertAcademy(connection, { ...academy, demo: true }, now);
      addedAcademies += 1;
    }
    await connection.query(
      "INSERT IGNORE INTO domain_rules (host, decision, created_at) VALUES ?",
      [DEFAULT_ALLOW_DOMAINS.map((host) => [host, "allow", now])],
    );
    return { matches: addedMatches, academies: addedAcademies };
  });
}

/** Delete every DEMO match and academy. Their offers, alerts and clicks go with them. */
export async function removeDemo(pool: Pool) {
  return withTransaction(pool, async (connection) => {
    const [deletedMatches] = await connection.query<ResultSetHeader>(
      "DELETE FROM matches WHERE demo = 1",
    );
    const [deletedAcademies] = await connection.query<ResultSetHeader>(
      "DELETE FROM academies WHERE demo = 1",
    );
    await connection.query("DELETE FROM domain_rules WHERE decision = 'allow' AND host IN (?)", [
      DEFAULT_ALLOW_DOMAINS,
    ]);
    return { matches: deletedMatches.affectedRows, academies: deletedAcademies.affectedRows };
  });
}

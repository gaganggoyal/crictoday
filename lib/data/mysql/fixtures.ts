import { randomUUID } from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
import type { FixtureMatch } from "@/lib/data/fixtures";
import { withTransaction } from "@/lib/data/mysql/pool";
import { insertMatch, writeAudit } from "@/lib/data/mysql/rows";
import { uniqueSlug } from "@/lib/domain/slug";

export type FixtureLoad = {
  inserted: number;
  updated: number;
  unchanged: number;
  skipped: string[];
};

// Columns a fixture file owns. Slug and published_at stay as first loaded so links keep working.
const OWNED: Array<[column: string, value: (fixture: FixtureMatch) => unknown]> = [
  ["competition_name", (f) => f.competitionName],
  ["competition_slug", (f) => f.competitionSlug],
  ["kind", (f) => f.kind],
  ["season_name", (f) => f.seasonName],
  ["season_slug", (f) => f.seasonSlug],
  ["home_name", (f) => f.homeName],
  ["home_short", (f) => f.homeShort],
  ["home_slug", (f) => f.homeSlug],
  ["away_name", (f) => f.awayName],
  ["away_short", (f) => f.awayShort],
  ["away_slug", (f) => f.awaySlug],
  ["venue_name", (f) => f.venueName],
  ["venue_slug", (f) => f.venueSlug],
  ["venue_address", (f) => f.venueAddress],
  ["city_name", (f) => f.cityName],
  ["city_slug", (f) => f.citySlug],
  ["country_name", (f) => f.countryName],
  ["country_slug", (f) => f.countrySlug],
  ["starts_at", (f) => new Date(f.startsAt)],
  ["timezone", (f) => f.timezone],
  ["format", (f) => f.format],
  ["status", (f) => f.status],
  ["attendance_type", (f) => f.attendanceType],
  ["source_url", (f) => f.sourceUrl],
  ["source_label", (f) => f.sourceLabel],
  ["last_verified_at", (f) => (f.lastVerifiedAt ? new Date(f.lastVerifiedAt) : null)],
];

function same(stored: unknown, next: unknown) {
  if (stored instanceof Date || next instanceof Date) {
    return stored instanceof Date && next instanceof Date && stored.getTime() === next.getTime();
  }
  return stored === next;
}

/**
 * Inserts new fixtures and updates the ones a file loaded before, matched by source_external_id.
 * Organiser and academy listings are never changed, and a fixture that has started is not inserted.
 */
export async function loadFixtures(
  pool: Pool,
  fixtures: FixtureMatch[],
  now: Date,
): Promise<FixtureLoad> {
  if (fixtures.length === 0) return { inserted: 0, updated: 0, unchanged: 0, skipped: [] };
  return withTransaction(pool, async (connection) => {
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT id, source_type, source_external_id, ${OWNED.map(([column]) => column).join(", ")}
       FROM matches WHERE source_external_id IN (?) FOR UPDATE`,
      [fixtures.map((fixture) => fixture.sourceExternalId)],
    );
    const existing = new Map(rows.map((row) => [String(row.source_external_id), row]));
    const [slugRows] = await connection.query<RowDataPacket[]>("SELECT slug FROM matches");
    const taken = new Set(slugRows.map((row) => String(row.slug)));

    const result: FixtureLoad = { inserted: 0, updated: 0, unchanged: 0, skipped: [] };
    for (const fixture of fixtures) {
      const row = existing.get(fixture.sourceExternalId);
      if (row && row.source_type !== "admin") {
        result.skipped.push(`${fixture.sourceExternalId}: listed by ${row.source_type}`);
        continue;
      }
      if (row) {
        const changed = OWNED.filter(([column, value]) => !same(row[column], value(fixture)));
        if (changed.length === 0) {
          result.unchanged += 1;
          continue;
        }
        await connection.query(
          `UPDATE matches SET ${OWNED.map(([column]) => `${column} = ?`).join(", ")}, updated_at = ?
           WHERE id = ?`,
          [...OWNED.map(([, value]) => value(fixture)), now, row.id],
        );
        result.updated += 1;
        continue;
      }
      if (new Date(fixture.startsAt).getTime() <= now.getTime()) {
        result.skipped.push(`${fixture.sourceExternalId}: already started`);
        continue;
      }
      const slug = uniqueSlug(fixture.slugBase, taken);
      taken.add(slug);
      await insertMatch(
        connection,
        { ...fixture, id: randomUUID(), slug, publishedAt: now.toISOString(), offers: [] },
        now,
      );
      result.inserted += 1;
    }
    await writeAudit(
      connection,
      {
        actorId: null,
        actorEmail: null,
        action: "fixtures.load",
        entityType: "match",
        entityId: null,
        before: null,
        after: { ...result, skipped: result.skipped.length },
      },
      now,
    );
    return result;
  });
}

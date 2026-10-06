import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type { FixtureMatch } from "@/lib/data/fixtures";
import { withTransaction } from "@/lib/data/mysql/pool";
import { domainDenied, insertMatch, insertOffer, writeAudit } from "@/lib/data/mysql/rows";
import { uniqueSlug } from "@/lib/domain/slug";

export type FixtureLoad = {
  inserted: number;
  updated: number;
  unchanged: number;
  skipped: string[];
  tickets: { added: number; updated: number; withdrawn: number; waiting: number };
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
];

function same(stored: unknown, next: unknown) {
  if (stored instanceof Date || next instanceof Date) {
    return stored instanceof Date && next instanceof Date && stored.getTime() === next.getTime();
  }
  return stored === next;
}

/**
 * The file's check time when it should replace the stored one, else null. Verification only moves
 * forward, except that a stored time in the future is a mistake and is corrected.
 */
function later(stored: Date | null, next: string | null, now: Date) {
  if (!next) return null;
  const value = new Date(next);
  if (!stored) return value;
  if (value.getTime() > stored.getTime()) return value;
  if (stored.getTime() > now.getTime() && value.getTime() !== stored.getTime()) return value;
  return null;
}

/** The ticket offer a fixture file keeps for a match has an id derived from the fixture's. */
export function fixtureOfferId(sourceExternalId: string) {
  return `fixture-${createHash("sha256").update(sourceExternalId).digest("hex").slice(0, 32)}`;
}

type OfferChange = "added" | "updated" | "unchanged" | "withdrawn" | "waiting" | "blocked";

/**
 * Makes a match's file-owned offer match its `tickets`: an approved official link once the sale
 * opens, and expired when the file stops listing it.
 */
async function syncOffer(
  connection: PoolConnection,
  matchId: string,
  fixture: FixtureMatch,
  now: Date,
): Promise<OfferChange> {
  const id = fixtureOfferId(fixture.sourceExternalId);
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT seller_name, seller_domain, url, kind, status, approved, last_checked_at
     FROM ticket_offers WHERE id = ? FOR UPDATE`,
    [id],
  );
  const row = rows[0];
  const tickets = fixture.tickets;
  if (!tickets) {
    if (!row || (row.status !== "active" && row.status !== "sold_out")) return "unchanged";
    await connection.query(
      "UPDATE ticket_offers SET status = 'expired', updated_at = ? WHERE id = ?",
      [now, id],
    );
    return "withdrawn";
  }
  if (tickets.onSaleAt && new Date(tickets.onSaleAt).getTime() > now.getTime()) return "waiting";
  if (await domainDenied(connection, tickets.sellerDomain)) {
    // A deny rule wins over the file: a link already listed comes down.
    if (row && (row.status === "active" || row.status === "sold_out")) {
      await connection.query(
        "UPDATE ticket_offers SET status = 'rejected', updated_at = ? WHERE id = ?",
        [now, id],
      );
    }
    return "blocked";
  }

  const checked = later(row?.last_checked_at ?? null, fixture.lastVerifiedAt, now);
  if (!row) {
    await insertOffer(
      connection,
      matchId,
      {
        id,
        sellerName: tickets.sellerName,
        sellerDomain: tickets.sellerDomain,
        url: tickets.url,
        kind: "official",
        currency: null,
        priceFrom: null,
        status: tickets.status,
        lastCheckedAt: fixture.lastVerifiedAt,
        approved: true,
      },
      now,
    );
  } else {
    const current =
      row.seller_name === tickets.sellerName &&
      row.seller_domain === tickets.sellerDomain &&
      row.url === tickets.url &&
      row.kind === "official" &&
      row.status === tickets.status &&
      Number(row.approved) === 1;
    if (current && !checked) return "unchanged";
    await connection.query(
      `UPDATE ticket_offers
       SET seller_name = ?, seller_domain = ?, url = ?, kind = 'official', status = ?, approved = 1,
           last_checked_at = COALESCE(?, last_checked_at), updated_at = ?
       WHERE id = ?`,
      [tickets.sellerName, tickets.sellerDomain, tickets.url, tickets.status, checked, now, id],
    );
  }
  // As with a moderator's approval, a listed link puts its domain on the allow list.
  await connection.query(
    "INSERT IGNORE INTO domain_rules (host, decision, created_at) VALUES (?, 'allow', ?)",
    [tickets.sellerDomain, now],
  );
  return row ? "updated" : "added";
}

/**
 * Inserts new fixtures and updates the ones a file loaded before, matched by source_external_id,
 * with each match's official ticket link. Organiser and academy listings are never changed, a
 * fixture that has started is not inserted, and offers for started matches are left to expiry.
 */
export async function loadFixtures(
  pool: Pool,
  fixtures: FixtureMatch[],
  now: Date,
): Promise<FixtureLoad> {
  const result: FixtureLoad = {
    inserted: 0,
    updated: 0,
    unchanged: 0,
    skipped: [],
    tickets: { added: 0, updated: 0, withdrawn: 0, waiting: 0 },
  };
  if (fixtures.length === 0) return result;
  return withTransaction(pool, async (connection) => {
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT id, source_type, source_external_id, last_verified_at,
              ${OWNED.map(([column]) => column).join(", ")}
       FROM matches WHERE source_external_id IN (?) FOR UPDATE`,
      [fixtures.map((fixture) => fixture.sourceExternalId)],
    );
    const existing = new Map(rows.map((row) => [String(row.source_external_id), row]));
    const [slugRows] = await connection.query<RowDataPacket[]>("SELECT slug FROM matches");
    const taken = new Set(slugRows.map((row) => String(row.slug)));

    for (const fixture of fixtures) {
      const row = existing.get(fixture.sourceExternalId);
      if (row && row.source_type !== "admin") {
        result.skipped.push(`${fixture.sourceExternalId}: listed by ${row.source_type}`);
        continue;
      }
      let matchId: string;
      if (row) {
        matchId = String(row.id);
        const changed = OWNED.filter(([column, value]) => !same(row[column], value(fixture)));
        const verified = later(row.last_verified_at, fixture.lastVerifiedAt, now);
        if (changed.length === 0 && !verified) {
          result.unchanged += 1;
        } else {
          await connection.query(
            `UPDATE matches SET ${OWNED.map(([column]) => `${column} = ?`).join(", ")},
               last_verified_at = COALESCE(?, last_verified_at), updated_at = ?
             WHERE id = ?`,
            [...OWNED.map(([, value]) => value(fixture)), verified, now, row.id],
          );
          result.updated += 1;
        }
      } else {
        if (new Date(fixture.startsAt).getTime() <= now.getTime()) {
          result.skipped.push(`${fixture.sourceExternalId}: already started`);
          continue;
        }
        const slug = uniqueSlug(fixture.slugBase, taken);
        taken.add(slug);
        matchId = randomUUID();
        await insertMatch(
          connection,
          { ...fixture, id: matchId, slug, publishedAt: now.toISOString(), offers: [] },
          now,
        );
        result.inserted += 1;
      }

      if (new Date(fixture.startsAt).getTime() <= now.getTime()) continue;
      const offer = await syncOffer(connection, matchId, fixture, now);
      if (offer === "blocked") {
        result.skipped.push(
          `${fixture.sourceExternalId}: ${fixture.tickets?.sellerDomain} is blocked`,
        );
      } else if (offer !== "unchanged") {
        result.tickets[offer] += 1;
      }
    }

    const { added, updated, withdrawn } = result.tickets;
    // The hourly sync reloads the same files, so only a load that changed something is audited.
    if (result.inserted + result.updated + added + updated + withdrawn > 0) {
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
    }
    return result;
  });
}

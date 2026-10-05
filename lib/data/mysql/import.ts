import { randomUUID } from "node:crypto";
import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import {
  planImport,
  type FixtureProvider,
  type NormalizedMatch,
  type TicketProvider,
} from "@/lib/domain/providers";
import { slugify } from "@/lib/domain/slug";
import { materializeProviderMatch } from "@/lib/domain/workflows";
import { withTransaction } from "@/lib/data/mysql/pool";
import { insertMatch, insertOffer } from "@/lib/data/mysql/rows";

const RUN_LOCK_MS = 10 * 60 * 1000;
const LOOKAHEAD_MS = 180 * 24 * 60 * 60 * 1000;

/** Close offers and alerts for matches that have started, and alerts for cancelled matches. */
export async function expireDue(pool: Pool, now: Date) {
  await pool.query(
    `UPDATE ticket_offers o JOIN matches m ON m.id = o.match_id
     SET o.status = 'expired', o.updated_at = ?
     WHERE m.starts_at <= ? AND o.status IN ('active', 'pending')`,
    [now, now],
  );
  await pool.query(
    `UPDATE ticket_requests r JOIN matches m ON m.id = r.match_id
     SET r.status = 'expired'
     WHERE r.status IN ('active', 'pending_verification')
       AND (m.status = 'cancelled' OR m.starts_at <= ?)`,
    [now],
  );
}

async function deadLetter(pool: Pool, provider: string, reason: string, now: Date) {
  await pool.query(
    "INSERT INTO dead_letters (id, provider, reason, created_at) VALUES (?, ?, ?, ?)",
    [randomUUID(), provider, reason, now],
  );
}

/**
 * Pull fixtures into MySQL. Organiser and academy rows are never overwritten, new rows start with
 * no public offers, and Ticketmaster offers stay pending. Expiry runs on every call.
 */
export async function runMysqlImport(
  pool: Pool,
  providers: { fixtures: FixtureProvider | null; tickets: TicketProvider | null },
  now: Date,
) {
  const runId = randomUUID();
  const started = await withTransaction(pool, async (connection) => {
    const [running] = await connection.query<RowDataPacket[]>(
      "SELECT id FROM import_runs WHERE status = 'running' AND started_at > ? FOR UPDATE",
      [new Date(now.getTime() - RUN_LOCK_MS)],
    );
    if (running.length > 0) return false;
    await connection.query(
      "INSERT INTO import_runs (id, provider, started_at, status) VALUES (?, ?, ?, 'running')",
      [runId, providers.fixtures ? "sportmonks" : "manual", now],
    );
    return true;
  });
  if (!started) return { status: "skipped", reason: "An import is already running." };

  const finish = (
    status: "succeeded" | "failed" | "skipped",
    counts: { fetched?: number; inserted?: number; updated?: number; failed?: number },
    error: string | null,
  ) =>
    pool.query(
      `UPDATE import_runs
       SET status = ?, finished_at = ?, fetched_count = ?, inserted_count = ?, updated_count = ?,
           failed_count = ?, error_summary = ?
       WHERE id = ?`,
      [
        status,
        new Date(),
        counts.fetched ?? 0,
        counts.inserted ?? 0,
        counts.updated ?? 0,
        counts.failed ?? 0,
        error,
        runId,
      ],
    );

  try {
    if (!providers.fixtures) {
      await expireDue(pool, now);
      await finish(
        "skipped",
        {},
        providers.tickets
          ? "No fixture token configured. Ticketmaster is not allowed to publish offers on its own."
          : "No fixture provider token configured.",
      );
      return { status: "skipped", id: runId };
    }

    const incoming = await providers.fixtures.fetchBetween({
      from: now,
      to: new Date(now.getTime() + LOOKAHEAD_MS),
    });
    const [existing] = await pool.query<RowDataPacket[]>(
      `SELECT id, slug, source_external_id, source_type, home_name, away_name, venue_name,
              competition_name, starts_at
       FROM matches`,
    );
    const plan = planImport(
      existing.map((row) => ({
        id: String(row.id),
        sourceExternalId: (row.source_external_id as string | null) ?? null,
        sourceType: row.source_type,
        home: String(row.home_name),
        away: String(row.away_name),
        venue: String(row.venue_name),
        competition: String(row.competition_name),
        startsAt: (row.starts_at as Date).toISOString(),
      })),
      incoming,
    );

    const inserted: Array<{ id: string; fixture: NormalizedMatch }> = [];
    let updated = 0;
    await withTransaction(pool, async (connection) => {
      const taken = new Set(existing.map((row) => String(row.slug)));
      for (const fixture of plan.inserts) {
        const match = materializeProviderMatch(fixture, taken, now);
        await insertMatch(connection, match, now);
        inserted.push({ id: match.id, fixture });
      }
      for (const update of plan.updates) {
        const [result] = await connection.query<ResultSetHeader>(
          `UPDATE matches
           SET starts_at = ?, status = ?, venue_name = ?, venue_slug = ?, city_name = ?,
               city_slug = ?, country_name = ?, country_slug = ?, format = ?,
               source_external_id = ?, last_verified_at = ?, timezone = COALESCE(NULLIF(?, ''), timezone),
               updated_at = ?
           WHERE id = ? AND source_type NOT IN ('organiser', 'academy')`,
          [
            new Date(update.match.startsAt),
            update.match.status,
            update.match.venue,
            slugify(update.match.venue),
            update.match.city,
            slugify(update.match.city),
            update.match.country,
            slugify(update.match.country),
            update.match.format,
            update.match.externalId,
            now,
            update.match.timezone,
            now,
            update.id,
          ],
        );
        if (result.affectedRows > 0) updated += 1;
      }
    });

    let ticketFailures = 0;
    for (const conflict of plan.conflicts)
      await deadLetter(pool, "sportmonks", conflict.reason, now);
    if (providers.tickets) {
      for (const { id, fixture } of inserted) {
        try {
          const offers = await providers.tickets.findOffers(fixture);
          if (offers.length === 0) continue;
          await withTransaction(pool, async (connection) => {
            for (const offer of offers) {
              await insertOffer(
                connection,
                id,
                {
                  id: randomUUID(),
                  sellerName: offer.sellerName,
                  sellerDomain: offer.sellerDomain,
                  url: offer.url,
                  kind: offer.kind,
                  currency: offer.currency,
                  priceFrom: offer.priceFrom,
                  status: "pending",
                  lastCheckedAt: now.toISOString(),
                  approved: false,
                },
                now,
              );
            }
          });
        } catch (error) {
          ticketFailures += 1;
          await deadLetter(
            pool,
            "ticketmaster",
            error instanceof Error
              ? error.message
              : "Ticket lookup failed. No offer was published.",
            now,
          );
        }
      }
    }

    await expireDue(pool, now);
    await finish(
      "succeeded",
      {
        fetched: incoming.length,
        inserted: inserted.length,
        updated,
        failed: plan.conflicts.length + ticketFailures,
      },
      plan.conflicts.length > 0
        ? `${plan.conflicts.length} fixtures conflicted with existing records and were not written.`
        : null,
    );
    return {
      status: "succeeded",
      id: runId,
      fetched: incoming.length,
      conflicts: plan.conflicts.length,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Import failed.";
    await finish("failed", { failed: 1 }, reason);
    await deadLetter(pool, "sportmonks", reason, now);
    return { status: "failed", id: runId };
  }
}

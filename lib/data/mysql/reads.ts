import type { Pool, RowDataPacket } from "mysql2/promise";
import type { StoredOffer } from "@/lib/domain/types";
import {
  toAcademy,
  toAudit,
  toImportRun,
  toMatch,
  toOffer,
  toSubmission,
  type AcademyRow,
  type MatchRow,
  type OfferRow,
  type SubmissionRow,
} from "@/lib/data/mysql/rows";

// Public means published, postponed, cancelled or completed, with a source. See isPublicMatch.
const PUBLIC_MATCH =
  "m.status IN ('published', 'postponed', 'cancelled', 'completed') AND m.source_url IS NOT NULL";

/** The public catalogue: listed matches with their approved offers, and verified academies. */
export async function loadDirectory(pool: Pool) {
  const [[matchRows], [offerRows], [academyRows]] = await Promise.all([
    pool.query<MatchRow[]>(
      `SELECT m.* FROM matches m WHERE ${PUBLIC_MATCH} ORDER BY m.starts_at, m.slug`,
    ),
    pool.query<OfferRow[]>(
      `SELECT o.* FROM ticket_offers o JOIN matches m ON m.id = o.match_id
       WHERE ${PUBLIC_MATCH} AND o.approved = 1 AND o.status IN ('active', 'sold_out', 'expired')
       ORDER BY o.created_at, o.id`,
    ),
    pool.query<AcademyRow[]>(
      "SELECT * FROM academies WHERE verification_status = 'verified' ORDER BY name",
    ),
  ]);
  const offers = new Map<string, StoredOffer[]>();
  for (const row of offerRows) {
    offers.set(row.match_id, [...(offers.get(row.match_id) ?? []), toOffer(row)]);
  }
  return {
    matches: matchRows.map((row) => toMatch(row, offers.get(row.id) ?? [])),
    academies: academyRows.map((row) => toAcademy(row)),
  };
}

export async function hasDemoListings(pool: Pool) {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT 1 FROM matches WHERE demo = 1 LIMIT 1");
  return rows.length > 0;
}

/** Everything the moderation pages show. Callers check the session first. */
export async function loadModeration(pool: Pool) {
  const [[submissions], [offers], [audit], [importRuns], [deadLetters]] = await Promise.all([
    pool.query<SubmissionRow[]>("SELECT * FROM submissions ORDER BY created_at DESC LIMIT 500"),
    pool.query<OfferRow[]>(
      `SELECT o.*, m.slug AS match_slug, m.home_name, m.away_name, m.home_short, m.away_short
       FROM ticket_offers o JOIN matches m ON m.id = o.match_id
       ORDER BY m.slug, o.created_at`,
    ),
    pool.query<RowDataPacket[]>("SELECT * FROM audit_log ORDER BY id DESC LIMIT 200"),
    pool.query<RowDataPacket[]>("SELECT * FROM import_runs ORDER BY started_at DESC LIMIT 50"),
    pool.query<RowDataPacket[]>(
      "SELECT id, provider, reason FROM dead_letters ORDER BY created_at DESC LIMIT 100",
    ),
  ]);
  return {
    submissions: submissions.map((row) => toSubmission(row)),
    offers: offers.map((row) => ({
      matchSlug: String(row.match_slug),
      homeName: String(row.home_name),
      awayName: String(row.away_name),
      homeShort: String(row.home_short),
      awayShort: String(row.away_short),
      offer: toOffer(row),
    })),
    audit: audit.map((row) => toAudit(row)),
    importRuns: importRuns.map((row) => toImportRun(row)),
    deadLetters: deadLetters.map((row) => ({
      id: String(row.id),
      provider: String(row.provider),
      reason: String(row.reason),
    })),
  };
}

/** A signed-in person's submissions, alert count and academies, matched by account or email. */
export async function loadAccount(
  pool: Pool,
  account: { userId: string; email: string; emailHash: string },
) {
  const email = account.email.toLowerCase();
  const [[submissions], [alerts], [academies]] = await Promise.all([
    pool.query<SubmissionRow[]>(
      "SELECT * FROM submissions WHERE submitter_id = ? OR submitter_email = ? ORDER BY created_at DESC",
      [account.userId, email],
    ),
    pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS total FROM ticket_requests WHERE user_id = ? OR email_hash = ?",
      [account.userId, account.emailHash],
    ),
    pool.query<RowDataPacket[]>(
      `SELECT slug, name, verification_status, verification_label FROM academies
       WHERE owner_id = ? OR owner_email = ? OR contact_email = ? ORDER BY name`,
      [account.userId, email, email],
    ),
  ]);
  return {
    submissions: submissions.map((row) => toSubmission(row)),
    alertCount: Number(alerts[0]?.total ?? 0),
    academies: academies.map((row) => ({
      slug: String(row.slug),
      name: String(row.name),
      verificationStatus: String(row.verification_status),
      verificationLabel: (row.verification_label as string | null) ?? null,
    })),
  };
}

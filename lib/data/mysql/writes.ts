import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { stateOfCity } from "@/lib/data/india";
import { normalizeName } from "@/lib/domain/duplicates";
import { slugify, uniqueSlug } from "@/lib/domain/slug";
import type { MatchFormat, Role, StoredAcademy, StoredMatch } from "@/lib/domain/types";
import { assertHttpsUrl } from "@/lib/domain/urls";
import { ticketAlertEmail, type EmailDraft } from "@/lib/domain/workflows";
import type { EmailMatch } from "@/lib/email/messages";
import { DomainError, withTransaction } from "@/lib/data/mysql/pool";
import {
  domainDenied,
  insertAcademy,
  insertMatch,
  insertOffer,
  writeAudit,
  type UserRow,
} from "@/lib/data/mysql/rows";

// Same rules and messages as the service-role functions in supabase/migrations.

export type Failure = { ok: false; errors: Record<string, string> };

export const STAFF: Role[] = ["moderator", "admin"];
const FORMATS = new Set(["test", "odi", "t20", "t10", "hundred", "other"]);
const ATTENDANCE = new Set(["ticketed", "free", "private", "unknown"]);

function failure(errors: Record<string, string>): Failure {
  return { ok: false, errors };
}

/** Run work in a transaction. A DomainError rolls it back and comes back as a failure. */
export async function attempt<T>(pool: Pool, work: (connection: PoolConnection) => Promise<T>) {
  try {
    return await withTransaction(pool, work);
  } catch (error) {
    if (error instanceof DomainError) return failure(error.errors);
    throw error;
  }
}

export async function actorWithRole(
  connection: PoolConnection,
  actorId: string,
  roles: Role[],
  message: string,
) {
  const [rows] = await connection.query<UserRow[]>(
    "SELECT id, email, role FROM users WHERE id = ?",
    [actorId],
  );
  const actor = rows[0];
  if (!actor || !roles.includes(actor.role)) throw new DomainError({ form: message });
  return actor;
}

async function userExists(connection: PoolConnection, id: string | null) {
  if (!id) return null;
  const [rows] = await connection.query<RowDataPacket[]>("SELECT id FROM users WHERE id = ?", [id]);
  return rows[0] ? id : null;
}

export async function freeSlug(
  connection: PoolConnection,
  table: "matches" | "academies",
  base: string,
) {
  const root = slugify(base);
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT slug FROM ${table} WHERE slug = ? OR slug LIKE ?`,
    [root, `${root}-%`],
  );
  return uniqueSlug(root, new Set(rows.map((row) => String(row.slug))));
}

function textField(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" ? value.trim() : "";
}

function listField(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export async function createSubmission(
  pool: Pool,
  input: {
    entityType: "match" | "academy" | "ticket_offer" | "correction";
    payload: Record<string, unknown>;
    submitterId: string | null;
  },
  now: Date,
) {
  const body = JSON.stringify(input.payload ?? {});
  if (Buffer.byteLength(body) > 20000) return failure({ form: "This submission is too large." });
  return attempt(pool, async (connection) => {
    const submitter = await userExists(connection, input.submitterId);
    const email =
      (
        textField(input.payload, "contactEmail") || textField(input.payload, "email")
      ).toLowerCase() || null;
    const id = randomUUID();
    await connection.query(
      `INSERT INTO submissions
        (id, entity_type, payload, submitter_id, submitter_email, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [id, input.entityType, body, submitter, email, now, now],
    );
    return { ok: true as const, id };
  });
}

export async function reviewSubmission(
  pool: Pool,
  input: {
    id: string;
    action: "approve" | "reject" | "changes" | "merge";
    reason?: string;
    mergeTarget?: string;
    actorId: string;
  },
  now: Date,
) {
  return attempt(pool, async (connection) => {
    const actor = await actorWithRole(
      connection,
      input.actorId,
      STAFF,
      "Moderator access is required.",
    );
    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT * FROM submissions WHERE id = ? FOR UPDATE",
      [input.id],
    );
    const submission = rows[0];
    if (!submission) throw new DomainError({ form: "Submission not found." });
    if (submission.status === "approved" || submission.status === "rejected") {
      throw new DomainError({ form: "This submission has already been closed." });
    }
    const reason = (input.reason ?? "").trim();
    if ((input.action === "reject" || input.action === "changes") && reason.length < 3) {
      throw new DomainError({ reason: "A reason is required." });
    }

    const close = async (
      status: string,
      notes: string | null,
      duplicateOf: string | null = null,
    ) => {
      await connection.query(
        `UPDATE submissions
         SET status = ?, duplicate_of = COALESCE(?, duplicate_of), reviewer_id = ?,
             reviewer_email = ?, reviewer_notes = ?, updated_at = ?
         WHERE id = ?`,
        [status, duplicateOf, actor.id, actor.email, notes, now, input.id],
      );
    };
    const audit = (action: string, before: unknown, after: unknown) =>
      writeAudit(
        connection,
        {
          actorId: actor.id,
          actorEmail: actor.email,
          action,
          entityType: "submission",
          entityId: input.id,
          before,
          after,
        },
        now,
      );

    if (input.action === "merge") {
      const [targets] = await connection.query<RowDataPacket[]>(
        "SELECT slug FROM matches WHERE slug = ?",
        [(input.mergeTarget ?? "").trim()],
      );
      if (!targets[0]) {
        throw new DomainError({ mergeTarget: "Choose the canonical match to merge into." });
      }
      await close("approved", reason || null, String(targets[0].slug));
      await audit(
        "submission.merge",
        { status: submission.status },
        { status: "approved", mergeTarget: targets[0].slug },
      );
      return { ok: true as const };
    }

    if (input.action === "reject" || input.action === "changes") {
      const status = input.action === "reject" ? "rejected" : "changes_requested";
      await close(status, reason);
      await audit(`submission.${input.action}`, { status: submission.status }, { status, reason });
      return { ok: true as const };
    }

    const payload = (submission.payload ?? {}) as Record<string, unknown>;
    if (submission.entity_type === "match") {
      const published = await publishMatch(connection, payload, submission.submitter_id, now);
      await close("approved", reason || null);
      await audit("submission.approve", null, published);
      return { ok: true as const };
    }
    if (submission.entity_type === "academy") {
      const slug = await verifyAcademy(connection, payload, submission.submitter_id, now);
      await close("approved", reason || null);
      await audit("submission.approve", null, { slug, verificationLabel: "Contact verified" });
      return { ok: true as const };
    }
    await close("approved", reason || "Recorded. Fixture fields were not changed automatically.");
    await audit("submission.approve", { status: submission.status }, { status: "approved" });
    return { ok: true as const };
  });
}

async function publishMatch(
  connection: PoolConnection,
  payload: Record<string, unknown>,
  submitterId: string | null,
  now: Date,
) {
  const source = assertHttpsUrl(textField(payload, "sourceUrl"));
  if (!source) throw new DomainError({ form: "A source URL is required before publication." });
  const format = textField(payload, "format");
  if (!FORMATS.has(format)) throw new DomainError({ form: "Choose a format." });
  const attendance = textField(payload, "attendanceType");
  if (!ATTENDANCE.has(attendance)) throw new DomainError({ form: "Choose how people attend." });
  const home = textField(payload, "homeTeam");
  const away = textField(payload, "awayTeam");
  if (!home || !away || normalizeName(home) === normalizeName(away)) {
    throw new DomainError({ form: "Home and away sides must be different." });
  }
  const startsAt = new Date(textField(payload, "startsAtUtc") || textField(payload, "startsAt"));
  if (Number.isNaN(startsAt.getTime()))
    throw new DomainError({ form: "The start time is not valid." });

  const competition = textField(payload, "competition");
  const venue = textField(payload, "venue");
  const city = textField(payload, "city");
  const country = textField(payload, "country");
  const organiser = textField(payload, "organiserType");
  const place = slugify(country) === "india" ? stateOfCity(slugify(city)) : null;
  const slug = await freeSlug(
    connection,
    "matches",
    `${home}-${away}-${city}-${textField(payload, "startsAt").slice(0, 10)}`,
  );
  const match: StoredMatch = {
    id: randomUUID(),
    slug,
    competitionName: competition,
    competitionSlug: slugify(competition),
    kind: organiser === "academy" ? "academy" : organiser === "league" ? "league" : "domestic",
    seasonName: null,
    seasonSlug: null,
    homeName: home,
    homeShort: home.slice(0, 3).toUpperCase(),
    homeSlug: slugify(home),
    awayName: away,
    awayShort: away.slice(0, 3).toUpperCase(),
    awaySlug: slugify(away),
    venueName: venue,
    venueSlug: slugify(venue),
    venueAddress: `${venue}, ${city}`,
    cityName: city,
    citySlug: slugify(city),
    stateName: place?.name ?? null,
    stateSlug: place?.slug ?? null,
    countryName: country,
    countrySlug: slugify(country),
    startsAt: startsAt.toISOString(),
    endsAt: null,
    timezone: textField(payload, "timezone") || "UTC",
    format: format as StoredMatch["format"],
    status: "published",
    attendanceType: attendance as StoredMatch["attendanceType"],
    sourceType: organiser === "academy" ? "academy" : "organiser",
    sourceExternalId: null,
    sourceUrl: source.toString(),
    sourceLabel: "Organiser submission",
    featuredRank: 0,
    lastVerifiedAt: now.toISOString(),
    publishedAt: now.toISOString(),
    entryNotes: textField(payload, "entryNotes") || null,
    demo: false,
    academySlug: null,
    offers: [],
  };
  await insertMatch(connection, match, now, await userExists(connection, submitterId));

  const ticketUrl = textField(payload, "ticketUrl");
  if (attendance === "ticketed" && ticketUrl) {
    const ticket = assertHttpsUrl(ticketUrl);
    if (!ticket) throw new DomainError({ form: "The ticket URL failed the HTTPS check." });
    const host = ticket.hostname.replace(/^www\./, "").toLowerCase();
    if (await domainDenied(connection, host)) {
      throw new DomainError({ form: "That ticket domain is blocked." });
    }
    // Organiser links stay pending until a moderator approves the offer.
    await insertOffer(
      connection,
      match.id,
      {
        id: randomUUID(),
        sellerName: textField(payload, "ticketSeller") || host,
        sellerDomain: host,
        url: ticket.toString(),
        kind: "official",
        currency: null,
        priceFrom: null,
        status: "pending",
        lastCheckedAt: null,
        approved: false,
      },
      now,
    );
  }
  return { slug, sourceUrl: match.sourceUrl, matchId: match.id };
}

async function verifyAcademy(
  connection: PoolConnection,
  payload: Record<string, unknown>,
  submitterId: string | null,
  now: Date,
) {
  const claim = textField(payload, "claimSlug");
  const name = textField(payload, "name");
  const slug = claim ? slugify(claim) : await freeSlug(connection, "academies", name);
  const websiteText = textField(payload, "website");
  const website = websiteText ? assertHttpsUrl(websiteText) : null;
  if (websiteText && !website) throw new DomainError({ form: "Website must be an HTTPS URL." });
  const contactEmail = textField(payload, "contactEmail").toLowerCase() || null;

  let ownerId = await userExists(connection, submitterId);
  if (!ownerId && contactEmail) {
    const [owners] = await connection.query<RowDataPacket[]>(
      "SELECT id FROM users WHERE email = ?",
      [contactEmail],
    );
    ownerId = owners[0] ? String(owners[0].id) : null;
  }

  const [existing] = await connection.query<RowDataPacket[]>(
    "SELECT id FROM academies WHERE slug = ? FOR UPDATE",
    [slug],
  );
  if (existing[0]) {
    await connection.query(
      `UPDATE academies
       SET owner_id = COALESCE(?, owner_id), owner_email = COALESCE(?, owner_email),
           verification_status = 'verified', verification_label = 'Contact verified',
           last_verified_at = ?, description = COALESCE(NULLIF(?, ''), description),
           address = COALESCE(NULLIF(?, ''), address), updated_at = ?
       WHERE id = ?`,
      [
        ownerId,
        contactEmail,
        now,
        textField(payload, "description"),
        textField(payload, "address"),
        now,
        existing[0].id,
      ],
    );
    return slug;
  }

  const city = textField(payload, "city");
  const country = textField(payload, "country");
  const place = slugify(country) === "india" ? stateOfCity(slugify(city)) : null;
  const academy: StoredAcademy = {
    id: randomUUID(),
    slug,
    kind: "academy",
    name,
    description: textField(payload, "description"),
    address: textField(payload, "address"),
    cityName: city,
    citySlug: slugify(city),
    stateName: place?.name ?? null,
    stateSlug: place?.slug ?? null,
    countryName: country,
    countrySlug: slugify(country),
    timezone: null,
    website: website ? website.toString() : null,
    phone: textField(payload, "phone") || null,
    whatsapp: null,
    contactEmail,
    links: {},
    ageGroups: listField(payload, "ageGroups"),
    facilities: listField(payload, "facilities"),
    offerings: [],
    logo: null,
    cover: null,
    photos: [],
    verificationStatus: "verified",
    verificationLabel: "Contact verified",
    reviewNotes: null,
    lastVerifiedAt: now.toISOString(),
    ownerEmail: contactEmail,
    demo: false,
  };
  await insertAcademy(connection, academy, now, ownerId);
  return slug;
}

export async function assignRole(
  pool: Pool,
  input: { account: string; role: Role; actorId: string },
  now: Date,
) {
  return attempt(pool, async (connection) => {
    const actor = await actorWithRole(
      connection,
      input.actorId,
      ["admin"],
      "Admin access is required.",
    );
    const account = input.account.trim();
    const [rows] = await connection.query<UserRow[]>(
      "SELECT id, email, role FROM users WHERE id = ? OR email = ? LIMIT 1 FOR UPDATE",
      [account, account.toLowerCase()],
    );
    const user = rows[0];
    if (!user) throw new DomainError({ form: "That person has not signed in yet." });
    if (user.id === actor.id) throw new DomainError({ form: "Choose another account." });
    await connection.query("UPDATE users SET role = ? WHERE id = ?", [input.role, user.id]);
    await writeAudit(
      connection,
      {
        actorId: actor.id,
        actorEmail: actor.email,
        action: "profile.role",
        entityType: "user",
        entityId: user.id,
        before: { role: user.role },
        after: { role: input.role },
      },
      now,
    );
    return { ok: true as const };
  });
}

export async function createTicketRequest(
  pool: Pool,
  input: {
    matchSlug: string;
    emailHash: string;
    encryptedEmail: string;
    quantity: number;
    countryCode: string;
    notes: string;
    verifyTokenHash: string;
    unsubTokenHash: string;
    userId: string | null;
  },
  now: Date,
) {
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 10) {
    return failure({ quantity: "Quantity must be between 1 and 10." });
  }
  return attempt(pool, async (connection) => {
    const [matches] = await connection.query<RowDataPacket[]>(
      "SELECT id, status, source_url FROM matches WHERE slug = ?",
      [input.matchSlug],
    );
    const match = matches[0];
    if (
      !match ||
      !match.source_url ||
      ["cancelled", "completed", "draft", "pending"].includes(match.status)
    ) {
      throw new DomainError({ form: "Alerts are closed for this match." });
    }
    const openRequest = async () => {
      const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT id, status FROM ticket_requests
         WHERE match_id = ? AND email_hash = ?
           AND status IN ('pending_verification', 'active', 'notified')
         LIMIT 1 FOR UPDATE`,
        [match.id, input.emailHash],
      );
      return rows[0] ? { id: String(rows[0].id), status: String(rows[0].status) } : null;
    };
    const existing = await openRequest();
    if (existing?.status === "pending_verification") {
      // The first confirmation may never have arrived. New links replace the old ones, and the
      // caller sends the email again.
      await connection.query(
        `UPDATE ticket_requests
         SET verify_token_hash = ?, unsub_token_hash = ?, quantity = ?, country_code = ?, notes = ?
         WHERE id = ?`,
        [
          input.verifyTokenHash,
          input.unsubTokenHash,
          input.quantity,
          input.countryCode.trim() || null,
          input.notes.trim() || null,
          existing.id,
        ],
      );
      return { ok: true as const, id: existing.id, already: false, resent: true };
    }
    if (existing) return { ok: true as const, id: existing.id, already: true };

    const id = randomUUID();
    try {
      await connection.query(
        `INSERT INTO ticket_requests (
          id, match_id, user_id, email_hash, encrypted_email, quantity, country_code, notes,
          consent_at, status, verify_token_hash, unsub_token_hash, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_verification', ?, ?, ?)`,
        [
          id,
          match.id,
          await userExists(connection, input.userId),
          input.emailHash,
          input.encryptedEmail,
          input.quantity,
          input.countryCode.trim() || null,
          input.notes.trim() || null,
          now,
          input.verifyTokenHash,
          input.unsubTokenHash,
          now,
        ],
      );
    } catch (error) {
      // Another request for the same address and match won the race.
      const raced =
        (error as { code?: string }).code === "ER_DUP_ENTRY" ? await openRequest() : null;
      if (raced) return { ok: true as const, id: raced.id, already: true };
      throw error;
    }
    return { ok: true as const, id, already: false };
  });
}

export async function openTicketRequest(
  pool: Pool,
  tokenHash: string,
  intent: "verify" | "unsubscribe",
  now: Date,
) {
  return attempt(pool, async (connection) => {
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT r.id, r.status, m.slug AS match_slug, m.starts_at AS match_starts_at,
              m.status AS match_status
       FROM ticket_requests r JOIN matches m ON m.id = r.match_id
       WHERE ${intent === "unsubscribe" ? "r.unsub_token_hash = ? OR r.verify_token_hash = ?" : "r.verify_token_hash = ?"}
       LIMIT 1 FOR UPDATE`,
      intent === "unsubscribe" ? [tokenHash, tokenHash] : [tokenHash],
    );
    const request = rows[0];
    if (!request) throw new DomainError({ form: "This confirmation link is not valid." });
    const matchSlug = String(request.match_slug);

    if (intent === "unsubscribe") {
      await connection.query("UPDATE ticket_requests SET status = 'unsubscribed' WHERE id = ?", [
        request.id,
      ]);
      await writeAudit(
        connection,
        {
          actorId: null,
          actorEmail: null,
          action: "ticket_request.unsubscribed",
          entityType: "ticket_request",
          entityId: request.id,
          before: { status: request.status },
          after: { status: "unsubscribed" },
        },
        now,
      );
      return { ok: true as const, matchSlug, intent: "unsubscribe" as const };
    }

    if (request.status === "unsubscribed") {
      throw new DomainError({ form: "This alert was unsubscribed." });
    }
    if (
      (request.match_starts_at as Date).getTime() <= now.getTime() ||
      request.match_status === "cancelled"
    ) {
      // Keep the expiry: return the failure instead of throwing, so the transaction commits.
      await connection.query("UPDATE ticket_requests SET status = 'expired' WHERE id = ?", [
        request.id,
      ]);
      return failure({
        form: "This match has started or been cancelled, so the alert was not activated.",
      });
    }
    if (request.status === "pending_verification") {
      await connection.query(
        "UPDATE ticket_requests SET status = 'active', verified_at = ? WHERE id = ?",
        [now, request.id],
      );
    }
    return { ok: true as const, matchSlug, intent: "verify" as const };
  });
}

export async function approveOffer(
  pool: Pool,
  input: { offerId: string; matchSlug: string; actorId: string },
  now: Date,
) {
  return attempt(pool, async (connection) => {
    const actor = await actorWithRole(
      connection,
      input.actorId,
      STAFF,
      "Moderator access is required.",
    );
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT o.id, o.url, o.status, o.seller_name, o.seller_domain, o.match_id,
              m.slug AS match_slug, m.home_name, m.away_name, m.venue_name, m.city_name,
              m.competition_name, m.format, m.starts_at, m.timezone
       FROM ticket_offers o JOIN matches m ON m.id = o.match_id
       WHERE o.id = ? FOR UPDATE`,
      [input.offerId],
    );
    const offer = rows[0];
    if (!offer || offer.match_slug !== input.matchSlug) {
      throw new DomainError({ form: "Offer not found." });
    }
    if (offer.status !== "pending") {
      throw new DomainError({ form: "That ticket link is no longer waiting for review." });
    }
    const url = assertHttpsUrl(String(offer.url));
    if (!url) throw new DomainError({ form: "The offer URL is not an acceptable HTTPS link." });
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (await domainDenied(connection, host)) {
      throw new DomainError({ form: "That seller domain is blocked." });
    }

    await connection.query(
      `UPDATE ticket_offers
       SET status = 'active', approved = 1, approved_by = ?, last_checked_at = ?, updated_at = ?
       WHERE id = ?`,
      [actor.id, now, now, offer.id],
    );
    // A domain joins the allow list through approval or a fixture file. A deny rule stays a deny rule.
    await connection.query(
      "INSERT IGNORE INTO domain_rules (host, decision, created_at) VALUES (?, 'allow', ?)",
      [host, now],
    );

    const [requests] = await connection.query<RowDataPacket[]>(
      "SELECT id, encrypted_email FROM ticket_requests WHERE match_id = ? AND status = 'active' FOR UPDATE",
      [offer.match_id],
    );
    const match: EmailMatch = {
      slug: String(offer.match_slug),
      homeName: String(offer.home_name),
      awayName: String(offer.away_name),
      venueName: String(offer.venue_name),
      cityName: String(offer.city_name),
      competitionName: String(offer.competition_name),
      format: offer.format as MatchFormat,
      startsAt: (offer.starts_at as Date).toISOString(),
      timezone: String(offer.timezone),
    };
    const sold = {
      sellerName: String(offer.seller_name),
      sellerDomain: String(offer.seller_domain),
      url: String(offer.url),
    };
    const emails: EmailDraft[] = requests.map((request) =>
      ticketAlertEmail(match, sold, String(request.encrypted_email)),
    );
    if (requests.length > 0) {
      await connection.query("UPDATE ticket_requests SET status = 'notified' WHERE id IN (?)", [
        requests.map((request) => request.id),
      ]);
    }
    await writeAudit(
      connection,
      {
        actorId: actor.id,
        actorEmail: actor.email,
        action: "ticket_offer.approve",
        entityType: "ticket_offer",
        entityId: offer.id,
        before: { status: "pending" },
        after: { status: "active", domain: host },
      },
      now,
    );
    return { ok: true as const, notified: emails.length, emails };
  });
}

/**
 * Alerts for matches that list an active offer however it was listed. Approval sends its own
 * alerts; this catches links a fixture file listed, including ones that opened at a set time.
 */
export async function notifyListedAlerts(pool: Pool, now: Date) {
  return withTransaction(pool, async (connection) => {
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT r.id, r.encrypted_email, o.seller_name, o.seller_domain, o.url,
              m.slug, m.home_name, m.away_name, m.venue_name, m.city_name, m.competition_name,
              m.format, m.starts_at, m.timezone
       FROM ticket_requests r
       JOIN matches m ON m.id = r.match_id
       JOIN ticket_offers o ON o.match_id = m.id AND o.approved = 1 AND o.status = 'active'
       WHERE r.status = 'active' AND m.status = 'published' AND m.starts_at > ?
       ORDER BY r.id, o.kind = 'official' DESC, o.updated_at DESC
       FOR UPDATE`,
      [now],
    );
    const emails: EmailDraft[] = [];
    const notified = new Set<string>();
    for (const row of rows) {
      if (notified.has(row.id)) continue;
      notified.add(row.id);
      const match: EmailMatch = {
        slug: String(row.slug),
        homeName: String(row.home_name),
        awayName: String(row.away_name),
        venueName: String(row.venue_name),
        cityName: String(row.city_name),
        competitionName: String(row.competition_name),
        format: row.format as MatchFormat,
        startsAt: (row.starts_at as Date).toISOString(),
        timezone: String(row.timezone),
      };
      const sold = {
        sellerName: String(row.seller_name),
        sellerDomain: String(row.seller_domain),
        url: String(row.url),
      };
      emails.push(ticketAlertEmail(match, sold, String(row.encrypted_email)));
    }
    if (notified.size > 0) {
      await connection.query("UPDATE ticket_requests SET status = 'notified' WHERE id IN (?)", [
        [...notified],
      ]);
    }
    return emails;
  });
}

export async function markVerified(
  pool: Pool,
  input: { matchSlug: string; actorId: string },
  now: Date,
) {
  return attempt(pool, async (connection) => {
    const actor = await actorWithRole(
      connection,
      input.actorId,
      STAFF,
      "Moderator access is required.",
    );
    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT id, last_verified_at FROM matches WHERE slug = ? FOR UPDATE",
      [input.matchSlug],
    );
    const match = rows[0];
    if (!match) throw new DomainError({ form: "Match not found." });
    await connection.query("UPDATE matches SET last_verified_at = ?, updated_at = ? WHERE id = ?", [
      now,
      now,
      match.id,
    ]);
    await writeAudit(
      connection,
      {
        actorId: actor.id,
        actorEmail: actor.email,
        action: "match.verify",
        entityType: "match",
        entityId: match.id,
        before: { lastVerifiedAt: match.last_verified_at },
        after: { lastVerifiedAt: now.toISOString() },
      },
      now,
    );
    return { ok: true as const };
  });
}

export async function recordClick(pool: Pool, offerId: string, referrer: string | null, now: Date) {
  return attempt(pool, async (connection) => {
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT o.id, o.url, o.seller_name, o.seller_domain, o.match_id, o.approved, o.status,
              m.slug AS match_slug
       FROM ticket_offers o JOIN matches m ON m.id = o.match_id
       WHERE o.id = ?`,
      [offerId],
    );
    const offer = rows[0];
    if (!offer || !offer.approved || offer.status !== "active") {
      throw new DomainError({ form: "That ticket link is not available." });
    }
    await connection.query(
      "INSERT INTO outbound_clicks (match_id, offer_id, referrer, created_at) VALUES (?, ?, ?, ?)",
      [offer.match_id, offer.id, referrer ? referrer.slice(0, 300) : null, now],
    );
    return {
      ok: true as const,
      url: String(offer.url),
      sellerName: String(offer.seller_name),
      sellerDomain: String(offer.seller_domain),
      matchSlug: String(offer.match_slug),
    };
  });
}

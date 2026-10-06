import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import type {
  AuditRecord,
  ImportRun,
  Role,
  StoredAcademy,
  StoredMatch,
  StoredOffer,
  Submission,
} from "@/lib/domain/types";

export type MatchRow = RowDataPacket & {
  id: string;
  slug: string;
  competition_name: string;
  competition_slug: string;
  kind: StoredMatch["kind"];
  season_name: string | null;
  season_slug: string | null;
  home_name: string;
  home_short: string;
  home_slug: string;
  away_name: string;
  away_short: string;
  away_slug: string;
  venue_name: string;
  venue_slug: string;
  venue_address: string;
  city_name: string;
  city_slug: string;
  state_name: string | null;
  state_slug: string | null;
  country_name: string;
  country_slug: string;
  starts_at: Date;
  ends_at: Date | null;
  timezone: string;
  format: StoredMatch["format"];
  status: StoredMatch["status"];
  attendance_type: StoredMatch["attendanceType"];
  source_type: StoredMatch["sourceType"];
  source_external_id: string | null;
  source_url: string | null;
  source_label: string;
  featured_rank: number;
  last_verified_at: Date | null;
  published_at: Date | null;
  entry_notes: string | null;
  demo: number;
  academy_slug: string | null;
};

export type OfferRow = RowDataPacket & {
  id: string;
  match_id: string;
  seller_name: string;
  seller_domain: string;
  url: string;
  kind: StoredOffer["kind"];
  currency: string | null;
  price_from: number | null;
  status: StoredOffer["status"];
  last_checked_at: Date | null;
  approved: number;
};

export type AcademyRow = RowDataPacket & {
  id: string;
  slug: string;
  kind: StoredAcademy["kind"];
  name: string;
  description: string;
  address: string;
  city_name: string;
  city_slug: string;
  state_name: string | null;
  state_slug: string | null;
  country_name: string;
  country_slug: string;
  timezone: string | null;
  website: string | null;
  phone: string | null;
  whatsapp: string | null;
  contact_email: string | null;
  links: StoredAcademy["links"] | null;
  age_groups: string[] | null;
  facilities: string[] | null;
  offerings: StoredAcademy["offerings"] | null;
  verification_status: StoredAcademy["verificationStatus"];
  verification_label: string | null;
  review_notes: string | null;
  last_verified_at: Date | null;
  owner_id: string | null;
  owner_email: string | null;
  demo: number;
};

export type SubmissionRow = RowDataPacket & {
  id: string;
  entity_type: Submission["entityType"];
  payload: Record<string, unknown> | null;
  submitter_id: string | null;
  submitter_email: string | null;
  status: Submission["status"];
  duplicate_of: string | null;
  reviewer_email: string | null;
  reviewer_notes: string | null;
  created_at: Date;
  updated_at: Date;
};

export type UserRow = RowDataPacket & {
  id: string;
  email: string;
  role: Role;
  display_name: string;
};

function iso(value: Date | null) {
  return value ? value.toISOString() : null;
}

export function toOffer(row: OfferRow): StoredOffer {
  return {
    id: row.id,
    sellerName: row.seller_name,
    sellerDomain: row.seller_domain,
    url: row.url,
    kind: row.kind,
    currency: row.currency,
    priceFrom: row.price_from == null ? null : Number(row.price_from),
    status: row.status,
    lastCheckedAt: iso(row.last_checked_at),
    approved: Boolean(row.approved),
  };
}

export function toMatch(row: MatchRow, offers: StoredOffer[]): StoredMatch {
  return {
    id: row.id,
    slug: row.slug,
    competitionName: row.competition_name,
    competitionSlug: row.competition_slug,
    kind: row.kind,
    seasonName: row.season_name,
    seasonSlug: row.season_slug,
    homeName: row.home_name,
    homeShort: row.home_short,
    homeSlug: row.home_slug,
    awayName: row.away_name,
    awayShort: row.away_short,
    awaySlug: row.away_slug,
    venueName: row.venue_name,
    venueSlug: row.venue_slug,
    venueAddress: row.venue_address,
    cityName: row.city_name,
    citySlug: row.city_slug,
    stateName: row.state_name,
    stateSlug: row.state_slug,
    countryName: row.country_name,
    countrySlug: row.country_slug,
    startsAt: row.starts_at.toISOString(),
    endsAt: iso(row.ends_at),
    timezone: row.timezone,
    format: row.format,
    status: row.status,
    attendanceType: row.attendance_type,
    sourceType: row.source_type,
    sourceExternalId: row.source_external_id,
    sourceUrl: row.source_url,
    sourceLabel: row.source_label,
    featuredRank: row.featured_rank,
    lastVerifiedAt: iso(row.last_verified_at),
    publishedAt: iso(row.published_at),
    entryNotes: row.entry_notes,
    demo: Boolean(row.demo),
    academySlug: row.academy_slug,
    offers,
  };
}

export function toAcademy(row: AcademyRow): StoredAcademy {
  return {
    id: row.id,
    slug: row.slug,
    kind: row.kind,
    name: row.name,
    description: row.description,
    address: row.address,
    cityName: row.city_name,
    citySlug: row.city_slug,
    stateName: row.state_name,
    stateSlug: row.state_slug,
    countryName: row.country_name,
    countrySlug: row.country_slug,
    timezone: row.timezone,
    website: row.website,
    phone: row.phone,
    whatsapp: row.whatsapp,
    contactEmail: row.contact_email,
    links: row.links ?? {},
    ageGroups: row.age_groups ?? [],
    facilities: row.facilities ?? [],
    offerings: row.offerings ?? [],
    verificationStatus: row.verification_status,
    verificationLabel: row.verification_label,
    reviewNotes: row.review_notes,
    lastVerifiedAt: iso(row.last_verified_at),
    ownerEmail: row.owner_email,
    demo: Boolean(row.demo),
  };
}

export function toSubmission(row: SubmissionRow): Submission {
  return {
    id: row.id,
    entityType: row.entity_type,
    payload: row.payload ?? {},
    submitterEmail: row.submitter_email,
    status: row.status,
    duplicateOf: row.duplicate_of,
    reviewerEmail: row.reviewer_email,
    reviewerNotes: row.reviewer_notes,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export function toAudit(row: RowDataPacket): AuditRecord {
  return {
    id: String(row.id),
    actorEmail: row.actor_email,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id ?? "",
    before: row.before_state,
    after: row.after_state,
    createdAt: (row.created_at as Date).toISOString(),
  };
}

export function toImportRun(row: RowDataPacket): ImportRun {
  return {
    id: row.id,
    provider: row.provider,
    startedAt: (row.started_at as Date).toISOString(),
    finishedAt: iso(row.finished_at),
    fetchedCount: row.fetched_count,
    insertedCount: row.inserted_count,
    updatedCount: row.updated_count,
    failedCount: row.failed_count,
    status: row.status,
    errorSummary: row.error_summary,
  };
}

const date = (value: string | null) => (value ? new Date(value) : null);

export async function insertMatch(
  connection: PoolConnection,
  match: StoredMatch,
  now: Date,
  submittedBy: string | null = null,
) {
  await connection.query(
    `INSERT INTO matches (
      id, slug, competition_name, competition_slug, kind, season_name, season_slug,
      home_name, home_short, home_slug, away_name, away_short, away_slug,
      venue_name, venue_slug, venue_address, city_name, city_slug, state_name, state_slug,
      country_name, country_slug, starts_at, ends_at, timezone, format, status, attendance_type,
      source_type, source_external_id, source_url, source_label, featured_rank, last_verified_at,
      published_at, entry_notes, demo, academy_slug, submitted_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      match.id,
      match.slug,
      match.competitionName,
      match.competitionSlug,
      match.kind,
      match.seasonName,
      match.seasonSlug,
      match.homeName,
      match.homeShort,
      match.homeSlug,
      match.awayName,
      match.awayShort,
      match.awaySlug,
      match.venueName,
      match.venueSlug,
      match.venueAddress,
      match.cityName,
      match.citySlug,
      match.stateName,
      match.stateSlug,
      match.countryName,
      match.countrySlug,
      new Date(match.startsAt),
      date(match.endsAt),
      match.timezone,
      match.format,
      match.status,
      match.attendanceType,
      match.sourceType,
      match.sourceExternalId,
      match.sourceUrl,
      match.sourceLabel,
      match.featuredRank,
      date(match.lastVerifiedAt),
      date(match.publishedAt),
      match.entryNotes,
      match.demo,
      match.academySlug,
      submittedBy,
      now,
      now,
    ],
  );
}

export async function insertOffer(
  connection: PoolConnection,
  matchId: string,
  offer: StoredOffer,
  now: Date,
  approvedBy: string | null = null,
) {
  await connection.query(
    `INSERT INTO ticket_offers (
      id, match_id, seller_name, seller_domain, url, kind, currency, price_from, status,
      last_checked_at, approved, approved_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      offer.id,
      matchId,
      offer.sellerName,
      offer.sellerDomain,
      offer.url,
      offer.kind,
      offer.currency,
      offer.priceFrom,
      offer.status,
      date(offer.lastCheckedAt),
      offer.approved,
      approvedBy,
      now,
      now,
    ],
  );
}

/** A host is blocked when it, or a parent domain, has a deny rule. */
export async function domainDenied(connection: PoolConnection, host: string) {
  const labels = host.toLowerCase().split(".");
  const candidates = labels
    .map((_, index) => labels.slice(index).join("."))
    .filter((item) => item.includes("."));
  if (candidates.length === 0) return false;
  const [rows] = await connection.query<RowDataPacket[]>(
    "SELECT 1 FROM domain_rules WHERE decision = 'deny' AND host IN (?) LIMIT 1",
    [candidates],
  );
  return rows.length > 0;
}

export async function insertAcademy(
  connection: PoolConnection,
  academy: StoredAcademy,
  now: Date,
  ownerId: string | null = null,
) {
  await connection.query(
    `INSERT INTO academies (
      id, slug, kind, name, description, address, city_name, city_slug, state_name, state_slug,
      country_name, country_slug, timezone, website, phone, whatsapp, contact_email, links,
      age_groups, facilities, offerings, verification_status, verification_label, review_notes,
      last_verified_at, owner_id, owner_email, demo, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      academy.id,
      academy.slug,
      academy.kind,
      academy.name,
      academy.description,
      academy.address,
      academy.cityName,
      academy.citySlug,
      academy.stateName,
      academy.stateSlug,
      academy.countryName,
      academy.countrySlug,
      academy.timezone,
      academy.website,
      academy.phone,
      academy.whatsapp,
      academy.contactEmail,
      JSON.stringify(academy.links),
      JSON.stringify(academy.ageGroups),
      JSON.stringify(academy.facilities),
      JSON.stringify(academy.offerings),
      academy.verificationStatus,
      academy.verificationLabel,
      academy.reviewNotes,
      date(academy.lastVerifiedAt),
      ownerId,
      academy.ownerEmail,
      academy.demo,
      now,
      now,
    ],
  );
}

export async function writeAudit(
  connection: PoolConnection,
  entry: {
    actorId: string | null;
    actorEmail: string | null;
    action: string;
    entityType: string;
    entityId: string | null;
    before: unknown;
    after: unknown;
  },
  now: Date,
) {
  await connection.query(
    `INSERT INTO audit_log
      (actor_id, actor_email, action, entity_type, entity_id, before_state, after_state, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.actorId,
      entry.actorEmail,
      entry.action,
      entry.entityType,
      entry.entityId,
      entry.before == null ? null : JSON.stringify(entry.before),
      entry.after == null ? null : JSON.stringify(entry.after),
      now,
    ],
  );
}

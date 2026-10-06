import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { indiaCity, indiaState, stateOfCity } from "@/lib/data/india";
import { DomainError } from "@/lib/data/mysql/pool";
import {
  domainDenied,
  insertAcademy,
  insertMatch,
  insertOffer,
  toAcademy,
  toMatch,
  writeAudit,
  type AcademyRow,
  type MatchRow,
} from "@/lib/data/mysql/rows";
import { STAFF, actorWithRole, attempt, freeSlug } from "@/lib/data/mysql/writes";
import { countries } from "@/lib/data/seed";
import {
  MAX_OFFERINGS,
  MAX_PROFILES_PER_ACCOUNT,
  MAX_UPCOMING_MATCHES,
  PROFILE_KIND_LABEL,
  profilePath,
  shortName,
} from "@/lib/domain/profiles";
import { slugify } from "@/lib/domain/slug";
import { zonedTimeToUtc } from "@/lib/domain/time";
import type { MatchStatus, Offering, StoredAcademy, StoredMatch } from "@/lib/domain/types";
import { assertHttpsUrl } from "@/lib/domain/urls";
import type { EmailDraft } from "@/lib/domain/workflows";
import {
  profileApprovedMessage,
  profileRejectedMessage,
  profileReviewNotice,
} from "@/lib/email/messages";
import { siteUrl } from "@/lib/utils";
import type { OfferingInput, OwnerMatchInput, ProfileInput } from "@/lib/validation/profile";

/** The signed-in person a profile belongs to. Email counts, so a claimed listing works too. */
export type Owner = { userId: string; email: string };

type Place = {
  cityName: string;
  citySlug: string;
  stateName: string | null;
  stateSlug: string | null;
  countryName: string;
  countrySlug: string;
  timezone: string;
};

export const LISTED_BY_PROFILE = "source_type IN ('organiser', 'academy')";
const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;

function validZone(zone: string | null | undefined): zone is string {
  if (!zone) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** Turns the country, state and town typed in a form into stored place fields. */
export function resolvePlace(input: {
  country: string;
  state?: string | null;
  city: string;
  timezone?: string | null;
}): Place {
  const country = countries.find((item) => item.slug === input.country);
  if (!country) throw new DomainError({ country: "Choose a country from the list." });
  const citySlug = slugify(input.city);
  if (country.slug !== "india") {
    return {
      cityName: input.city.trim(),
      citySlug,
      stateName: null,
      stateSlug: null,
      countryName: country.name,
      countrySlug: country.slug,
      timezone: validZone(input.timezone) ? input.timezone : country.timezone,
    };
  }
  const state = indiaState(input.state);
  if (!state) throw new DomainError({ state: "Choose your state." });
  const listed = state.cities.find((city) => city.slug === citySlug);
  const elsewhere = listed ? null : stateOfCity(citySlug);
  if (elsewhere) {
    throw new DomainError({
      city: `${indiaCity(citySlug)?.name} is in ${elsewhere.name}. Choose that state, or check the town.`,
    });
  }
  return {
    cityName: listed?.name ?? input.city.trim(),
    citySlug,
    stateName: state.name,
    stateSlug: state.slug,
    countryName: "India",
    countrySlug: "india",
    timezone: "Asia/Kolkata",
  };
}

function profileFields(input: ProfileInput) {
  const links: StoredAcademy["links"] = {};
  if (input.instagram) links.instagram = input.instagram;
  if (input.facebook) links.facebook = input.facebook;
  if (input.youtube) links.youtube = input.youtube;
  return {
    kind: input.kind,
    name: input.name,
    description: input.description,
    address: input.address,
    website: input.website ? (assertHttpsUrl(input.website)?.toString() ?? null) : null,
    phone: input.phone || null,
    whatsapp: input.whatsapp || null,
    contactEmail: input.contactEmail.toLowerCase(),
    links,
    ageGroups: input.ageGroups,
    facilities: input.facilities,
  };
}

export async function ownedProfile(connection: PoolConnection, owner: Owner, slug: string) {
  const [rows] = await connection.query<AcademyRow[]>(
    "SELECT * FROM academies WHERE slug = ? AND (owner_id = ? OR owner_email = ?) FOR UPDATE",
    [slug, owner.userId, owner.email.toLowerCase()],
  );
  if (!rows[0]) throw new DomainError({ form: "That profile is not on your account." });
  return toAcademy(rows[0]);
}

function emailPlace(profile: Pick<StoredAcademy, "cityName" | "stateName" | "countryName">) {
  return `${profile.cityName}, ${profile.stateName ?? profile.countryName}`;
}

/** Moderators and admins hear about a profile that waits for its check. */
async function reviewNotices(connection: PoolConnection, profile: StoredAcademy) {
  const [staff] = await connection.query<RowDataPacket[]>(
    "SELECT email FROM users WHERE role IN (?)",
    [STAFF],
  );
  const message = profileReviewNotice(
    { name: profile.name, kind: PROFILE_KIND_LABEL[profile.kind], place: emailPlace(profile) },
    `${siteUrl()}/admin/profiles`,
  );
  return staff.map((row): EmailDraft => ({ to: String(row.email), ...message }));
}

/** A slug with the town in it, unless the name already says where it is. */
function profileSlugBase(name: string, place: Place) {
  const base = slugify(name);
  return base.includes(place.citySlug) ? base : `${base}-${place.citySlug}`;
}

export async function createProfile(pool: Pool, owner: Owner, input: ProfileInput, now: Date) {
  return attempt(pool, async (connection) => {
    const [owned] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS total FROM academies WHERE owner_id = ?",
      [owner.userId],
    );
    if (Number(owned[0]?.total ?? 0) >= MAX_PROFILES_PER_ACCOUNT) {
      throw new DomainError({
        form: `An account can run up to ${MAX_PROFILES_PER_ACCOUNT} profiles. Write to hello@cricketmatch.today for more.`,
      });
    }
    const place = resolvePlace(input);
    const slug = await freeSlug(connection, "academies", profileSlugBase(input.name, place));
    const profile: StoredAcademy = {
      id: randomUUID(),
      slug,
      ...profileFields(input),
      ...place,
      offerings: [],
      logo: null,
      cover: null,
      photos: [],
      verificationStatus: "pending",
      verificationLabel: null,
      reviewNotes: null,
      lastVerifiedAt: null,
      ownerEmail: owner.email.toLowerCase(),
      demo: false,
    };
    await insertAcademy(connection, profile, now, owner.userId);
    await writeAudit(
      connection,
      {
        actorId: owner.userId,
        actorEmail: owner.email,
        action: "profile.create",
        entityType: "academy",
        entityId: profile.id,
        before: null,
        after: { slug, kind: profile.kind, name: profile.name },
      },
      now,
    );
    return { ok: true as const, slug, emails: await reviewNotices(connection, profile) };
  });
}

/**
 * Saves an owner's edit. A verified profile changes at once; one sent back for changes goes back
 * for its check. The profile's matches keep pointing at it under its current name.
 */
export async function updateProfile(
  pool: Pool,
  owner: Owner,
  slug: string,
  input: ProfileInput,
  now: Date,
) {
  return attempt(pool, async (connection) => {
    const current = await ownedProfile(connection, owner, slug);
    const place = resolvePlace(input);
    const fields = profileFields(input);
    const resubmitted = current.verificationStatus === "rejected";
    const status = resubmitted ? "pending" : current.verificationStatus;
    await connection.query(
      `UPDATE academies
       SET kind = ?, name = ?, description = ?, address = ?, city_name = ?, city_slug = ?,
           state_name = ?, state_slug = ?, country_name = ?, country_slug = ?, timezone = ?,
           website = ?, phone = ?, whatsapp = ?, contact_email = ?, links = ?, age_groups = ?,
           facilities = ?, verification_status = ?, review_notes = ?, updated_at = ?
       WHERE id = ?`,
      [
        fields.kind,
        fields.name,
        fields.description,
        fields.address,
        place.cityName,
        place.citySlug,
        place.stateName,
        place.stateSlug,
        place.countryName,
        place.countrySlug,
        place.timezone,
        fields.website,
        fields.phone,
        fields.whatsapp,
        fields.contactEmail,
        JSON.stringify(fields.links),
        JSON.stringify(fields.ageGroups),
        JSON.stringify(fields.facilities),
        status,
        resubmitted ? null : current.reviewNotes,
        now,
        current.id,
      ],
    );
    const updated: StoredAcademy = { ...current, ...fields, ...place, verificationStatus: status };
    await connection.query(
      `UPDATE matches SET kind = ?, source_type = ?, source_url = ?, source_label = ?, updated_at = ?
       WHERE academy_slug = ? AND ${LISTED_BY_PROFILE}`,
      [
        updated.kind === "academy" ? "academy" : "local",
        updated.kind === "academy" ? "academy" : "organiser",
        `${siteUrl()}${profilePath(updated)}`,
        `Posted by ${updated.name}`,
        now,
        updated.slug,
      ],
    );
    await writeAudit(
      connection,
      {
        actorId: owner.userId,
        actorEmail: owner.email,
        action: "profile.update",
        entityType: "academy",
        entityId: current.id,
        before: { name: current.name, status: current.verificationStatus },
        after: { name: updated.name, status },
      },
      now,
    );
    return {
      ok: true as const,
      slug,
      status,
      emails: resubmitted ? await reviewNotices(connection, updated) : [],
    };
  });
}

export async function saveOffering(pool: Pool, owner: Owner, input: OfferingInput, now: Date) {
  return attempt(pool, async (connection) => {
    const profile = await ownedProfile(connection, owner, input.profile);
    const offering: Offering = {
      id: input.id || randomUUID(),
      category: input.category,
      title: input.title,
      price: input.price || null,
      schedule: input.schedule || null,
      details: input.details || null,
      url: input.url ? (assertHttpsUrl(input.url)?.toString() ?? null) : null,
    };
    const index = profile.offerings.findIndex((item) => item.id === offering.id);
    if (index === -1 && input.id) {
      throw new DomainError({ form: "That offer was removed. Add it again." });
    }
    if (index === -1 && profile.offerings.length >= MAX_OFFERINGS) {
      throw new DomainError({ form: `A profile can list up to ${MAX_OFFERINGS} offers.` });
    }
    const offerings =
      index === -1
        ? [...profile.offerings, offering]
        : profile.offerings.map((item, at) => (at === index ? offering : item));
    await connection.query("UPDATE academies SET offerings = ?, updated_at = ? WHERE id = ?", [
      JSON.stringify(offerings),
      now,
      profile.id,
    ]);
    await writeAudit(
      connection,
      {
        actorId: owner.userId,
        actorEmail: owner.email,
        action: "offering.save",
        entityType: "academy",
        entityId: profile.id,
        before: null,
        after: { id: offering.id, title: offering.title },
      },
      now,
    );
    return { ok: true as const, id: offering.id };
  });
}

export async function removeOffering(
  pool: Pool,
  owner: Owner,
  input: { profile: string; id: string },
  now: Date,
) {
  return attempt(pool, async (connection) => {
    const profile = await ownedProfile(connection, owner, input.profile);
    const offerings = profile.offerings.filter((item) => item.id !== input.id);
    if (offerings.length === profile.offerings.length) return { ok: true as const };
    await connection.query("UPDATE academies SET offerings = ?, updated_at = ? WHERE id = ?", [
      JSON.stringify(offerings),
      now,
      profile.id,
    ]);
    await writeAudit(
      connection,
      {
        actorId: owner.userId,
        actorEmail: owner.email,
        action: "offering.remove",
        entityType: "academy",
        entityId: profile.id,
        before: { id: input.id },
        after: null,
      },
      now,
    );
    return { ok: true as const };
  });
}

/**
 * A moderator's check. Approval makes the profile and its waiting matches public; sending it
 * back hides both until it passes again.
 */
export async function reviewProfile(
  pool: Pool,
  input: { actorId: string; slug: string; action: "approve" | "reject"; reason?: string },
  now: Date,
) {
  return attempt(pool, async (connection) => {
    const actor = await actorWithRole(
      connection,
      input.actorId,
      STAFF,
      "Moderator access is required.",
    );
    const [rows] = await connection.query<AcademyRow[]>(
      "SELECT * FROM academies WHERE slug = ? FOR UPDATE",
      [input.slug],
    );
    if (!rows[0]) throw new DomainError({ form: "Profile not found." });
    const profile = toAcademy(rows[0]);
    const recipient = profile.ownerEmail || profile.contactEmail;
    const summary = {
      name: profile.name,
      kind: PROFILE_KIND_LABEL[profile.kind],
      place: emailPlace(profile),
    };
    const dashboard = `${siteUrl()}/dashboard/profiles/${profile.slug}`;

    if (input.action === "reject") {
      const reason = (input.reason ?? "").trim();
      if (reason.length < 3) throw new DomainError({ reason: "Say what needs to change." });
      await connection.query(
        `UPDATE academies SET verification_status = 'rejected', review_notes = ?, updated_at = ?
         WHERE id = ?`,
        [reason, now, profile.id],
      );
      await connection.query(
        `UPDATE matches SET status = 'pending', updated_at = ?
         WHERE academy_slug = ? AND status IN ('published', 'postponed') AND ${LISTED_BY_PROFILE}`,
        [now, profile.slug],
      );
      await writeAudit(
        connection,
        {
          actorId: actor.id,
          actorEmail: actor.email,
          action: "profile.reject",
          entityType: "academy",
          entityId: profile.id,
          before: { status: profile.verificationStatus },
          after: { status: "rejected", reason },
        },
        now,
      );
      const emails: EmailDraft[] = recipient
        ? [{ to: recipient, ...profileRejectedMessage(summary, reason, dashboard) }]
        : [];
      return { ok: true as const, emails };
    }

    await connection.query(
      `UPDATE academies
       SET verification_status = 'verified', verification_label = 'Contact verified',
           review_notes = NULL, last_verified_at = ?, updated_at = ?
       WHERE id = ?`,
      [now, now, profile.id],
    );
    const [published] = await connection.query(
      `UPDATE matches SET status = 'published', published_at = COALESCE(published_at, ?), updated_at = ?
       WHERE academy_slug = ? AND status = 'pending' AND starts_at > ? AND ${LISTED_BY_PROFILE}`,
      [now, now, profile.slug, now],
    );
    await writeAudit(
      connection,
      {
        actorId: actor.id,
        actorEmail: actor.email,
        action: "profile.approve",
        entityType: "academy",
        entityId: profile.id,
        before: { status: profile.verificationStatus },
        after: {
          status: "verified",
          matches: (published as { affectedRows: number }).affectedRows,
        },
      },
      now,
    );
    const emails: EmailDraft[] = recipient
      ? [
          {
            to: recipient,
            ...profileApprovedMessage(summary, `${siteUrl()}${profilePath(profile)}`, dashboard),
          },
        ]
      : [];
    return { ok: true as const, emails };
  });
}

/**
 * Posts or edits a match from a profile. A checked profile's matches go live at once with the
 * profile as their source; until the check they wait, hidden. Ticket links wait for a moderator.
 */
export async function saveOwnerMatch(pool: Pool, owner: Owner, input: OwnerMatchInput, now: Date) {
  return attempt(pool, async (connection) => {
    const profile = await ownedProfile(connection, owner, input.profile);
    return saveMatchWithin(connection, owner, profile, input, now);
  });
}

/**
 * Saves one of a profile's matches inside the caller's transaction, after the caller has locked
 * the profile. A spreadsheet import calls it once a row.
 */
export async function saveMatchWithin(
  connection: PoolConnection,
  owner: Owner,
  profile: StoredAcademy,
  input: OwnerMatchInput,
  now: Date,
) {
  if (profile.verificationStatus === "rejected") {
    throw new DomainError({
      form: "Your profile needs a change before you can post matches. Edit it first.",
    });
  }
  const place = resolvePlace({
    country: profile.countrySlug,
    state: input.state || profile.stateSlug,
    city: input.city,
    timezone: profile.timezone,
  });
  const startsAt = zonedTimeToUtc(`${input.date}T${input.time}`, place.timezone);
  const start = new Date(startsAt).getTime();

  let existing: StoredMatch | null = null;
  if (input.match) {
    const [rows] = await connection.query<MatchRow[]>(
      `SELECT * FROM matches WHERE slug = ? AND academy_slug = ? AND ${LISTED_BY_PROFILE}
       FOR UPDATE`,
      [input.match, profile.slug],
    );
    if (!rows[0]) throw new DomainError({ form: "That match is not on this profile." });
    existing = toMatch(rows[0], []);
  }
  if (!existing) {
    const [upcoming] = await connection.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM matches
       WHERE academy_slug = ? AND starts_at > ? AND status IN ('published', 'pending', 'postponed')`,
      [profile.slug, now],
    );
    if (Number(upcoming[0]?.total ?? 0) >= MAX_UPCOMING_MATCHES) {
      throw new DomainError({
        form: `A profile can list up to ${MAX_UPCOMING_MATCHES} upcoming matches.`,
      });
    }
  }
  if (!existing && start <= now.getTime()) {
    throw new DomainError({ date: "Choose a date and time that has not passed." });
  }
  if (start > now.getTime() + TWO_YEARS_MS) {
    throw new DomainError({ date: "Choose a date within the next two years." });
  }

  const verified = profile.verificationStatus === "verified";
  const status: MatchStatus = !verified ? "pending" : existing ? input.status : "published";
  const competition = input.competition || "Friendly match";
  const fields = {
    competitionName: competition,
    competitionSlug: slugify(competition),
    kind: profile.kind === "academy" ? ("academy" as const) : ("local" as const),
    homeName: input.homeTeam,
    homeShort: shortName(input.homeTeam),
    homeSlug: slugify(input.homeTeam),
    awayName: input.awayTeam,
    awayShort: shortName(input.awayTeam),
    awaySlug: slugify(input.awayTeam),
    venueName: input.ground,
    venueSlug: slugify(input.ground),
    venueAddress: `${input.ground}, ${place.cityName}`,
    ...place,
    startsAt,
    format: input.format,
    status,
    attendanceType: input.attendance,
    sourceType: profile.kind === "academy" ? ("academy" as const) : ("organiser" as const),
    sourceUrl: `${siteUrl()}${profilePath(profile)}`,
    sourceLabel: `Posted by ${profile.name}`,
    entryNotes: input.entryNotes || null,
  };

  let matchId: string;
  let slug: string;
  if (existing) {
    matchId = existing.id;
    slug = existing.slug;
    await connection.query(
      `UPDATE matches
       SET competition_name = ?, competition_slug = ?, kind = ?, home_name = ?, home_short = ?,
           home_slug = ?, away_name = ?, away_short = ?, away_slug = ?, venue_name = ?,
           venue_slug = ?, venue_address = ?, city_name = ?, city_slug = ?, state_name = ?,
           state_slug = ?, country_name = ?, country_slug = ?, starts_at = ?, timezone = ?,
           format = ?, status = ?, attendance_type = ?, source_type = ?, source_url = ?,
           source_label = ?, entry_notes = ?, last_verified_at = ?,
           published_at = CASE WHEN ? = 'published' THEN COALESCE(published_at, ?) ELSE published_at END,
           updated_at = ?
       WHERE id = ?`,
      [
        fields.competitionName,
        fields.competitionSlug,
        fields.kind,
        fields.homeName,
        fields.homeShort,
        fields.homeSlug,
        fields.awayName,
        fields.awayShort,
        fields.awaySlug,
        fields.venueName,
        fields.venueSlug,
        fields.venueAddress,
        fields.cityName,
        fields.citySlug,
        fields.stateName,
        fields.stateSlug,
        fields.countryName,
        fields.countrySlug,
        new Date(startsAt),
        fields.timezone,
        fields.format,
        fields.status,
        fields.attendanceType,
        fields.sourceType,
        fields.sourceUrl,
        fields.sourceLabel,
        fields.entryNotes,
        now,
        fields.status,
        now,
        now,
        matchId,
      ],
    );
  } else {
    matchId = randomUUID();
    slug = await freeSlug(
      connection,
      "matches",
      `${input.homeTeam} vs ${input.awayTeam} ${place.cityName} ${input.date}`,
    );
    await insertMatch(
      connection,
      {
        id: matchId,
        slug,
        ...fields,
        seasonName: null,
        seasonSlug: null,
        endsAt: null,
        sourceExternalId: null,
        featuredRank: 0,
        lastVerifiedAt: now.toISOString(),
        publishedAt: status === "published" ? now.toISOString() : null,
        demo: false,
        academySlug: profile.slug,
        offers: [],
      },
      now,
      owner.userId,
    );
  }

  if (input.attendance === "ticketed" && input.ticketUrl) {
    const ticket = assertHttpsUrl(input.ticketUrl);
    if (!ticket) throw new DomainError({ ticketUrl: "Ticket link must be a full https address." });
    const host = ticket.hostname.replace(/^www\./, "").toLowerCase();
    if (await domainDenied(connection, host)) {
      throw new DomainError({ ticketUrl: "That ticket site is blocked." });
    }
    const [offers] = await connection.query<RowDataPacket[]>(
      "SELECT id FROM ticket_offers WHERE match_id = ? AND url = ?",
      [matchId, ticket.toString()],
    );
    if (!offers[0]) {
      // As for every organiser, the link stays pending until a moderator approves it.
      await insertOffer(
        connection,
        matchId,
        {
          id: randomUUID(),
          sellerName: host,
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
  }

  await writeAudit(
    connection,
    {
      actorId: owner.userId,
      actorEmail: owner.email,
      action: existing ? "match.update" : "match.create",
      entityType: "match",
      entityId: matchId,
      before: existing ? { startsAt: existing.startsAt, status: existing.status } : null,
      after: { slug, startsAt, status },
    },
    now,
  );
  return { ok: true as const, slug, status, startsAt };
}

/** Every profile on an account, whatever its state. */
export async function loadOwnerProfiles(pool: Pool, owner: Owner) {
  const [rows] = await pool.query<AcademyRow[]>(
    "SELECT * FROM academies WHERE owner_id = ? OR owner_email = ? ORDER BY created_at",
    [owner.userId, owner.email.toLowerCase()],
  );
  return rows.map((row) => toAcademy(row));
}

/** One of an account's profiles with every match it has posted. */
export async function loadOwnerProfile(pool: Pool, owner: Owner, slug: string) {
  const [rows] = await pool.query<AcademyRow[]>(
    "SELECT * FROM academies WHERE slug = ? AND (owner_id = ? OR owner_email = ?)",
    [slug, owner.userId, owner.email.toLowerCase()],
  );
  if (!rows[0]) return null;
  const [matches] = await pool.query<MatchRow[]>(
    `SELECT * FROM matches WHERE academy_slug = ? AND ${LISTED_BY_PROFILE} ORDER BY starts_at`,
    [slug],
  );
  return { profile: toAcademy(rows[0]), matches: matches.map((row) => toMatch(row, [])) };
}

/** Profiles waiting for a check, oldest first, and the latest decisions. */
export async function loadProfileQueue(pool: Pool) {
  const [pending] = await pool.query<AcademyRow[]>(
    "SELECT * FROM academies WHERE verification_status = 'pending' AND demo = 0 ORDER BY updated_at",
  );
  const [recent] = await pool.query<AcademyRow[]>(
    `SELECT * FROM academies WHERE verification_status IN ('verified', 'rejected') AND demo = 0
     ORDER BY updated_at DESC LIMIT 30`,
  );
  return {
    pending: pending.map((row) => toAcademy(row)),
    recent: recent.map((row) => toAcademy(row)),
  };
}

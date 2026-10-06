import type { Pool, RowDataPacket } from "mysql2/promise";
import { DomainError } from "@/lib/data/mysql/pool";
import {
  LISTED_BY_PROFILE,
  ownedProfile,
  resolvePlace,
  saveMatchWithin,
  type Owner,
} from "@/lib/data/mysql/profiles";
import { toMatch, writeAudit, type MatchRow } from "@/lib/data/mysql/rows";
import { teamPairKey } from "@/lib/domain/duplicates";
import {
  MAX_IMPORT_ROWS,
  SCHEDULE_FIELD_LABEL,
  readSchedule,
  type ScheduleColumn,
  type ScheduleField,
} from "@/lib/domain/schedule";
import { formatInTimeZone, localParts, zonedTimeToUtc } from "@/lib/domain/time";
import type { StoredMatch } from "@/lib/domain/types";
import { assertHttpsUrl } from "@/lib/domain/urls";
import { ownerMatchSchema, type OwnerMatchInput } from "@/lib/validation/profile";

/**
 * What happens to a row: a new match, a change to one already listed, nothing because it is
 * listed as it is, nothing because its day has passed, or an error to fix in the sheet.
 */
export type ScheduleOutcome = "add" | "update" | "same" | "past" | "error";

export type ScheduleRowResult = {
  line: number;
  outcome: ScheduleOutcome;
  when: string | null;
  homeTeam: string;
  awayTeam: string;
  ground: string;
  city: string;
  competition: string;
  format: string;
  attendance: string;
  problems: string[];
  filled: string[];
  slug: string | null;
};

export type ScheduleResult = {
  ok: true;
  committed: boolean;
  columns: ScheduleColumn[];
  rows: ScheduleRowResult[];
};

const FIELD_OF_INPUT: Partial<Record<keyof OwnerMatchInput, ScheduleField>> = {
  competition: "competition",
  homeTeam: "homeTeam",
  awayTeam: "awayTeam",
  date: "date",
  time: "time",
  ground: "ground",
  state: "state",
  city: "city",
  format: "format",
  attendance: "attendance",
  entryNotes: "entryNotes",
  ticketUrl: "ticketUrl",
  status: "status",
};

const FILLED_LABEL = { homeTeam: "home side", ground: "ground", city: "town" } as const;

/** The same fixture: the same local day and the same two sides, in either order. */
const fixtureKey = (date: string, home: string, away: string) =>
  `${date}|${teamPairKey(home, away)}`;

function unchanged(
  match: StoredMatch,
  input: OwnerMatchInput,
  startsAt: string,
  cityName: string,
  ticketUrls: Set<string>,
  compareStatus: boolean,
) {
  const ticket = input.ticketUrl ? (assertHttpsUrl(input.ticketUrl)?.toString() ?? "") : "";
  return (
    match.startsAt === startsAt &&
    match.homeName === input.homeTeam &&
    match.awayName === input.awayTeam &&
    match.venueName === input.ground &&
    match.cityName === cityName &&
    match.competitionName === (input.competition || "Friendly match") &&
    match.format === input.format &&
    match.attendanceType === input.attendance &&
    (match.entryNotes ?? "") === (input.entryNotes ?? "") &&
    (!ticket || ticketUrls.has(ticket)) &&
    (!compareStatus || match.status === input.status)
  );
}

/**
 * Reads a sheet of matches for an owner's profile and saves every row that is ready, each as if
 * posted from the match form. With `commit` false it does the same work and rolls it back, so
 * the preview shows exactly what saving would do.
 */
export async function runSchedule(
  pool: Pool,
  owner: Owner,
  input: { profile: string; rows: string[][]; date1904: boolean },
  now: Date,
  commit: boolean,
): Promise<ScheduleResult | { ok: false; errors: Record<string, string> }> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const profile = await ownedProfile(connection, owner, input.profile);
    if (profile.verificationStatus === "rejected") {
      throw new DomainError({
        form: "Your profile needs a change before you can post matches. Edit it first.",
      });
    }
    const plays = profile.kind === "academy" || profile.kind === "club";
    const sheet = readSchedule(input.rows, {
      now,
      date1904: input.date1904,
      defaults: {
        homeTeam: plays ? profile.name : null,
        ground: profile.address,
        city: profile.cityName,
        stateSlug: profile.stateSlug,
        india: profile.countrySlug === "india",
      },
    });
    if (!sheet.items.length) {
      throw new DomainError({
        form: "No matches found. Check the sheet has a row for each match, under a header row.",
      });
    }
    if (sheet.items.length > MAX_IMPORT_ROWS) {
      throw new DomainError({
        form: `That sheet has ${sheet.items.length} matches. Add up to ${MAX_IMPORT_ROWS} at a time: split it and add the rest after.`,
      });
    }

    const [listed] = await connection.query<MatchRow[]>(
      `SELECT * FROM matches WHERE academy_slug = ? AND ${LISTED_BY_PROFILE}`,
      [profile.slug],
    );
    const existing = listed.map((row) => toMatch(row, []));
    const [offers] = existing.length
      ? await connection.query<RowDataPacket[]>(
          "SELECT match_id, url FROM ticket_offers WHERE match_id IN (?)",
          [existing.map((match) => match.id)],
        )
      : [[] as RowDataPacket[]];
    const ticketUrls = new Map<string, Set<string>>();
    for (const offer of offers) {
      const urls = ticketUrls.get(String(offer.match_id)) ?? new Set<string>();
      urls.add(String(offer.url));
      ticketUrls.set(String(offer.match_id), urls);
    }
    const byFixture = new Map(
      existing.map((match) => [
        fixtureKey(localParts(match.startsAt, match.timezone).date, match.homeName, match.awayName),
        match,
      ]),
    );

    const seen = new Map<string, number>();
    const rows: ScheduleRowResult[] = [];
    let added = 0;
    let updated = 0;
    for (const item of sheet.items) {
      const result: ScheduleRowResult = {
        line: item.line,
        outcome: "error",
        when: null,
        homeTeam: item.values.homeTeam,
        awayTeam: item.values.awayTeam,
        ground: item.values.ground,
        city: item.values.city,
        competition: item.values.competition,
        format: item.values.format,
        attendance: item.values.attendance,
        problems: [...item.problems],
        filled: item.filled.map((field) => FILLED_LABEL[field]),
        slug: null,
      };
      rows.push(result);
      if (result.problems.length) continue;

      const parsed = ownerMatchSchema.safeParse({
        ...item.values,
        profile: profile.slug,
        match: "",
      });
      if (!parsed.success) {
        result.problems = parsed.error.issues.map((issue) => {
          const field = FIELD_OF_INPUT[issue.path[0] as keyof OwnerMatchInput];
          return field ? `${SCHEDULE_FIELD_LABEL[field]}: ${issue.message}` : issue.message;
        });
        continue;
      }
      const values = parsed.data;
      let place: ReturnType<typeof resolvePlace>;
      try {
        place = resolvePlace({
          country: profile.countrySlug,
          state: values.state || profile.stateSlug,
          city: values.city,
          timezone: profile.timezone,
        });
      } catch (error) {
        if (!(error instanceof DomainError)) throw error;
        result.problems = Object.values(error.errors);
        continue;
      }
      const startsAt = zonedTimeToUtc(`${values.date}T${values.time}`, place.timezone);
      result.when = formatInTimeZone(startsAt, place.timezone);
      result.city = place.cityName;

      const key = fixtureKey(values.date, values.homeTeam, values.awayTeam);
      const twin = seen.get(key);
      if (twin) {
        result.problems = [`The same match as row ${twin}.`];
        continue;
      }
      seen.set(key, item.line);

      const match = byFixture.get(key);
      if (match) {
        result.slug = match.slug;
        // Without a status column, a sheet does not undo a postponement made on the site.
        const kept = match.status;
        if (!sheet.hasStatus && (kept === "postponed" || kept === "cancelled")) {
          values.status = kept;
        }
        const urls = ticketUrls.get(match.id) ?? new Set<string>();
        if (unchanged(match, values, startsAt, place.cityName, urls, sheet.hasStatus)) {
          result.outcome = "same";
          continue;
        }
        values.match = match.slug;
      } else if (new Date(startsAt).getTime() <= now.getTime()) {
        result.outcome = "past";
        continue;
      }

      await connection.query("SAVEPOINT schedule_row");
      try {
        const saved = await saveMatchWithin(connection, owner, profile, values, now);
        result.outcome = match ? "update" : "add";
        result.slug = saved.slug;
        if (match) updated += 1;
        else added += 1;
      } catch (error) {
        await connection.query("ROLLBACK TO SAVEPOINT schedule_row");
        if (!(error instanceof DomainError)) throw error;
        result.problems = Object.entries(error.errors).map(([field, message]) => {
          const label = FIELD_OF_INPUT[field as keyof OwnerMatchInput];
          return label ? `${SCHEDULE_FIELD_LABEL[label]}: ${message}` : message;
        });
        if (!match) result.slug = null;
      }
    }

    if (commit && added + updated > 0) {
      await writeAudit(
        connection,
        {
          actorId: owner.userId,
          actorEmail: owner.email,
          action: "schedule.import",
          entityType: "academy",
          entityId: profile.id,
          before: null,
          after: { added, updated, rows: sheet.items.length },
        },
        now,
      );
    }
    if (commit) await connection.commit();
    else await connection.rollback();
    return { ok: true, committed: commit, columns: sheet.columns, rows };
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    if (error instanceof DomainError) return { ok: false, errors: error.errors };
    throw error;
  } finally {
    connection.release();
  }
}

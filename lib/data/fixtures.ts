import { z } from "zod";
import { slugify } from "@/lib/domain/slug";
import { zonedTimeToUtc } from "@/lib/domain/time";
import type { StoredMatch } from "@/lib/domain/types";

// A fixture file lists real matches with the official page each one comes from.
// Times are local to the ground, as boards publish them; the ground's time zone converts them.

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a lowercase slug.");

const timeZone = z.string().refine((zone) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}, "Unknown time zone.");

const fixtureSchema = z.object({
  key: slug,
  label: z.string().trim().min(1).max(40).optional(),
  format: z.enum(["test", "odi", "t20", "t10", "hundred", "other"]),
  status: z.enum(["published", "postponed", "cancelled"]).default("published"),
  home: slug,
  away: slug,
  venue: slug,
  start: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Use the ground's local time, YYYY-MM-DDTHH:MM."),
});

const seriesSchema = z.object({
  id: slug,
  competition: z.string().trim().min(2).max(120),
  competitionSlug: slug,
  kind: z.enum(["international", "league", "domestic"]),
  season: z.string().trim().min(1).max(40),
  seasonSlug: slug,
  source: z.object({
    url: z.url({ protocol: /^https$/ }),
    label: z.string().trim().min(2).max(80),
  }),
  attendance: z.enum(["ticketed", "free", "unknown"]),
  matches: z.array(fixtureSchema).min(1),
});

export const fixtureFileSchema = z.object({
  checkedAt: z.iso.datetime(),
  countries: z.record(slug, z.string().trim().min(2)),
  teams: z.record(
    slug,
    z.object({ name: z.string().trim().min(2), short: z.string().min(2).max(8) }),
  ),
  venues: z.record(
    slug,
    z.object({
      name: z.string().trim().min(2),
      city: z.string().trim().min(2),
      country: slug,
      timezone: timeZone,
    }),
  ),
  series: z.array(seriesSchema).min(1),
});

/** A match ready to store, without the id and slug the database assigns. */
export type FixtureMatch = Omit<StoredMatch, "id" | "slug" | "offers"> & {
  sourceExternalId: string;
  slugBase: string;
};

/** Validates a fixture file and builds its matches. Throws with every problem found. */
export function buildFixtureMatches(input: unknown): FixtureMatch[] {
  const file = fixtureFileSchema.parse(input);
  const problems: string[] = [];
  const matches: FixtureMatch[] = [];
  const keys = new Set<string>();
  const slugs = new Set<string>();

  for (const series of file.series) {
    for (const fixture of series.matches) {
      const where = `${series.id}/${fixture.key}`;
      const home = file.teams[fixture.home];
      const away = file.teams[fixture.away];
      const venue = file.venues[fixture.venue];
      const countryName = venue ? file.countries[venue.country] : undefined;
      if (!home) problems.push(`${where}: no team "${fixture.home}".`);
      if (!away) problems.push(`${where}: no team "${fixture.away}".`);
      if (fixture.home === fixture.away) problems.push(`${where}: a team cannot play itself.`);
      if (!venue) problems.push(`${where}: no ground "${fixture.venue}".`);
      else if (!countryName) problems.push(`${where}: no country "${venue.country}".`);
      const sourceExternalId = `fixtures:${series.id}:${fixture.key}`;
      if (keys.has(sourceExternalId)) problems.push(`${where}: the key is used twice.`);
      keys.add(sourceExternalId);
      if (!home || !away || !venue || !countryName) continue;

      const citySlug = slugify(venue.city);
      const label = series.kind === "international" ? fixture.label : undefined;
      const slugBase = slugify(
        [fixture.home, "vs", fixture.away, label, citySlug, fixture.start.slice(0, 10)]
          .filter(Boolean)
          .join(" "),
      );
      if (slugs.has(slugBase)) problems.push(`${where}: another fixture has the slug ${slugBase}.`);
      slugs.add(slugBase);

      matches.push({
        sourceExternalId,
        slugBase,
        competitionName: fixture.label
          ? `${series.competition}, ${fixture.label}`
          : series.competition,
        competitionSlug: series.competitionSlug,
        kind: series.kind,
        seasonName: series.season,
        seasonSlug: series.seasonSlug,
        homeName: home.name,
        homeShort: home.short,
        homeSlug: fixture.home,
        awayName: away.name,
        awayShort: away.short,
        awaySlug: fixture.away,
        venueName: venue.name,
        venueSlug: fixture.venue,
        venueAddress: `${venue.city}, ${countryName}`,
        cityName: venue.city,
        citySlug,
        countryName,
        countrySlug: venue.country,
        startsAt: zonedTimeToUtc(fixture.start, venue.timezone),
        endsAt: null,
        timezone: venue.timezone,
        format: fixture.format,
        status: fixture.status,
        attendanceType: series.attendance,
        sourceType: "admin",
        sourceUrl: series.source.url,
        sourceLabel: series.source.label,
        featuredRank: 0,
        lastVerifiedAt: file.checkedAt,
        publishedAt: null,
        entryNotes: null,
        demo: false,
        academySlug: null,
      });
    }
  }
  if (problems.length > 0) throw new Error(problems.join("\n"));
  return matches;
}

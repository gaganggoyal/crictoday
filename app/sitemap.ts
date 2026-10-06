import type { MetadataRoute } from "next";
import { currentTime } from "@/lib/clock";
import { POLICIES_UPDATED } from "@/lib/company";
import { getDirectory } from "@/lib/data/catalog";
import { INDIA_STATES, placeState } from "@/lib/data/india";
import { inDefaultWindow } from "@/lib/domain/filters";
import { profilePath } from "@/lib/domain/profiles";
import type { StoredMatch } from "@/lib/domain/types";
import { siteUrl } from "@/lib/utils";

/** The newest of some dates, or undefined: an unknown date is left out rather than guessed. */
function latest(dates: Array<string | null | undefined>) {
  const times = dates
    .filter((date): date is string => Boolean(date))
    .map((date) => new Date(date).getTime())
    .filter((time) => Number.isFinite(time));
  return times.length ? new Date(Math.max(...times)) : undefined;
}

/** When a match page last changed: the match itself, or one of its ticket links. */
function changed(match: StoredMatch) {
  return latest([match.updatedAt, ...match.offers.map((offer) => offer.updatedAt)]);
}

/**
 * Pages worth finding in search, each with the date its content last changed when we know it.
 * Places with nothing listed, forms and filtered views are left out; they are noindex too.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const directory = await getDirectory();
  const root = siteUrl();
  const now = currentTime();
  const { matches, academies } = directory;
  const upcoming = matches.filter((match) => inDefaultWindow(match, now));
  const entry = (path: string, lastModified?: Date) => ({
    url: `${root}${path || "/"}`,
    ...(lastModified ? { lastModified } : {}),
  });
  const newest = (list: StoredMatch[]) =>
    latest(list.map((match) => changed(match)?.toISOString()));
  const unique = <T>(items: T[], key: (item: T) => string) => [
    ...new Map(items.map((item) => [key(item), item])).values(),
  ];

  const policies = new Date(`${POLICIES_UPDATED}T00:00:00Z`);
  const pages = [
    entry(""),
    entry("/matches"),
    entry("/countries"),
    entry("/leagues"),
    entry("/academies"),
    entry("/get-listed"),
    entry("/about"),
    entry("/contact"),
    entry("/legal/terms", policies),
    entry("/legal/privacy", policies),
    entry("/legal/ticket-policy"),
    ...(matches.some((match) => match.demo) ? [entry("/about/demo-data")] : []),
  ];

  const countries = directory.countries
    .filter(
      (country) =>
        matches.some((match) => match.countrySlug === country.slug) ||
        academies.some((academy) => academy.countrySlug === country.slug),
    )
    .map((country) =>
      entry(
        `/country/${country.slug}`,
        newest(matches.filter((match) => match.countrySlug === country.slug)),
      ),
    );

  const states = INDIA_STATES.filter(
    (state) =>
      upcoming.some((match) => placeState(match)?.slug === state.slug) ||
      academies.some((academy) => placeState(academy)?.slug === state.slug),
  ).map((state) =>
    entry(
      `/country/india/state/${state.slug}`,
      newest(upcoming.filter((match) => placeState(match)?.slug === state.slug)),
    ),
  );

  // Towns with something coming up or a club listed; empty town pages are noindex.
  const towns = new Map<string, StoredMatch[]>();
  const town = (item: { countrySlug: string; citySlug: string }) => {
    const path = `/country/${item.countrySlug}/${item.citySlug}`;
    if (!towns.has(path)) towns.set(path, []);
    return towns.get(path)!;
  };
  for (const academy of academies) town(academy);
  for (const match of upcoming) town(match).push(match);
  const cities = [...towns].map(([path, list]) => entry(path, newest(list)));

  const leagues = directory.leagues.map((league) =>
    entry(
      `/league/${league.slug}`,
      newest(matches.filter((match) => match.competitionSlug === league.slug)),
    ),
  );

  const teams = unique(
    matches.flatMap((match) => [match.homeSlug, match.awaySlug]),
    (slug) => slug,
  ).map((slug) =>
    entry(
      `/teams/${slug}`,
      newest(matches.filter((match) => match.homeSlug === slug || match.awaySlug === slug)),
    ),
  );

  const venues = unique(
    matches.map((match) => match.venueSlug),
    (slug) => slug,
  ).map((slug) =>
    entry(`/venues/${slug}`, newest(matches.filter((match) => match.venueSlug === slug))),
  );

  return [
    ...pages,
    ...matches.map((match) => entry(`/match/${match.slug}`, changed(match))),
    ...countries,
    ...states,
    ...cities,
    ...leagues,
    ...teams,
    ...venues,
    ...academies.map((academy) =>
      entry(profilePath(academy), academy.updatedAt ? new Date(academy.updatedAt) : undefined),
    ),
  ];
}

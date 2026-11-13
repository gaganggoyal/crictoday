import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { MatchGrid, NothingListedYet } from "@/components/match/match-grid";
import { ListYoursCallout, ProfileGrid } from "@/components/profile/profile-card";
import { currentTime } from "@/lib/clock";
import { getDirectory } from "@/lib/data/catalog";
import { indiaCity, placeState } from "@/lib/data/india";
import { countries } from "@/lib/data/seed";
import { matchesToCome } from "@/lib/domain/filters";
import { formatShortDate } from "@/lib/domain/time";
import type { StoredMatch } from "@/lib/domain/types";
import { pageMetadata, upcomingSummary } from "@/lib/seo";

type Params = Promise<{ country: string; city: string }>;

type Ground = { slug: string; name: string; upcoming: StoredMatch[] };

/** Every ground in the city with a listed match, those with matches to come first. */
function groundsOf(all: StoredMatch[], upcoming: StoredMatch[]): Ground[] {
  const grounds = new Map<string, Ground>();
  for (const match of all) {
    if (!grounds.has(match.venueSlug)) {
      grounds.set(match.venueSlug, { slug: match.venueSlug, name: match.venueName, upcoming: [] });
    }
  }
  for (const match of upcoming) grounds.get(match.venueSlug)?.upcoming.push(match);
  return [...grounds.values()].sort(
    (a, b) => b.upcoming.length - a.upcoming.length || a.name.localeCompare(b.name),
  );
}

/** The country's other cities with matches to come, and how many each has. */
function otherCities(upcoming: StoredMatch[], citySlug: string) {
  const cities = new Map<string, { slug: string; name: string; count: number }>();
  for (const match of upcoming) {
    if (match.citySlug === citySlug) continue;
    const city = cities.get(match.citySlug) ?? {
      slug: match.citySlug,
      name: match.cityName,
      count: 0,
    };
    cities.set(match.citySlug, { ...city, count: city.count + 1 });
  }
  return [...cities.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * A city has a page when it is a listed Indian town or anything is listed there. Listed Indian
 * towns get one even when empty, so a club there has somewhere to start.
 */
async function loadCity(countrySlug: string, citySlug: string) {
  const country = countries.find((item) => item.slug === countrySlug);
  if (!country) return null;
  const directory = await getDirectory();
  const now = currentTime();
  const inCountry = directory.matches.filter((match) => match.countrySlug === countrySlug);
  const all = inCountry.filter((match) => match.citySlug === citySlug);
  const profiles = directory.academies.filter(
    (profile) => profile.countrySlug === countrySlug && profile.citySlug === citySlug,
  );
  const listed = countrySlug === "india" ? indiaCity(citySlug) : null;
  const name = listed?.name ?? all[0]?.cityName ?? profiles[0]?.cityName;
  if (!name) return null;
  const sample = all[0] ?? profiles[0];
  const state = placeState(sample ?? { countrySlug, citySlug, stateSlug: null });
  const matches = matchesToCome(all, now);
  return {
    country,
    name,
    state,
    all,
    matches,
    profiles,
    now,
    grounds: groundsOf(all, matches),
    cities: otherCities(matchesToCome(inCountry, now), citySlug),
  };
}

export async function generateMetadata({ params }: { params: Params }) {
  const { country, city } = await params;
  const place = await loadCity(country, city);
  if (!place) notFound();
  const where = place.state ? `${place.name}, ${place.state.name}` : place.name;
  const summary = upcomingSummary(place.all, place.now);
  // Clubs and academies are promised only where some are listed.
  const clubs = place.profiles.length > 0;
  return pageMetadata(
    place.matches.length > 0 && !clubs
      ? `Cricket in ${place.name}: matches, grounds and tickets`
      : `Cricket in ${place.name}: matches, clubs and academies`,
    summary
      ? clubs
        ? `${summary} in ${where}, with official ticket links, the grounds, and local clubs and academies.`
        : `${summary} in ${where}, with start times, the grounds and official ticket links.`
      : `Cricket clubs, academies, grounds and local matches in ${where}.`,
    `/country/${country}/${city}`,
    // Listed Indian towns have a page before anything is there; it stays out of search until then.
    place.matches.length > 0 || place.profiles.length > 0,
  );
}

export default async function CityPage({ params }: { params: Params }) {
  const { country, city } = await params;
  const place = await loadCity(country, city);
  if (!place) notFound();
  const { matches, profiles, state, grounds, cities } = place;
  const summary = upcomingSummary(place.all, place.now);
  return (
    <div className="mx-auto w-full max-w-[1120px] px-5 py-10">
      <Breadcrumbs
        crumbs={[
          { name: "Countries", path: "/countries" },
          { name: place.country.name, path: `/country/${place.country.slug}` },
          ...(state ? [{ name: state.name, path: `/country/india/state/${state.slug}` }] : []),
          { name: place.name, path: `/country/${place.country.slug}/${city}` },
        ]}
      />
      <h1 className="mt-3 font-display text-5xl font-extrabold tracking-tight">
        Cricket in {place.name}
      </h1>
      {summary ? <p className="mt-3 max-w-2xl font-medium">{summary}.</p> : null}
      <section aria-labelledby="matches" className="mt-8">
        <h2 id="matches" className="mb-4 font-display text-3xl font-extrabold">
          Upcoming matches
        </h2>
        {matches.length ? (
          <MatchGrid matches={matches} now={place.now} />
        ) : (
          <NothingListedYet title={`No upcoming matches listed in ${place.name} yet`} />
        )}
      </section>
      {grounds.length ? (
        <section aria-labelledby="grounds" className="mt-12">
          <h2 id="grounds" className="mb-4 font-display text-3xl font-extrabold">
            Grounds in {place.name}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {grounds.map((ground) => (
              <li key={ground.slug}>
                <GroundLink ground={ground} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section aria-labelledby="clubs" className="mt-12">
        <h2 id="clubs" className="mb-4 font-display text-3xl font-extrabold">
          {profiles.length ? "Clubs, academies and grounds" : "Clubs and academies"}
        </h2>
        {profiles.length ? <ProfileGrid profiles={profiles} /> : null}
        <div className={profiles.length ? "mt-6" : ""}>
          <ListYoursCallout place={place.name} />
        </div>
      </section>
      {cities.length ? (
        <section aria-labelledby="more" className="mt-12">
          <h2 id="more" className="mb-4 font-display text-3xl font-extrabold">
            More cricket in {place.country.name}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {cities.map((other) => (
              <li key={other.slug}>
                <Link
                  href={`/country/${place.country.slug}/${other.slug}`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm no-underline hover:border-link"
                >
                  {other.name}
                  <span className="text-muted">
                    {other.count} {other.count === 1 ? "match" : "matches"}
                  </span>
                </Link>
              </li>
            ))}
            <li>
              <Link
                href={`/country/${place.country.slug}`}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-link"
              >
                All of {place.country.name}
                <ArrowRight aria-hidden="true" size={16} />
              </Link>
            </li>
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/** A ground, how many matches it has to come and when the next one is. */
function GroundLink({ ground }: { ground: Ground }) {
  const count = ground.upcoming.length;
  const next = ground.upcoming.find((match) => match.status !== "postponed");
  return (
    <Link
      href={`/venues/${ground.slug}`}
      className="group flex h-full items-center justify-between gap-3 rounded-[1.25rem] border border-line bg-surface p-4 no-underline hover:border-link"
    >
      <span className="min-w-0">
        <span className="block font-semibold group-hover:text-link">{ground.name}</span>
        <span className="mt-0.5 block text-sm text-muted">
          {count === 0
            ? "No matches to come"
            : `${count} ${count === 1 ? "match" : "matches"} to come${
                next ? `, the next on ${formatShortDate(next.startsAt, next.timezone)}` : ""
              }`}
        </span>
      </span>
      <ArrowRight
        aria-hidden="true"
        size={18}
        className="shrink-0 text-link transition group-hover:translate-x-0.5"
      />
    </Link>
  );
}

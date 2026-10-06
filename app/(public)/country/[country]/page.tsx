import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { MatchGrid, NothingListedYet } from "@/components/match/match-grid";
import { ListYoursCallout, ProfileGrid } from "@/components/profile/profile-card";
import { getDirectory } from "@/lib/data/catalog";
import { INDIA_STATES, POPULAR_CITIES, placeState } from "@/lib/data/india";
import { countries } from "@/lib/data/seed";
import { inDefaultWindow } from "@/lib/domain/filters";
import { formatDateHeading, formatDateKey } from "@/lib/domain/time";
import type { StoredAcademy, StoredMatch } from "@/lib/domain/types";
import { pageMetadata, upcomingSummary } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ country: string }> }) {
  const { country: slug } = await params;
  const country = countries.find((item) => item.slug === slug);
  if (!country) notFound();
  const directory = await getDirectory();
  const matches = directory.matches.filter((match) => match.countrySlug === slug);
  const listed = matches.length > 0 || directory.academies.some((a) => a.countrySlug === slug);
  const summary = upcomingSummary(matches, new Date());
  return pageMetadata(
    `Cricket matches in ${country.name}: fixtures and tickets`,
    summary
      ? `${summary}. Start times, grounds and official ticket links for cricket in ${country.name}.`
      : country.blurb,
    `/country/${country.slug}`,
    // A country with nothing listed is a thin page, so it stays out of search until it has some.
    listed,
  );
}

export default async function CountryPage({ params }: { params: Promise<{ country: string }> }) {
  const { country: slug } = await params;
  const country = countries.find((item) => item.slug === slug);
  if (!country) notFound();
  const directory = await getDirectory();
  const now = new Date();
  const matches = directory.matches
    .filter((match) => match.countrySlug === slug)
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  const cities = [...new Map(matches.map((match) => [match.citySlug, match])).values()];
  const groups = new Map<string, typeof matches>();
  for (const match of matches) {
    const key = formatDateKey(match.startsAt, country.timezone);
    groups.set(key, [...(groups.get(key) ?? []), match]);
  }
  const academies = directory.academies.filter((academy) => academy.countrySlug === slug);
  const upcoming = matches.filter((match) => inDefaultWindow(match, now));
  const summary = upcomingSummary(matches, now);

  return (
    <div className="mx-auto w-full max-w-[1120px] px-5 py-10">
      <Breadcrumbs
        crumbs={[
          { name: "Countries", path: "/countries" },
          { name: country.name, path: `/country/${country.slug}` },
        ]}
      />
      <p className="mt-4 text-xs font-semibold tracking-[0.16em] text-link uppercase">
        {country.iso2}
      </p>
      <h1 className="font-display text-5xl font-extrabold tracking-tight">
        Cricket in {country.name}
      </h1>
      <p className="mt-3 max-w-2xl text-muted">{country.blurb}</p>
      {summary ? <p className="mt-3 max-w-2xl font-medium">{summary}.</p> : null}
      <p className="mt-3 max-w-2xl text-sm">{country.ticketGuidance}</p>
      {slug === "india" ? (
        <IndiaPlaces matches={upcoming} academies={academies} />
      ) : (
        <div className="mt-6 flex flex-wrap gap-2">
          {cities.map((city) => (
            <Link
              key={city.citySlug}
              href={`/country/${slug}/${city.citySlug}`}
              className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm"
            >
              {city.cityName}
            </Link>
          ))}
        </div>
      )}
      <div className="mt-10 grid gap-10">
        {matches.length === 0 ? (
          <NothingListedYet title={`No listed matches in ${country.name} yet`} />
        ) : null}
        {[...groups.entries()].map(([day, dayMatches]) => (
          <section key={day}>
            <h2 className="mb-4 font-display text-2xl font-extrabold">
              {formatDateHeading(dayMatches[0]!.startsAt, country.timezone)}
            </h2>
            <MatchGrid matches={dayMatches} now={now} />
          </section>
        ))}
      </div>
      <section className="mt-12">
        <h2 className="mb-4 font-display text-3xl font-extrabold">Clubs, academies and grounds</h2>
        {academies.length ? <ProfileGrid profiles={academies} /> : null}
        <div className={academies.length ? "mt-6" : ""}>
          <ListYoursCallout place={country.name} />
        </div>
      </section>
    </div>
  );
}

/** India's states and popular cities, each with how much is listed there. */
function IndiaPlaces({
  matches,
  academies,
}: {
  matches: StoredMatch[];
  academies: StoredAcademy[];
}) {
  const counts = new Map<string, number>();
  for (const item of [...matches, ...academies]) {
    const state = placeState(item);
    if (state) counts.set(state.slug, (counts.get(state.slug) ?? 0) + 1);
  }
  return (
    <>
      <section aria-labelledby="popular" className="mt-8">
        <h2 id="popular" className="font-display text-2xl font-extrabold">
          Popular cities
        </h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {POPULAR_CITIES.map((city) => (
            <li key={city.slug}>
              <Link
                href={`/country/india/${city.slug}`}
                className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-4 text-sm"
              >
                {city.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="states" className="mt-10">
        <h2 id="states" className="font-display text-2xl font-extrabold">
          States and union territories
        </h2>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {INDIA_STATES.map((state) => (
            <li key={state.slug}>
              <Link
                href={`/country/india/state/${state.slug}`}
                className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 text-sm no-underline"
              >
                <span className="font-medium">{state.name}</span>
                <span className="text-xs text-muted">
                  {counts.get(state.slug)
                    ? `${counts.get(state.slug)} listed`
                    : `${state.cities.length} cities`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

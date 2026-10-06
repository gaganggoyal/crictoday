import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyResults, MatchGrid } from "@/components/match/match-grid";
import { ListYoursCallout, ProfileGrid } from "@/components/profile/profile-card";
import { getDirectory } from "@/lib/data/catalog";
import { indiaState, placeState } from "@/lib/data/india";
import { inDefaultWindow } from "@/lib/domain/filters";
import { pageMetadata } from "@/lib/seo";

type Params = Promise<{ country: string; state: string }>;

function findState(country: string, slug: string) {
  return country === "india" ? indiaState(slug) : null;
}

export async function generateMetadata({ params }: { params: Params }) {
  const { country, state: slug } = await params;
  const state = findState(country, slug);
  if (!state) notFound();
  return pageMetadata(
    `Cricket in ${state.name}: matches, clubs and academies`,
    `Upcoming matches, local clubs, academies and grounds in ${state.name}, city by city.`,
    `/country/india/state/${state.slug}`,
  );
}

export default async function StatePage({ params }: { params: Params }) {
  const { country, state: slug } = await params;
  const state = findState(country, slug);
  if (!state) notFound();
  const directory = await getDirectory();
  const now = new Date();
  const matches = directory.matches
    .filter((match) => placeState(match)?.slug === state.slug && inDefaultWindow(match, now))
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  const profiles = directory.academies.filter(
    (profile) => placeState(profile)?.slug === state.slug,
  );

  // Listed towns first, then any other town that has a match or a club in this state.
  const cities = new Map(
    state.cities.map((city) => [city.slug, { ...city, matches: 0, profiles: 0 }]),
  );
  const town = (slug: string, name: string) => {
    if (!cities.has(slug)) cities.set(slug, { slug, name, matches: 0, profiles: 0 });
    return cities.get(slug)!;
  };
  for (const match of matches) town(match.citySlug, match.cityName).matches += 1;
  for (const profile of profiles) town(profile.citySlug, profile.cityName).profiles += 1;

  return (
    <div className="mx-auto w-full max-w-[1120px] px-5 py-10">
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <ol className="flex flex-wrap gap-2">
          <li>
            <Link href="/countries">Countries</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/country/india">India</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page">{state.name}</li>
        </ol>
      </nav>
      <h1 className="mt-3 font-display text-5xl font-extrabold tracking-tight">
        Cricket in {state.name}
      </h1>
      <p className="mt-3 max-w-2xl text-muted">
        {matches.length} upcoming {matches.length === 1 ? "match" : "matches"} and {profiles.length}{" "}
        {profiles.length === 1 ? "club or academy" : "clubs and academies"} listed across{" "}
        {state.name}.
      </p>

      <section aria-labelledby="cities" className="mt-8">
        <h2 id="cities" className="font-display text-2xl font-extrabold">
          Cities
        </h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {[...cities.values()].map((city) => (
            <li key={city.slug}>
              <Link
                href={`/country/india/${city.slug}`}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm"
              >
                {city.name}
                {city.matches + city.profiles > 0 ? (
                  <span className="rounded-full bg-background px-2 text-xs text-muted">
                    {city.matches + city.profiles}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="matches" className="mt-12">
        <h2 id="matches" className="mb-4 font-display text-3xl font-extrabold">
          Upcoming matches
        </h2>
        {matches.length ? (
          <MatchGrid matches={matches} now={now} />
        ) : (
          <EmptyResults title={`No upcoming matches listed in ${state.name} yet`} />
        )}
      </section>

      <section aria-labelledby="clubs" className="mt-12">
        <h2 id="clubs" className="mb-4 font-display text-3xl font-extrabold">
          Clubs, academies and grounds
        </h2>
        {profiles.length ? <ProfileGrid profiles={profiles} /> : null}
        <div className={profiles.length ? "mt-6" : ""}>
          <ListYoursCallout place={state.name} />
        </div>
      </section>
    </div>
  );
}

import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { MatchGrid, NothingListedYet } from "@/components/match/match-grid";
import { ListYoursCallout, ProfileGrid } from "@/components/profile/profile-card";
import { getDirectory } from "@/lib/data/catalog";
import { indiaCity, placeState } from "@/lib/data/india";
import { countries } from "@/lib/data/seed";
import { inDefaultWindow } from "@/lib/domain/filters";
import { pageMetadata, upcomingSummary } from "@/lib/seo";

type Params = Promise<{ country: string; city: string }>;

/**
 * A city has a page when it is a listed Indian town or anything is listed there. Listed Indian
 * towns get one even when empty, so a club there has somewhere to start.
 */
async function loadCity(countrySlug: string, citySlug: string) {
  const country = countries.find((item) => item.slug === countrySlug);
  if (!country) return null;
  const directory = await getDirectory();
  const now = new Date();
  const all = directory.matches.filter(
    (match) => match.countrySlug === countrySlug && match.citySlug === citySlug,
  );
  const profiles = directory.academies.filter(
    (profile) => profile.countrySlug === countrySlug && profile.citySlug === citySlug,
  );
  const listed = countrySlug === "india" ? indiaCity(citySlug) : null;
  const name = listed?.name ?? all[0]?.cityName ?? profiles[0]?.cityName;
  if (!name) return null;
  const sample = all[0] ?? profiles[0];
  const state = placeState(sample ?? { countrySlug, citySlug, stateSlug: null });
  const matches = all
    .filter((match) => inDefaultWindow(match, now))
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  return { country, name, state, all, matches, profiles, now };
}

export async function generateMetadata({ params }: { params: Params }) {
  const { country, city } = await params;
  const place = await loadCity(country, city);
  if (!place) notFound();
  const where = place.state ? `${place.name}, ${place.state.name}` : place.name;
  const summary = upcomingSummary(place.all, place.now);
  return pageMetadata(
    `Cricket in ${place.name}: matches, clubs and academies`,
    summary
      ? `${summary} in ${where}, with ticket links and local clubs, academies and grounds.`
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
  const { matches, profiles, state } = place;
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
      <section aria-labelledby="clubs" className="mt-12">
        <h2 id="clubs" className="mb-4 font-display text-3xl font-extrabold">
          Clubs, academies and grounds
        </h2>
        {profiles.length ? <ProfileGrid profiles={profiles} /> : null}
        <div className={profiles.length ? "mt-6" : ""}>
          <ListYoursCallout place={place.name} />
        </div>
      </section>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyResults, MatchGrid } from "@/components/match/match-grid";
import { getDirectory } from "@/lib/data/catalog";
import { countries } from "@/lib/data/seed";
import { formatDateHeading, formatDateKey } from "@/lib/domain/time";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ country: string }> }) {
  const { country: slug } = await params;
  const country = countries.find((item) => item.slug === slug);
  if (!country) notFound();
  return pageMetadata(
    `Cricket matches in ${country.name}`,
    country.blurb,
    `/country/${country.slug}`,
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

  return (
    <div className="mx-auto w-full max-w-[1120px] px-5 py-10">
      <p className="text-xs font-semibold tracking-[0.16em] text-link uppercase">{country.iso2}</p>
      <h1 className="font-display text-5xl font-extrabold tracking-tight">
        Cricket in {country.name}
      </h1>
      <p className="mt-3 max-w-2xl text-muted">{country.blurb}</p>
      <p className="mt-3 max-w-2xl text-sm">{country.ticketGuidance}</p>
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
      <div className="mt-10 grid gap-10">
        {matches.length === 0 ? (
          <EmptyResults title={`No listed matches in ${country.name}`} />
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
      {academies.length ? (
        <section className="mt-12">
          <h2 className="font-display text-3xl font-extrabold">Academies</h2>
          <ul className="mt-4 grid gap-3">
            {academies.map((academy) => (
              <li key={academy.slug}>
                <Link href={`/academy/${academy.slug}`}>{academy.name}</Link>
                <span className="text-muted"> · {academy.cityName}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

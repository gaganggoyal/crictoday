import Link from "next/link";
import { filterHref, MatchFiltersForm } from "@/components/match/filters";
import { EmptyResults, MatchGrid } from "@/components/match/match-grid";
import { getDirectory } from "@/lib/data/catalog";
import { filterMatches, parseFilters } from "@/lib/domain/filters";
import { pageMetadata } from "@/lib/seo";
import { firstParam } from "@/lib/utils";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const filters = parseFilters({
    q: firstParam(raw.q),
    country: firstParam(raw.country),
    city: firstParam(raw.city),
    from: firstParam(raw.from),
    to: firstParam(raw.to),
    kind: firstParam(raw.kind),
    format: firstParam(raw.format),
    tickets: firstParam(raw.tickets),
    sort: firstParam(raw.sort),
    page: firstParam(raw.page),
  });
  const directory = await getDirectory();
  const result = filterMatches(directory.matches, filters, new Date());
  const title = filters.country
    ? `Cricket matches in ${filters.country}`
    : "Upcoming cricket matches";
  return pageMetadata(
    title,
    "Search upcoming cricket by country, city, format and ticket state.",
    `/matches${filterHref(filters).replace("/matches", "")}`,
    result.total > 0,
  );
}

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const filters = parseFilters({
    q: firstParam(raw.q),
    country: firstParam(raw.country),
    city: firstParam(raw.city),
    from: firstParam(raw.from),
    to: firstParam(raw.to),
    kind: firstParam(raw.kind),
    format: firstParam(raw.format),
    tickets: firstParam(raw.tickets),
    sort: firstParam(raw.sort),
    page: firstParam(raw.page),
  });
  const directory = await getDirectory();
  const now = new Date();
  const result = filterMatches(directory.matches, filters, now);
  const cities = uniqueCities(directory.matches);

  return (
    <div className="mx-auto grid w-full max-w-[1120px] gap-8 px-5 py-10 lg:grid-cols-[280px_minmax(0,1fr)]">
      <MatchFiltersForm filters={filters} countries={directory.countries} cities={cities} />
      <section>
        <p className="text-xs font-semibold tracking-[0.16em] text-link uppercase">Directory</p>
        <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
          Upcoming matches
        </h1>
        <p className="mt-2 text-muted">
          {result.total} {result.total === 1 ? "match" : "matches"} · page {result.page} of{" "}
          {result.pageCount}
        </p>
        <div className="mt-6">
          {result.total ? <MatchGrid matches={result.items} now={now} /> : <EmptyResults />}
        </div>
        <nav aria-label="Pagination" className="mt-8 flex items-center gap-3">
          {result.page > 1 ? (
            <Link
              className="inline-flex min-h-11 items-center rounded-full border border-line px-4"
              href={filterHref(filters, { page: result.page - 1 })}
            >
              Previous
            </Link>
          ) : null}
          {result.page < result.pageCount ? (
            <Link
              className="inline-flex min-h-11 items-center rounded-full border border-line px-4"
              href={filterHref(filters, { page: result.page + 1 })}
            >
              Next
            </Link>
          ) : null}
        </nav>
      </section>
    </div>
  );
}

function uniqueCities(matches: Array<{ citySlug: string; cityName: string; countrySlug: string }>) {
  const map = new Map<string, { slug: string; name: string; countrySlug: string }>();
  for (const match of matches)
    map.set(match.citySlug, {
      slug: match.citySlug,
      name: match.cityName,
      countrySlug: match.countrySlug,
    });
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

import Link from "next/link";
import { filterHref, MatchFiltersForm } from "@/components/match/filters";
import { EmptyResults, MatchGrid } from "@/components/match/match-grid";
import { currentTime } from "@/lib/clock";
import { getDirectory } from "@/lib/data/catalog";
import {
  filterMatches,
  isFiltered,
  parseFilters,
  type MatchFilters,
  type MatchWhen,
} from "@/lib/domain/filters";
import { pageMetadata } from "@/lib/seo";
import { firstParam } from "@/lib/utils";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function readFilters(searchParams: SearchParams) {
  const raw = await searchParams;
  return parseFilters({
    q: firstParam(raw.q),
    country: firstParam(raw.country),
    city: firstParam(raw.city),
    from: firstParam(raw.from),
    to: firstParam(raw.to),
    kind: firstParam(raw.kind),
    format: firstParam(raw.format),
    tickets: firstParam(raw.tickets),
    when: firstParam(raw.when),
    sort: firstParam(raw.sort),
    page: firstParam(raw.page),
  });
}

const WHEN_HEADING: Record<MatchWhen, string> = {
  today: "Cricket matches today",
  tomorrow: "Cricket matches tomorrow",
  weekend: "Cricket matches this weekend",
};

// The ticket views linked from the home page and the menus.
const TICKET_HEADING: Record<string, string> = {
  official: "Matches with official ticket sources",
  free: "Free entry matches",
  alert: "Matches waiting for an official ticket link",
};

function headingFor(filters: MatchFilters, plain: string) {
  if (filters.when) return WHEN_HEADING[filters.when];
  return (filters.tickets && TICKET_HEADING[filters.tickets]) || plain;
}

const SHORTCUTS: [MatchWhen | undefined, string][] = [
  [undefined, "All upcoming"],
  ["today", "Today"],
  ["tomorrow", "Tomorrow"],
  ["weekend", "This weekend"],
];

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }) {
  const filters = await readFilters(searchParams);
  const heading = headingFor(filters, "Upcoming cricket matches");
  return pageMetadata(
    filters.page > 1 ? `${heading}, page ${filters.page}` : heading,
    "Every upcoming cricket match we list, from internationals and top leagues to local clubs: grounds, local start times and official ticket links.",
    `/matches${filterHref(filters).replace("/matches", "")}`,
    // Filtered and searched views repeat the directory and the place pages, so only the plain
    // list and its pages are indexed.
    !isFiltered(filters),
  );
}

export default async function MatchesPage({ searchParams }: { searchParams: SearchParams }) {
  const filters = await readFilters(searchParams);
  const directory = await getDirectory();
  const now = currentTime();
  const result = filterMatches(directory.matches, filters, now);
  const cities = uniqueCities(directory.matches);

  return (
    <div className="mx-auto grid w-full max-w-[1120px] gap-x-8 gap-y-6 px-5 py-10 lg:grid-cols-[280px_minmax(0,1fr)] lg:grid-rows-[auto_1fr]">
      {/* On a phone: heading, folded filters, results. On a wide screen the filters are a sidebar. */}
      <header className="lg:col-start-2 lg:row-start-1">
        <p className="text-xs font-semibold tracking-[0.16em] text-link uppercase">Directory</p>
        <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
          {headingFor(filters, "Upcoming matches")}
        </h1>
        {filters.tickets === "official" && !filters.when ? (
          <p className="mt-3 max-w-2xl text-muted">
            Each link was checked against the organiser&apos;s, league&apos;s, board&apos;s or
            ground&apos;s own page. Confirm the match and the seller&apos;s terms before you pay.{" "}
            <Link
              href="/how-we-check-ticket-links"
              className="text-link underline underline-offset-2"
            >
              How we check
            </Link>
          </p>
        ) : null}
        <p className="mt-2 text-muted">
          {result.total} {result.total === 1 ? "match" : "matches"} · page {result.page} of{" "}
          {result.pageCount}
        </p>
      </header>
      <div className="lg:col-start-1 lg:row-span-2 lg:row-start-1">
        <MatchFiltersForm filters={filters} countries={directory.countries} cities={cities} />
      </div>
      <section aria-label="Results" className="lg:col-start-2 lg:row-start-2">
        <WhenShortcuts filters={filters} />
        <div>
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

/** Today, tomorrow and this weekend, keeping the other filters. */
function WhenShortcuts({ filters }: { filters: MatchFilters }) {
  return (
    <nav aria-label="When" className="mb-5 flex flex-wrap gap-2">
      {SHORTCUTS.map(([when, label]) => {
        const active = filters.when === when;
        return (
          <Link
            key={label}
            href={filterHref(filters, { when, page: 1 })}
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium ${
              active
                ? "border-[#176B43] bg-[#176B43] text-white"
                : "border-line bg-surface hover:border-[#176B43]"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
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

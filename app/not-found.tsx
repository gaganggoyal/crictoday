import Link from "next/link";
import { SearchForm } from "@/components/match/search-form";
import { POPULAR_CITIES } from "@/lib/data/india";
import { leagues } from "@/lib/data/seed";

const chip =
  "inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-4 text-sm";

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-16">
      <p className="text-xs font-semibold tracking-[0.16em] text-link uppercase">Page not found</p>
      <h1 className="mt-2 font-display text-5xl font-extrabold">That page is not on the card.</h1>
      <p className="mt-3 text-muted">
        The match may have been taken down, or the address may be wrong. Search for it, or start
        from one of these.
      </p>
      <div className="mt-6">
        <SearchForm compact />
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/matches"
          className="inline-flex min-h-11 items-center rounded-full bg-[#176B43] px-5 font-medium text-white"
        >
          All upcoming matches
        </Link>
        <Link
          href="/matches?when=today"
          className="inline-flex min-h-11 items-center rounded-full border border-line px-5 font-medium"
        >
          Matches today
        </Link>
      </div>
      <section aria-labelledby="cities" className="mt-10">
        <h2 id="cities" className="font-display text-2xl font-extrabold">
          Popular cities
        </h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {POPULAR_CITIES.map((city) => (
            <li key={city.slug}>
              <Link href={`/country/india/${city.slug}`} className={chip}>
                {city.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="leagues" className="mt-8">
        <h2 id="leagues" className="font-display text-2xl font-extrabold">
          Leagues
        </h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {leagues.map((league) => (
            <li key={league.slug}>
              <Link href={`/league/${league.slug}`} className={chip}>
                {league.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

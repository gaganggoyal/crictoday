import Image from "next/image";
import Link from "next/link";
import { EmptyResults, MatchGrid } from "@/components/match/match-grid";
import { SearchForm } from "@/components/match/search-form";
import { getDirectory } from "@/lib/data/catalog";
import { filterMatches, pickHero } from "@/lib/domain/filters";
import { resolveAttendance } from "@/lib/domain/ticket-state";
import { formatInTimeZone } from "@/lib/domain/time";

export default async function HomePage() {
  const directory = await getDirectory();
  const now = new Date();
  const upcoming = filterMatches(directory.matches, { sort: "featured", page: 1 }, now).items;
  const hero = pickHero(directory.matches, now);
  const withTickets = directory.matches.filter((match) => {
    const state = resolveAttendance(match, match.offers);
    return state === "OFFICIAL_LINK" || state === "AUTHORISED_PARTNER";
  }).slice(0, 3);
  const ticker = [...directory.matches]
    .filter((match) => new Date(match.startsAt).getTime() > now.getTime() - 6 * 60 * 60 * 1000)
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))
    .slice(0, 8);

  return (
    <>
      <section className="relative isolate min-h-[92svh] overflow-hidden">
        <Image
          src="/images/hero.jpg"
          alt="A batter playing a shot in a crowded cricket stadium"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#101612] via-[#101612]/75 to-[#101612]/25" />
        <div className="relative mx-auto flex min-h-[92svh] w-full max-w-[1120px] flex-col justify-end px-5 pt-20 pb-12 text-[#F3F5EF]">
          <p className="text-xs font-semibold tracking-[0.18em] text-[#F3F5EF]/80 uppercase">Attendance, not just scores</p>
          <h1 className="mt-3 max-w-3xl font-display text-5xl leading-[0.95] font-extrabold tracking-tight sm:text-7xl">
            Find the match. Feel the ground.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-[#F3F5EF]/85">
            Upcoming cricket you can actually attend, from international stadiums to verified academy grounds, and the safest ticket route we have checked.
          </p>
          <div className="mt-8 max-w-3xl text-[#162018]">
            <SearchForm />
          </div>
          {hero ? (
            <Link href={`/match/${hero.slug}`} className="mt-6 grid max-w-3xl gap-1 rounded-[1.25rem] bg-[#FFFEFB] p-4 text-[#162018] no-underline sm:grid-cols-[auto_1fr] sm:items-center">
              <span className="text-xs font-semibold tracking-[0.16em] text-[#176B43] uppercase">Featured</span>
              <span className="font-display text-2xl font-extrabold sm:col-start-1 sm:text-3xl">
                {hero.homeName} vs {hero.awayName}
              </span>
              <span className="text-sm text-[#3E4A42] sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:self-center sm:text-right">
                {formatInTimeZone(hero.startsAt, hero.timezone)}
                <span className="mt-1 block">{hero.venueName}</span>
              </span>
            </Link>
          ) : null}
        </div>
      </section>

      {ticker.length > 0 ? (
        <div className="ticker overflow-hidden border-b border-line bg-surface">
          <div className="ticker-track flex w-max gap-8 py-3">
            {[...ticker, ...ticker].map((match, index) => (
              <Link key={`${match.slug}-${index}`} href={`/match/${match.slug}`} className="text-sm whitespace-nowrap text-muted">
                <span className="font-medium text-foreground">
                  {match.homeShort} vs {match.awayShort}
                </span>{" "}
                · {match.cityName}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <section className="mx-auto w-full max-w-[1120px] px-5 py-16">
        <SectionHeading eyebrow="On the card" title="Upcoming matches" href="/matches" />
        {upcoming.length ? <MatchGrid matches={upcoming.slice(0, 6)} now={now} /> : <EmptyResults />}
      </section>

      {withTickets.length ? (
        <section className="mx-auto w-full max-w-[1120px] px-5 pb-16">
          <SectionHeading eyebrow="Reviewed links" title="Tickets available" href="/matches?tickets=official" />
          <MatchGrid matches={withTickets} now={now} />
        </section>
      ) : null}

      <section className="mx-auto w-full max-w-[1120px] px-5 pb-16">
        <SectionHeading eyebrow="Launch markets" title="Browse by country" href="/countries" />
        <div className="grid gap-4 md:grid-cols-3">
          {directory.countries.filter((country) => country.launch).map((country) => {
            const count = directory.matches.filter((match) => match.countrySlug === country.slug).length;
            return (
              <Link key={country.slug} href={`/country/${country.slug}`} className="rounded-[1.25rem] border border-line bg-surface p-5 no-underline">
                <p className="text-xs font-semibold tracking-[0.16em] text-muted uppercase">{country.iso2}</p>
                <h3 className="mt-2 font-display text-3xl font-extrabold">{country.name}</h3>
                <p className="mt-2 text-sm text-muted">{count} listed matches</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1120px] px-5 pb-16">
        <SectionHeading eyebrow="Season hubs" title="Top leagues" href="/leagues" />
        <div className="grid gap-4 md:grid-cols-5">
          {directory.leagues.map((league) => (
            <Link key={league.slug} href={`/league/${league.slug}`} className="rounded-[1.25rem] border border-line bg-surface p-4 no-underline">
              <h3 className="font-display text-xl font-extrabold">{league.name}</h3>
              <p className="mt-2 text-sm text-muted">{league.seasonName}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-[1120px] gap-4 px-5 pb-16 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <SectionHeading eyebrow="Grassroots" title="Academies with a checked contact" href="/academies" />
          <div className="grid gap-3">
            {directory.academies.slice(0, 3).map((academy) => (
              <Link key={academy.slug} href={`/academy/${academy.slug}`} className="rounded-2xl border border-line bg-surface p-4 no-underline">
                <p className="font-medium">{academy.name}</p>
                <p className="text-sm text-muted">
                  {academy.cityName} · {academy.verificationLabel}
                </p>
              </Link>
            ))}
          </div>
        </div>
        <div className="rounded-[1.25rem] bg-[#176B43] p-6 text-white">
          <p className="text-xs font-semibold tracking-[0.16em] uppercase text-white/75">Organisers</p>
          <h2 className="mt-2 font-display text-4xl font-extrabold">List a match people can find.</h2>
          <p className="mt-3 text-white/85">
            Boards, clubs and academies can submit a fixture. It stays pending until the source and any ticket domain are reviewed.
          </p>
          <Link href="/submit/match" className="mt-6 inline-flex min-h-11 items-center rounded-full bg-white px-5 font-medium text-[#176B43]">
            Start a submission
          </Link>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-[1120px] gap-4 px-5 pb-8 md:grid-cols-3">
        {[
          ["Source on every match", "A published fixture names where the details came from."],
          ["Seller domain first", "You see the destination before an approved link opens."],
          ["No resale market", "Fans are not asked to buy from other fans."],
        ].map(([title, body]) => (
          <div key={title} className="rounded-2xl border border-line p-4">
            <h2 className="font-display text-xl font-bold">{title}</h2>
            <p className="mt-2 text-sm text-muted">{body}</p>
          </div>
        ))}
      </section>
    </>
  );
}

function SectionHeading({ eyebrow, title, href }: { eyebrow: string; title: string; href: string }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <p className="text-xs font-semibold tracking-[0.16em] text-link uppercase">{eyebrow}</p>
        <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h2>
      </div>
      <Link href={href} className="inline-flex min-h-11 items-center text-sm font-medium text-link">
        View all
      </Link>
    </div>
  );
}

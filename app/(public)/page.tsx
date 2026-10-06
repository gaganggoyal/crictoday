import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BellRing, Clock, ShieldCheck, Ticket } from "lucide-react";
import { EmptyResults, MatchGrid } from "@/components/match/match-grid";
import { SearchForm } from "@/components/match/search-form";
import { JsonLd } from "@/components/seo/json-ld";
import { getDirectory } from "@/lib/data/catalog";
import { filterMatches, pickHero } from "@/lib/domain/filters";
import { profilePath } from "@/lib/domain/profiles";
import { resolveAttendance } from "@/lib/domain/ticket-state";
import { formatInTimeZone } from "@/lib/domain/time";
import { homeJsonLd, pageMetadata, upcomingMatches } from "@/lib/seo";
import hero from "@/public/images/hero.jpg";

const home = pageMetadata(
  "Cricket matches today, fixtures and tickets",
  "Find cricket matches today and upcoming fixtures by country, city and league, with grounds, local start times and official ticket links checked by a person.",
  "/",
);

export const metadata: Metadata = {
  ...home,
  title: { absolute: "Cricket matches today, fixtures and tickets · cricketmatch.today" },
};

const QUICK_LINKS = [
  ["/matches?when=today", "Today"],
  ["/matches?when=tomorrow", "Tomorrow"],
  ["/matches?when=weekend", "This weekend"],
  ["/matches?tickets=official", "Tickets on sale"],
];

const HOW = [
  {
    icon: ShieldCheck,
    title: "Checked at the source",
    body: "Every match links to the board's or organiser's own page, and shows when we last checked it. Listings older than a week are marked.",
  },
  {
    icon: Clock,
    title: "Your time, and the ground's",
    body: "Start times show at the ground and in your own time zone, so an away series never catches you out.",
  },
  {
    icon: Ticket,
    title: "Official ticket links only",
    body: "A person approves every ticket link, and you see the seller's web address before you leave. We never list resale.",
  },
  {
    icon: BellRing,
    title: "Alerts when sales open",
    body: "Tickets not on sale yet? Ask for an alert and we send one email when an official link appears.",
  },
];

export default async function HomePage() {
  const directory = await getDirectory();
  const now = new Date();
  const upcoming = filterMatches(directory.matches, { sort: "featured", page: 1 }, now).items;
  const featured = pickHero(directory.matches, now);
  const withTickets = directory.matches
    .filter((match) => {
      const state = resolveAttendance(match, match.offers);
      return state === "OFFICIAL_LINK" || state === "AUTHORISED_PARTNER";
    })
    .slice(0, 3);
  const ticker = [...directory.matches]
    .filter((match) => new Date(match.startsAt).getTime() > now.getTime() - 6 * 60 * 60 * 1000)
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))
    .slice(0, 8);
  const comingUp = upcomingMatches(directory.matches, now);

  return (
    <>
      <JsonLd data={homeJsonLd()} />
      <section className="relative isolate min-h-[92svh] overflow-hidden">
        <Image
          src={hero}
          alt="A worn red cricket ball resting in the grass"
          fill
          preload
          placeholder="blur"
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#101612] via-[#101612]/75 to-[#101612]/25" />
        <div className="relative mx-auto flex min-h-[92svh] w-full max-w-[1120px] flex-col justify-end px-5 pt-20 pb-12 text-[#F3F5EF]">
          <p className="text-xs font-semibold tracking-[0.18em] text-[#F3F5EF]/80 uppercase">
            Find the match. Feel the ground.
          </p>
          <h1 className="mt-3 max-w-3xl font-display text-[2.6rem] leading-[0.98] font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
            Cricket matches today and upcoming fixtures
          </h1>
          <p className="mt-4 max-w-xl text-lg text-[#F3F5EF]/85">
            Internationals, top leagues and local cricket near you, with start times in your time
            zone and ticket links that go only to official sellers.
          </p>
          <div className="mt-8 max-w-3xl">
            <SearchForm />
          </div>
          <nav aria-label="Quick links" className="mt-4 flex max-w-3xl flex-wrap gap-2">
            {QUICK_LINKS.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="inline-flex min-h-11 items-center rounded-full border border-white/35 bg-white/10 px-4 text-sm font-medium text-white backdrop-blur-sm hover:bg-white/20"
              >
                {label}
              </Link>
            ))}
          </nav>
          {featured ? (
            <Link
              href={`/match/${featured.slug}`}
              className="mt-6 grid max-w-3xl gap-1 rounded-[1.25rem] bg-[#FFFEFB] p-4 text-[#162018] no-underline sm:grid-cols-[auto_1fr] sm:items-center"
            >
              <span className="text-xs font-semibold tracking-[0.16em] text-[#176B43] uppercase">
                Featured
              </span>
              <span className="font-display text-2xl font-extrabold sm:col-start-1 sm:text-3xl">
                {featured.homeName} vs {featured.awayName}
              </span>
              <span className="text-sm text-[#3E4A42] sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:self-center sm:text-right">
                {formatInTimeZone(featured.startsAt, featured.timezone)}
                <span className="mt-1 block">{featured.venueName}</span>
              </span>
            </Link>
          ) : null}
        </div>
      </section>

      {ticker.length > 0 ? (
        <div className="ticker overflow-hidden border-b border-line bg-surface">
          <div className="ticker-track flex w-max gap-8">
            {/* The track repeats once so the scroll loops; the copy is hidden from screen readers
                and the keyboard. */}
            {[...ticker, ...ticker].map((match, index) => (
              <Link
                key={`${match.slug}-${index}`}
                href={`/match/${match.slug}`}
                className="inline-flex min-h-11 items-center text-sm whitespace-nowrap text-muted"
                aria-hidden={index >= ticker.length ? true : undefined}
                tabIndex={index >= ticker.length ? -1 : undefined}
              >
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
        {upcoming.length ? (
          <MatchGrid matches={upcoming.slice(0, 6)} now={now} />
        ) : (
          <EmptyResults />
        )}
      </section>

      {withTickets.length ? (
        <section className="mx-auto w-full max-w-[1120px] px-5 pb-16">
          <SectionHeading
            eyebrow="Reviewed links"
            title="Tickets available"
            href="/matches?tickets=official"
          />
          <MatchGrid matches={withTickets} now={now} />
        </section>
      ) : null}

      <section className="mx-auto w-full max-w-[1120px] px-5 pb-16">
        <SectionHeading eyebrow="Places" title="Browse by country" href="/countries" />
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {directory.countries
            .filter((country) => country.launch)
            .map((country) => {
              const count = comingUp.filter((match) => match.countrySlug === country.slug).length;
              return (
                <Link
                  key={country.slug}
                  href={`/country/${country.slug}`}
                  className="rounded-[1.25rem] border border-line bg-surface p-5 no-underline"
                >
                  <p className="text-xs font-semibold tracking-[0.16em] text-muted uppercase">
                    {country.iso2}
                  </p>
                  <h3 className="mt-2 font-display text-3xl font-extrabold">{country.name}</h3>
                  <p className="mt-2 text-sm text-muted">
                    {count
                      ? `${count} upcoming ${count === 1 ? "match" : "matches"}`
                      : "Fixtures as they are announced"}
                  </p>
                </Link>
              );
            })}
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1120px] px-5 pb-16">
        <SectionHeading eyebrow="Season hubs" title="Top leagues" href="/leagues" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {directory.leagues.map((league) => (
            <Link
              key={league.slug}
              href={`/league/${league.slug}`}
              className="rounded-[1.25rem] border border-line bg-surface p-4 no-underline"
            >
              <h3 className="font-display text-xl font-extrabold">{league.name}</h3>
              <p className="mt-2 text-sm text-muted">{league.seasonName}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-[1120px] gap-4 px-5 pb-16 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <SectionHeading
            eyebrow="Grassroots"
            title="Clubs and academies near you"
            href="/academies"
          />
          {directory.academies.length ? (
            <div className="grid gap-3">
              {directory.academies.slice(0, 3).map((academy) => (
                <Link
                  key={academy.slug}
                  href={profilePath(academy)}
                  className="rounded-2xl border border-line bg-surface p-4 no-underline"
                >
                  <p className="font-medium">{academy.name}</p>
                  <p className="text-sm text-muted">
                    {academy.cityName} · {academy.verificationLabel}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-[1.25rem] border border-dashed border-line bg-surface p-6">
              <h3 className="font-display text-2xl font-extrabold">
                Coaching, camps and trials, town by town
              </h3>
              <p className="mt-2 max-w-xl text-muted">
                Academies, clubs, committees and grounds are joining now. Each one is checked by a
                person before it appears, with its coaching, fees and matches.
              </p>
              <Link
                href="/country/india"
                className="mt-4 inline-flex min-h-11 items-center rounded-full border border-line px-5 font-medium"
              >
                Browse India by state
              </Link>
            </div>
          )}
        </div>
        <div className="rounded-[1.25rem] bg-[#176B43] p-6 text-white">
          <p className="text-xs font-semibold tracking-[0.16em] text-white/75 uppercase">
            For clubs and academies
          </p>
          <h2 className="mt-2 font-display text-4xl font-extrabold">
            Put your cricket on the map, for free.
          </h2>
          <p className="mt-3 text-white/85">
            Academies, clubs, committees and grounds get a free page with their coaching, camps,
            trials and matches, and enquiries straight on WhatsApp.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/get-listed"
              className="inline-flex min-h-11 items-center rounded-full bg-white px-5 font-medium text-[#176B43]"
            >
              List your club for free
            </Link>
            <Link
              href="/submit/match"
              className="inline-flex min-h-11 items-center rounded-full border border-white/50 px-5 font-medium text-white"
            >
              Report a match
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="how" className="mx-auto w-full max-w-[1120px] px-5 pb-8">
        <p className="text-xs font-semibold tracking-[0.16em] text-link uppercase">
          Why cricketmatch.today
        </p>
        <h2 id="how" className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          How it works
        </h2>
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {HOW.map(({ icon: Icon, title, body }) => (
            <li key={title} className="rounded-2xl border border-line p-5">
              <Icon aria-hidden="true" className="h-6 w-6 text-link" />
              <h3 className="mt-3 font-display text-xl font-bold">{title}</h3>
              <p className="mt-2 text-sm text-muted">{body}</p>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-muted">
          Built in India by Gagan and Vansh.{" "}
          <Link href="/about" className="font-medium text-link underline underline-offset-4">
            About us
          </Link>
        </p>
      </section>
    </>
  );
}

function SectionHeading({
  eyebrow,
  title,
  href,
}: {
  eyebrow: string;
  title: string;
  href: string;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <p className="text-xs font-semibold tracking-[0.16em] text-link uppercase">{eyebrow}</p>
        <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h2>
      </div>
      <Link
        href={href}
        className="inline-flex min-h-11 shrink-0 items-center text-sm font-medium text-link"
      >
        View all
      </Link>
    </div>
  );
}

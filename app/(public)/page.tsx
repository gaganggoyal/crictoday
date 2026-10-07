import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, BadgeCheck, Ban, BellRing, Check, ShieldCheck, Ticket } from "lucide-react";
import { EmptyResults, MatchGrid } from "@/components/match/match-grid";
import { SearchForm } from "@/components/match/search-form";
import { JsonLd } from "@/components/seo/json-ld";
import { currentTime } from "@/lib/clock";
import { SISTER_SITE } from "@/lib/company";
import { getDirectory } from "@/lib/data/catalog";
import { filterMatches, pickHero } from "@/lib/domain/filters";
import { profilePath } from "@/lib/domain/profiles";
import { ATTENDANCE_COPY, isOver, ticketRoute } from "@/lib/domain/ticket-state";
import { formatInTimeZone, formatShortDate } from "@/lib/domain/time";
import type { StoredMatch } from "@/lib/domain/types";
import { homeJsonLd, matchName, pageMetadata, upcomingMatches } from "@/lib/seo";
import hero from "@/public/images/hero.jpg";

const home = pageMetadata(
  "Cricket matches today, fixtures and official ticket links",
  "Find cricket matches today and upcoming fixtures, with ticket status and reviewed links to official organisers and authorised ticket sellers.",
  "/",
);

export const metadata: Metadata = {
  ...home,
  title: {
    absolute: "Cricket matches today, fixtures and official ticket links · cricketmatch.today",
  },
};

const QUICK_LINKS = [
  ["/matches?when=today", "Today"],
  ["/matches?when=tomorrow", "Tomorrow"],
  ["/matches?when=weekend", "This weekend"],
  ["/matches?tickets=free", "Free entry"],
];

const PROMISES = ["We don't sell tickets", "No resale listings", "Source and last check shown"];

const HOW = [
  {
    icon: ShieldCheck,
    title: "Checked at the source",
    body: "Every match links to the board's, league's or organiser's own page and shows when we last checked it. A listing not checked for a week says so.",
  },
  {
    icon: Ticket,
    title: "Official sellers only",
    body: "A person approves each ticket link for its match, from the organiser's own page. You see the seller's name and domain before you leave.",
  },
  {
    icon: Ban,
    title: "No resale",
    body: "We never list fan-to-fan resale or unknown sellers, and we don't sell tickets ourselves.",
  },
  {
    icon: BellRing,
    title: "Alerts when sales open",
    body: "No official link yet? Ask for an alert and we email you once, when one is approved.",
  },
];

export default async function HomePage() {
  const directory = await getDirectory();
  const now = currentTime();
  const upcoming = filterMatches(directory.matches, { sort: "featured", page: 1 }, now).items;
  // Matches whose ticket button opens a reviewed official or authorised seller, soonest first.
  const withTickets = directory.matches
    .filter((match) => ticketRoute(match, now))
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  // The highest featured rank leads; the sort keeps the soonest first among equals.
  const featuredTickets = [...withTickets].sort((a, b) => b.featuredRank - a.featuredRank)[0];
  const featured = featuredTickets ? null : pickHero(directory.matches, now);
  const ticker = [...directory.matches]
    .filter((match) => !isOver(match, now))
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
          <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-[#F3F5EF]/85 uppercase">
            <BadgeCheck aria-hidden="true" className="h-4 w-4 shrink-0 text-[#8EE0B0]" />
            Official ticket sources checked
          </p>
          <h1 className="mt-3 max-w-5xl font-display text-[2.6rem] leading-[0.98] font-extrabold tracking-tight text-balance sm:text-6xl lg:text-7xl">
            {/* One sentence a line from a tablet up; a phone lets them run on. */}
            <span className="sm:block">Find cricket matches.</span>{" "}
            <span className="sm:block">Buy from the official source.</span>
          </h1>
          <p className="mt-4 max-w-xl text-lg text-[#F3F5EF]/85">
            Upcoming internationals, leagues and local cricket, with reviewed links to official
            organisers and authorised ticket sellers. You see the seller&apos;s domain before you
            leave, and there is no fan-to-fan resale.
          </p>
          <div className="mt-8 max-w-3xl">
            <SearchForm />
          </div>
          <div className="mt-4 flex max-w-3xl flex-wrap gap-3">
            <Link
              href="/matches?tickets=official"
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#F3F5EF] px-6 font-semibold text-[#105535] no-underline hover:bg-white"
            >
              <Ticket aria-hidden="true" className="h-5 w-5" />
              Find official tickets
            </Link>
            <Link
              href="/matches"
              className="inline-flex min-h-12 items-center rounded-full border border-white/50 px-6 font-medium text-white no-underline hover:bg-white/10"
            >
              Browse all matches
            </Link>
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
          <ul className="mt-5 flex max-w-3xl flex-wrap gap-x-5 gap-y-2 text-sm text-[#F3F5EF]/85">
            {PROMISES.map((promise) => (
              <li key={promise} className="inline-flex items-center gap-1.5">
                <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-[#8EE0B0]" />
                {promise}
              </li>
            ))}
          </ul>
          {featuredTickets ? <FeaturedRoute match={featuredTickets} now={now} /> : null}
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

      {withTickets.length ? (
        <section className="mx-auto w-full max-w-[1120px] px-5 pt-16">
          <SectionHeading
            eyebrow="Reviewed links"
            title="Official ticket sources available now"
            href="/matches?tickets=official"
            intro="Each link was checked against the organiser's, league's, board's or ground's own page. Confirm the match and the seller's terms before you pay."
          />
          <MatchGrid matches={withTickets.slice(0, 6)} now={now} />
        </section>
      ) : null}

      <section className="mx-auto w-full max-w-[1120px] px-5 py-16">
        <SectionHeading eyebrow="On the card" title="Upcoming matches" href="/matches" />
        {upcoming.length ? (
          <MatchGrid matches={upcoming.slice(0, 6)} now={now} />
        ) : (
          <EmptyResults />
        )}
      </section>

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

      <section aria-labelledby="how" className="mx-auto w-full max-w-[1120px] px-5 pb-16">
        <p className="text-xs font-semibold tracking-[0.16em] text-link uppercase">
          Why trust these links
        </p>
        <h2 id="how" className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          How we check ticket links
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
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
          <Link
            href="/how-we-check-ticket-links"
            className="inline-flex min-h-11 items-center font-medium text-link underline underline-offset-4"
          >
            Read how we check ticket links
          </Link>
          <p className="text-muted">
            Built in India by Gagan and Vansh. From the team behind{" "}
            <a
              href={SISTER_SITE.url}
              className="font-medium text-link underline underline-offset-4"
            >
              {SISTER_SITE.name}
            </a>
            .{" "}
            <Link href="/about" className="font-medium text-link underline underline-offset-4">
              About us
            </Link>
          </p>
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
    </>
  );
}

function SectionHeading({
  eyebrow,
  title,
  href,
  intro,
}: {
  eyebrow: string;
  title: string;
  href: string;
  intro?: string;
}) {
  return (
    <div className="mb-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-link uppercase">{eyebrow}</p>
          <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            {title}
          </h2>
        </div>
        <Link
          href={href}
          className="inline-flex min-h-11 shrink-0 items-center text-sm font-medium text-link"
        >
          View all
        </Link>
      </div>
      {intro ? <p className="mt-2 max-w-2xl text-muted">{intro}</p> : null}
    </div>
  );
}

/** The hero's featured match and its reviewed ticket route: seller, domain, check date, button. */
function FeaturedRoute({ match, now }: { match: StoredMatch; now: Date }) {
  const route = ticketRoute(match, now);
  if (!route) return null;
  const copy = ATTENDANCE_COPY[route.state];
  return (
    <div className="mt-6 grid max-w-3xl gap-3 rounded-[1.25rem] bg-[#FFFEFB] p-4 text-[#162018] sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold tracking-[0.16em] text-[#176B43] uppercase">
          Featured ticket route
        </span>
        <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full bg-[#176B43] px-2.5 text-xs font-semibold text-white">
          <Ticket aria-hidden="true" size={14} />
          {copy.label}
        </span>
      </div>
      <div>
        <Link
          href={`/match/${match.slug}`}
          className="font-display text-2xl font-extrabold text-[#162018] no-underline hover:underline sm:text-3xl"
        >
          {matchName(match)}
        </Link>
        <p className="mt-1 text-sm text-[#3E4A42]">
          {formatInTimeZone(match.startsAt, match.timezone)} · {match.venueName}, {match.cityName}
        </p>
      </div>
      <p className="flex items-start gap-1.5 text-sm text-[#3E4A42]">
        <BadgeCheck aria-hidden="true" size={16} className="mt-0.5 shrink-0 text-[#176B43]" />
        <span>
          Seller <span className="font-semibold text-[#162018]">{route.offer.sellerName}</span> ·{" "}
          <span className="font-semibold text-[#162018]">{route.offer.sellerDomain}</span>
          {route.checkedAt
            ? ` · checked ${formatShortDate(route.checkedAt, match.timezone)}`
            : null}
        </span>
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href={`/go/${route.offer.id}`}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[#176B43] px-5 font-medium text-white no-underline"
        >
          {copy.cta}
          <ArrowUpRight aria-hidden="true" size={18} />
        </Link>
        <Link
          href={`/match/${match.slug}`}
          className="inline-flex min-h-11 items-center rounded-full border border-[#D5DDD2] px-5 font-medium text-[#162018] no-underline"
        >
          Match details
        </Link>
      </div>
    </div>
  );
}

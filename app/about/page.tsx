import Link from "next/link";
import { BellRing, Check, MapPin, Ticket, Trophy } from "lucide-react";
import { JsonLd } from "@/components/seo/json-ld";
import { FOUNDERS, SISTER_SITE } from "@/lib/company";
import { organizationJsonLd, pageMetadata } from "@/lib/seo";
import { siteUrl } from "@/lib/utils";

export const metadata = pageMetadata(
  "About us",
  "cricketmatch.today was founded by Gagan and Vansh to make every cricket match easy to find: internationals, top leagues and local clubs and academies, with official ticket links.",
  "/about",
);

const WHAT_WE_DO = [
  {
    icon: Trophy,
    title: "Matches you can attend",
    body: "Internationals and top leagues, each linked to the board's or organiser's own page, with official ticket links that a person has checked.",
  },
  {
    icon: MapPin,
    title: "Local cricket near you",
    body: "Academies, clubs, committees and grounds across India's states and union territories, with their coaching, camps, trials and matches.",
  },
  {
    icon: Ticket,
    title: "Free for clubs and academies",
    body: "Any academy, club, committee or ground can list for free, post its matches and take enquiries straight on WhatsApp. No commission.",
  },
  {
    icon: BellRing,
    title: "Ticket alerts",
    body: "Tickets not on sale yet? Ask once, and we email you when an official link appears.",
  },
];

const PROMISES = [
  [
    "Official links only",
    "We do not sell tickets or run resale, and we show you the seller before you leave the site.",
  ],
  ["Real listings", "A person checks every club and academy before it goes live."],
  [
    "Little data, no ads",
    "No advertising trackers, and email addresses given for ticket alerts are encrypted.",
  ],
  ["Free to list", "Clubs and academies pay nothing, and every enquiry goes straight to them."],
];

const AVATAR = ["bg-[#176B43]", "bg-[#B8501E]"];

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-[1120px] px-5 py-12">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "AboutPage",
          name: "About cricketmatch.today",
          url: `${siteUrl()}/about`,
          mainEntity: organizationJsonLd(),
        }}
      />
      <p className="text-xs font-semibold tracking-[0.16em] text-link uppercase">About us</p>
      <h1 className="mt-2 max-w-3xl font-display text-5xl leading-[0.98] font-extrabold tracking-tight sm:text-6xl">
        Cricket is everywhere. Finding it should be easy.
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-muted">
        cricketmatch.today shows you where and when cricket is on, from Test matches and big leagues
        to the club game down the road, and the official way in.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/matches"
          className="inline-flex min-h-12 items-center rounded-full bg-[#176B43] px-6 text-[15px] font-medium text-white"
        >
          Browse matches
        </Link>
        <Link
          href="/get-listed"
          className="inline-flex min-h-12 items-center rounded-full border border-line px-6 text-[15px] font-medium"
        >
          List your club for free
        </Link>
      </div>

      <section aria-labelledby="why" className="mt-16 max-w-3xl">
        <h2 id="why" className="font-display text-3xl font-extrabold">
          Why we started
        </h2>
        <div className="mt-4 grid gap-4 text-[17px] leading-7">
          <p>
            In India, cricket is everywhere: Tests and T20s in packed stadiums, league nights, and
            thousands of club games, academy trials and tournaments in every town. Finding the one
            you want still means digging through board websites, WhatsApp forwards and posters at
            the nets.
          </p>
          <p>
            We wanted one place that answers the simple questions. Who is playing, where, when, and
            how do I get in? It should work whether you want to watch India at a Test ground or find
            a trial for your child.
          </p>
          <p>
            So we built cricketmatch.today: matches by country, state and city, start times at the
            ground and in your own time zone, and ticket links that go only to official sellers.
          </p>
          <p>
            cricketmatch.today is from the team behind{" "}
            <a
              href={SISTER_SITE.url}
              className="font-medium text-link underline underline-offset-4"
            >
              {SISTER_SITE.name}
            </a>
            , a deals and savings site for shoppers in India.
          </p>
        </div>
      </section>

      <section aria-labelledby="what" className="mt-16">
        <h2 id="what" className="font-display text-3xl font-extrabold">
          What we do
        </h2>
        <ul className="mt-5 grid gap-4 sm:grid-cols-2">
          {WHAT_WE_DO.map(({ icon: Icon, title, body }) => (
            <li key={title} className="rounded-[1.25rem] border border-line bg-surface p-5">
              <Icon aria-hidden="true" className="h-6 w-6 text-link" />
              <h3 className="mt-3 text-lg font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted">{body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="promises" className="mt-16">
        <h2 id="promises" className="font-display text-3xl font-extrabold">
          What we stand for
        </h2>
        <ul className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {PROMISES.map(([title, body]) => (
            <li key={title} className="flex gap-3">
              <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#176B43] text-white">
                <Check aria-hidden="true" className="h-4 w-4" />
              </span>
              <span>
                <span className="block font-semibold">{title}</span>
                <span className="mt-0.5 block text-sm text-muted">{body}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="founders" className="mt-16">
        <h2 id="founders" className="font-display text-3xl font-extrabold">
          The founders
        </h2>
        <ul className="mt-5 grid gap-4 md:grid-cols-2">
          {FOUNDERS.map((person, index) => (
            <li
              key={person.name}
              className="flex flex-col gap-4 rounded-[1.25rem] border border-line bg-surface p-6 sm:flex-row"
            >
              <span
                aria-hidden="true"
                className={`inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-full font-display text-3xl font-extrabold text-white ${AVATAR[index % AVATAR.length]}`}
              >
                {person.name[0]}
              </span>
              <div>
                <h3 className="font-display text-2xl font-extrabold">{person.name}</h3>
                <p className="text-sm font-semibold tracking-[0.12em] text-link uppercase">
                  {person.title}
                </p>
                <p className="mt-3 text-muted">{person.bio}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="join"
        className="mt-16 rounded-[1.25rem] bg-[#176B43] p-6 text-white sm:p-10"
      >
        <h2 id="join" className="max-w-2xl font-display text-4xl font-extrabold">
          Run an academy, club, committee or ground?
        </h2>
        <p className="mt-3 max-w-2xl text-white/85">
          List it for free. Show your coaching, camps and trials, post your matches, and let cricket
          fans in your town find you.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/get-listed"
            className="inline-flex min-h-12 items-center rounded-full bg-white px-6 text-[15px] font-medium text-[#176B43]"
          >
            List your club for free
          </Link>
          <Link
            href="/contact"
            className="inline-flex min-h-12 items-center rounded-full border border-white/50 px-6 text-[15px] font-medium text-white"
          >
            Talk to us
          </Link>
        </div>
      </section>
    </div>
  );
}

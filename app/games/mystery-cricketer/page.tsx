import Link from "next/link";
import { connection } from "next/server";
import { ClueTiles } from "@/components/game/clue-tiles";
import { MysteryCricketer, type NextMatch } from "@/components/game/mystery-cricketer";
import { currentTime } from "@/lib/clock";
import { CONTACT_EMAIL } from "@/lib/company";
import { getDirectory } from "@/lib/data/catalog";
import { matchesToCome } from "@/lib/domain/filters";
import { formatShortDate } from "@/lib/domain/time";
import { EXAMPLE, MAX_GUESSES, compare } from "@/lib/game/clues";
import { puzzlesNow } from "@/lib/game/daily";
import { utcDateKey } from "@/lib/game/dates";
import {
  ANSWERS,
  COUNTRIES,
  PLAYERS,
  PLAYERS_UPDATED,
  playerById,
  type Country,
} from "@/lib/game/players";
import { matchName, pageMetadata } from "@/lib/seo";
import { siteUrl } from "@/lib/utils";

const PATH = "/games/mystery-cricketer";

export const metadata = pageMetadata(
  "Mystery Cricketer: guess today's cricketer",
  "A free daily cricket game. Guess the mystery cricketer in eight tries, with clues for his country, role, batting, bowling, age, debut and last IPL team. A new cricketer every midnight.",
  PATH,
  true,
  {
    url: `${siteUrl()}/og/game`,
    width: 1200,
    height: 630,
    alt: "Mystery Cricketer, the daily guess-the-cricketer game on cricketmatch.today",
  },
);

const LONG_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** Each country's next listed match, so a finished game can point to its ground and tickets. */
async function nextMatches(): Promise<Partial<Record<Country, NextMatch>>> {
  try {
    const directory = await getDirectory();
    const upcoming = matchesToCome(directory.matches, currentTime()).filter(
      (match) => match.status !== "postponed",
    );
    const found: Partial<Record<Country, NextMatch>> = {};
    for (const [country, { slug }] of Object.entries(COUNTRIES) as [
      Country,
      (typeof COUNTRIES)[Country],
    ][]) {
      const match = upcoming.find((item) => item.homeSlug === slug || item.awaySlug === slug);
      if (match) {
        found[country] = {
          href: `/match/${match.slug}`,
          title: matchName(match),
          when: formatShortDate(match.startsAt, match.timezone),
          where: `${match.venueName}, ${match.cityName}`,
        };
      }
    }
    return found;
  } catch (error) {
    // The game does not need the fixtures; it just leaves the link out.
    console.error("Mystery Cricketer could not load the next matches", error);
    return {};
  }
}

const CLOSE_RULES: [string, string][] = [
  [
    "Country",
    "another country in the same part of the cricket world: Asia (India, Pakistan, Sri Lanka, Bangladesh and Afghanistan), Oceania (Australia and New Zealand), Europe (England and Ireland) or Africa (South Africa and Zimbabwe). The West Indies have no close neighbour here.",
  ],
  [
    "Role",
    "a role that shares a skill: an all-rounder beside a batter or a bowler, and a keeper beside a batter.",
  ],
  ["Bowls", "the same kind of bowling: both pace, or both spin."],
  [
    "Age and debut",
    "within two years. The arrow points the way to the mystery cricketer: up if he is older, or made his debut later, down if he is younger or made it earlier.",
  ],
  [
    "Last IPL team",
    "a franchise the mystery cricketer also played for, earlier in his IPL career.",
  ],
];

export default async function MysteryCricketerPage() {
  // The puzzles depend on the time of the request, so the page is never prerendered.
  await connection();
  const now = new Date();
  const next = await nextMatches();
  const today = utcDateKey(now);
  const exampleAnswer = playerById(EXAMPLE.answer);
  const exampleGuess = playerById(EXAMPLE.guess);
  const updated = LONG_DATE.format(new Date(`${PLAYERS_UPDATED}T00:00:00Z`));

  return (
    <div className="mx-auto w-full max-w-[1120px] px-5 py-10">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold tracking-[0.16em] text-link uppercase">
          Daily cricket game
        </p>
        <h1 className="mt-2 font-display text-5xl leading-[0.98] font-extrabold tracking-tight sm:text-6xl">
          Mystery Cricketer
        </h1>
        <p className="mt-4 text-lg text-muted">
          Guess today&apos;s cricketer in {MAX_GUESSES} tries. Each guess shows how close you are:
          his country, role, batting, bowling, age, debut and last IPL team. A new cricketer arrives
          at midnight, your time.
        </p>
      </header>

      <div className="mt-8 grid gap-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10">
        <div className="min-w-0">
          <MysteryCricketer
            puzzles={puzzlesNow(now)}
            nextMatches={next}
            url={`${siteUrl()}${PATH}`}
          />
        </div>

        <section
          aria-labelledby="how-to-play"
          className="min-w-0 lg:sticky lg:top-24 lg:self-start"
        >
          <h2 id="how-to-play" className="font-display text-3xl font-extrabold tracking-tight">
            How to play
          </h2>
          <ol className="mt-3 grid list-decimal gap-2 pl-5 text-[15px] marker:text-muted">
            <li>Type part of a name and pick the cricketer from the list.</li>
            <li>His tiles compare him with the mystery cricketer, clue by clue.</li>
            <li>
              <span className="font-semibold">Green</span> is a match,{" "}
              <span className="font-semibold">amber</span> is close, and the arrows point to the
              mystery cricketer&apos;s age and debut.
            </li>
            <li>Find him within {MAX_GUESSES} guesses.</li>
          </ol>
          {exampleAnswer && exampleGuess ? (
            <div className="mt-5 grid gap-3">
              <p className="text-[15px]">
                Say the mystery cricketer were {exampleAnswer.name}, and you guessed{" "}
                {exampleGuess.name}:
              </p>
              <ClueTiles
                player={exampleGuess}
                clues={compare(exampleGuess, exampleAnswer, today)}
                on={today}
              />
              <p className="text-sm text-muted">
                Both played for India, and both last played in the IPL for Mumbai Indians, so those
                match. An all-rounder is close to a batter, and both bowled spin. Sachin batted
                right-handed, is more than two years older and made his debut more than two years
                earlier.
              </p>
            </div>
          ) : null}
        </section>
      </div>

      <section aria-labelledby="questions" className="mt-16 max-w-3xl">
        <h2 id="questions" className="font-display text-3xl font-extrabold tracking-tight">
          Questions
        </h2>
        <div className="prose-page mt-4 text-[17px] leading-7">
          <h3>What counts as close?</h3>
          <ul>
            {CLOSE_RULES.map(([clue, rule]) => (
              <li key={clue}>
                <strong>{clue}:</strong> {rule}
              </li>
            ))}
          </ul>
          <h3>Who can the answer be?</h3>
          <p>
            One of {ANSWERS.length} well-known men who have played international cricket:
            today&apos;s stars and recent greats from all 12 Test-playing nations. You can guess any
            of the {PLAYERS.length.toLocaleString("en-IN")} men who have played for those countries
            since 2012.
          </p>
          <h3>When is there a new cricketer?</h3>
          <p>
            At midnight where you are. Everyone gets the same cricketer on the same date, so you can
            compare results with friends without giving the name away: shared results show only
            coloured squares.
          </p>
          <h3>How do streaks work?</h3>
          <p>
            Your streak counts the days in a row you found the cricketer. Missing a day, or running
            out of guesses, starts it again. Practice rounds don&apos;t count. Your games are kept
            in this browser only, never on our servers, so they don&apos;t follow you to another
            device. Our <Link href="/legal/privacy#cookies">privacy policy</Link> says more.
          </p>
          <h3>Where do the clues come from?</h3>
          <ul>
            <li>
              Each player&apos;s country, how often he bowled and his IPL franchises come from{" "}
              <a href="https://cricsheet.org" rel="noopener">
                Cricsheet
              </a>
              &apos;s records of every men&apos;s Test, ODI, T20 international and IPL match, used
              under the Open Data Commons Attribution License. Cricsheet leaves out matches
              involving Afghanistan&apos;s men, so Afghanistan&apos;s players come from Wikipedia.
            </li>
            <li>
              Batting hand, bowling style, role, date of birth and debut come from each
              player&apos;s Wikipedia profile. We set a few roles by hand where the profile does not
              match how he plays.
            </li>
            <li>
              <strong>Bowls</strong> shows a style only for players who bowled in at least a quarter
              of their internationals. <strong>Debut</strong> is the year of his first international
              for the country shown, and <strong>last IPL team</strong> is the franchise he last
              played a match for.
            </li>
          </ul>
          <p>The players were last updated on {updated}.</p>
          <h3>Spotted a wrong clue?</h3>
          <p>
            Write to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> with the player&apos;s
            name and what is wrong, and we will put it right.
          </p>
        </div>
      </section>
    </div>
  );
}

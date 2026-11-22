import type { Metadata } from "next";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Facts } from "@/components/layout/doc-page";
import { VisitorTime } from "@/components/match/visitor-time";
import { JsonLd } from "@/components/seo/json-ld";
import { YouTubePlayer } from "@/components/watch/youtube-player";
import { currentTime } from "@/lib/clock";
import { pageMetadata } from "@/lib/seo";
import {
  IND_A_V_PAK_A_2026 as STREAM,
  streamState,
  watchJsonLd,
  watchPath,
  watchSocialImage,
} from "@/lib/watch";

const PATH = watchPath(STREAM);

export const metadata: Metadata = pageMetadata(
  "India A vs Pakistan A live stream – Asia Cup Rising Stars 2026",
  "Watch IND A vs PAK A live: India A vs Pakistan A, Asia Cup Rising Stars 2026, Group B in Doha, 22 Nov, 1pm local (3:30pm IST). Stream, TV channel, squads.",
  PATH,
  true,
  watchSocialImage(STREAM),
);

// The sources the page's facts were checked against. Wisden and Willow agree on the date, ground,
// start time, format, captains and squads.
const WISDEN =
  "https://www.wisden.com/series/asia-cup-rising-stars-2026-m/cricket-news/rising-stars-asia-cup-2026-all-you-need-to-know-full-schedule-format-squads-venues-and-match-timings";
const WILLOW = "https://sports.yahoo.com/articles/india-vs-pakistan-asia-cup-164400754.html";
const OUTLOOK =
  "https://www.outlookindia.com/sports/cricket/india-a-vs-pakistan-a-live-score-asia-cup-rising-stars-2026";

const SQUADS: { team: string; captain: string; players: string[] }[] = [
  {
    team: "India A",
    captain: "Tilak Varma",
    players: [
      "Rajat Patidar",
      "Abhishek Sharma",
      "Vaibhav Sooryavanshi",
      "Prabhsimran Singh",
      "Rinku Singh",
      "Kumar Kushagra",
      "Suryansh Shedge",
      "Shahbaz Ahmed",
      "Vipraj Nigam",
      "Harsh Dubey",
      "Tanush Kotian",
      "Harshit Rana",
      "Prince Yadav",
      "Arshad Khan",
    ],
  },
  {
    team: "Pakistan A",
    captain: "Abdul Samad",
    players: [
      "Ahmed Daniyal",
      "Ali Raza",
      "Danish Aziz",
      "Farhan Yousuf",
      "Haider Ali",
      "Hasan Nawaz",
      "Maaz Sadaqat",
      "Mohammad Hasnain",
      "Muhammad Imran Randhawa",
      "Rohail Nazir",
      "Saad Masood",
      "Shahzaib Khan",
      "Shamyl Hussain",
      "Sufyan Moqim",
    ],
  },
];

const FAQ: [string, ReactNode][] = [
  [
    "What time does India A vs Pakistan A start?",
    "Play starts at 1pm in Doha on Sunday 22 November 2026: 3:30pm in India, 3pm in Pakistan and 10am in the UK.",
  ],
  [
    "Where can I watch IND A vs PAK A live in India?",
    "On the Sony Sports Network TV channels, and streaming on the Sony LIV app and website. The fan stream on this page plays from YouTube.",
  ],
  [
    "Is it a T20 or a one-day match?",
    "A one-day match, 50 overs a side. The 2025 Rising Stars was a T20 tournament; the 2026 edition is played over 50 overs.",
  ],
  [
    "Is this the senior India vs Pakistan team?",
    "No. India A and Pakistan A are their boards' second teams, though both squads have full internationals: India A have Tilak Varma, Abhishek Sharma, Rinku Singh and Harshit Rana, and Pakistan A have Haider Ali and Mohammad Hasnain.",
  ],
  [
    "Where is India A vs Pakistan A being played?",
    "At the West End Park International Cricket Stadium in Doha, Qatar, which also hosts both semi-finals and the final.",
  ],
  ["Who are the captains?", "Tilak Varma leads India A, and Abdul Samad leads Pakistan A."],
];

const CHECKED = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
  timeZoneName: "short",
});

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24">
      <h2 id={`${id}-title`} className="font-display text-3xl font-extrabold tracking-tight">
        {title}
      </h2>
      <div className="prose-page mt-4 text-[17px] leading-7">{children}</div>
    </section>
  );
}

function Source({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

export default function IndiaAVsPakistanAPage() {
  const state = streamState(STREAM, currentTime());
  const youtube = `https://www.youtube.com/watch?v=${STREAM.youtubeId}`;

  return (
    <div className="mx-auto w-full max-w-[1120px] px-5 py-10">
      <JsonLd data={watchJsonLd(STREAM)} />
      <Breadcrumbs
        crumbs={[
          { name: "Matches", path: "/matches" },
          { name: "India A vs Pakistan A live", path: PATH },
        ]}
      />
      <header className="mt-4 max-w-3xl">
        <p className="text-xs font-semibold tracking-[0.16em] text-link uppercase">
          Asia Cup Rising Stars 2026 · Group B
        </p>
        <h1 className="mt-2 font-display text-5xl leading-[0.98] font-extrabold tracking-tight sm:text-6xl">
          India A vs Pakistan A live
        </h1>
        <p className="mt-4 text-lg text-muted">
          IND vs PAK in Doha: India A play Pakistan A in Match 8 of the ACC Men&apos;s Asia Cup
          Rising Stars 2026, a 50-over game at the West End Park International Cricket Stadium on
          Sunday 22 November 2026. Play starts at 1pm in Doha, 3:30pm in India and 3pm in Pakistan.
        </p>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="stream-title" className="min-w-0">
          <h2 id="stream-title" className="sr-only">
            Watch India A vs Pakistan A live
          </h2>
          <YouTubePlayer
            id={STREAM.youtubeId}
            title="India A vs Pakistan A live stream"
            label="IND A vs PAK A"
            live={state === "live"}
          />
          <p className="mt-3 text-sm text-muted">
            {state === "live"
              ? "Live now on YouTube. "
              : state === "upcoming"
                ? "The stream starts on YouTube on 22 November 2026. "
                : "This stream was live on 22 November 2026, and plays here while the channel keeps the recording. "}
            The stream comes from the{" "}
            <a
              href={STREAM.video.channelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-link underline underline-offset-4"
            >
              {STREAM.video.channel}
            </a>{" "}
            YouTube channel, which describes it as a live score and fan chat. It is a fan stream,
            not the official broadcast. Pressing play loads YouTube&apos;s player; until then this
            page loads nothing from YouTube.{" "}
            <a
              href={youtube}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-link underline underline-offset-4"
            >
              Open it on YouTube
            </a>
          </p>
        </section>

        <aside aria-labelledby="at-a-glance" className="grid content-start gap-3">
          <h2 id="at-a-glance" className="font-display text-2xl font-extrabold">
            At a glance
          </h2>
          <dl className="grid gap-px overflow-hidden rounded-[1.25rem] border border-line bg-line text-sm">
            {(
              [
                ["Match", "Match 8, Group B, 50 overs a side"],
                ["Date", "Sunday 22 November 2026"],
                ["Start", "1pm in Doha · 3:30pm IST · 3pm PKT"],
                ["Ground", "West End Park International Cricket Stadium, Doha"],
                ["Captains", "Tilak Varma (India A), Abdul Samad (Pakistan A)"],
                ["On TV in India", "Sony Sports Network, and the Sony LIV app"],
              ] as const
            ).map(([term, detail]) => (
              <div key={term} className="grid gap-0.5 bg-surface p-3.5">
                <dt className="text-xs font-semibold tracking-[0.12em] text-muted uppercase">
                  {term}
                </dt>
                <dd className="font-medium">{detail}</dd>
              </div>
            ))}
          </dl>
          <VisitorTime iso={STREAM.match.startsAt} />
        </aside>
      </div>

      <div className="mt-14 grid max-w-3xl gap-12">
        <Section id="where-to-watch" title="Where to watch India A vs Pakistan A live">
          <p>
            In India, the match is on the <strong>Sony Sports Network</strong> TV channels and
            streams on the <strong>Sony LIV</strong> app and website, Willow&apos;s preview says.
          </p>
          <p>
            The stream above is the {STREAM.video.channel} YouTube channel&apos;s live score and fan
            chat, free to watch here or on YouTube. Press play and it starts on this page.
          </p>
        </Section>

        <Section id="match-details" title="Match details">
          <Facts
            items={[
              ["Tournament", "ACC Men's Asia Cup Rising Stars 2026, 19 to 29 November, in Qatar"],
              ["Match", "India A vs Pakistan A, Match 8, Group B"],
              ["Format", "One-day, 50 overs a side"],
              ["Date", "Sunday 22 November 2026"],
              [
                "Start",
                "1pm in Doha (Arabia Standard Time), 3:30pm in India, 3pm in Pakistan, 10am in the UK",
              ],
              ["Ground", "West End Park International Cricket Stadium, Doha, Qatar"],
              ["Captains", "Tilak Varma (India A) and Abdul Samad (Pakistan A)"],
              [
                "Toss",
                <>
                  Pakistan A won the toss and chose to bat,{" "}
                  <Source href={OUTLOOK}>Outlook India&apos;s live blog</Source> reports.
                </>,
              ],
            ]}
          />
        </Section>

        <Section id="squads" title="India A and Pakistan A squads">
          <p>The 15-player squads named for the tournament. Each side picks its XI on the day.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {SQUADS.map((squad) => (
              <div key={squad.team} className="rounded-[1.25rem] border border-line bg-surface p-5">
                <h3 className="mt-0 font-display text-2xl font-extrabold">{squad.team}</h3>
                <ul className="mt-3 text-base">
                  <li>
                    <strong>{squad.captain}</strong> (captain)
                  </li>
                  {squad.players.map((player) => (
                    <li key={player}>{player}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>

        <Section id="form" title="How India A and Pakistan A started">
          <p>
            Both sides won their first game on Friday 20 November. India A made 332 for 9 against
            Nepal, with 117 from Kumar Kushagra and 107 from Tilak Varma, then bowled Nepal out for
            26 in 11.3 overs to win by 306 runs.
          </p>
          <p>
            Pakistan A, the defending champions, made 245 against the UAE, with 62 from Shamyl
            Hussain and 53 from Maaz Sadaqat, and bowled the UAE out for 184 to win by 61 runs.
          </p>
          <p>
            The last time the tournament was played over 50 overs, in 2023, Pakistan A beat India A
            by 128 runs in the final.
          </p>
        </Section>

        <Section id="group-b" title="Group B, the semi-finals and the final">
          <p>
            Group B is India A, Pakistan A, Nepal and the UAE. Group A is Afghanistan A, Bangladesh
            A, Hong Kong and Sri Lanka A. The top two in each group reach the semi-finals, on
            Thursday 26 and Friday 27 November, and the final is on Sunday 29 November. All three
            are at West End Park at 1pm local time.
          </p>
          <p>
            India A finish their group against the UAE on Tuesday 24 November, at West End Park at
            1pm. Pakistan A play Nepal the same day at the University of Doha for Science and
            Technology, at 9am.
          </p>
        </Section>

        <Section id="faq" title="India A vs Pakistan A: questions fans ask">
          {FAQ.map(([question, answer]) => (
            <Fragment key={question}>
              <h3>{question}</h3>
              <p>{answer}</p>
            </Fragment>
          ))}
        </Section>

        <Section id="more" title="More India and Pakistan cricket">
          <ul>
            <li>
              <Link href="/teams/india">India&apos;s upcoming matches and tickets</Link>
            </li>
            <li>
              <Link href="/teams/pakistan">Pakistan&apos;s upcoming matches and tickets</Link>
            </li>
            <li>
              <Link href="/matches?when=today">Cricket matches today</Link>
            </li>
          </ul>
        </Section>

        <p className="text-sm text-muted">
          Checked on{" "}
          <time dateTime={STREAM.checkedAt}>{CHECKED.format(new Date(STREAM.checkedAt))}</time>{" "}
          against{" "}
          <a
            href={WISDEN}
            target="_blank"
            rel="noopener noreferrer"
            className="text-link underline"
          >
            Wisden&apos;s tournament guide
          </a>{" "}
          and{" "}
          <a
            href={WILLOW}
            target="_blank"
            rel="noopener noreferrer"
            className="text-link underline"
          >
            Willow&apos;s match preview
          </a>
          , which agree on the date, ground, start time, format, captains and squads. Spotted
          something wrong?{" "}
          <Link href="/contact" className="text-link underline">
            Tell us
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

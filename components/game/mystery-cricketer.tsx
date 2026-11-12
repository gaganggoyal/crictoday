"use client";

import Link from "next/link";
import { ArrowRight, Copy, MessageCircle, RotateCcw, Share2, Shuffle } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ClueLegend, ClueTiles } from "@/components/game/clue-tiles";
import { PlayerPicker } from "@/components/game/player-picker";
import { useHydrated } from "@/components/use-hydrated";
import { MAX_GUESSES, compare, solved } from "@/lib/game/clues";
import type { Puzzle } from "@/lib/game/daily";
import { localDateKey, longDay, untilMidnight } from "@/lib/game/dates";
import {
  ANSWERS,
  COUNTRIES,
  PLAYERS,
  playerById,
  type Country,
  type Player,
} from "@/lib/game/players";
import {
  outcome,
  readSaved,
  stats,
  withDay,
  writeSaved,
  type Saved,
  type Stats,
} from "@/lib/game/record";
import { shareText } from "@/lib/game/share";
import { cn } from "@/lib/utils";

/** A country's next listed match, to point the visitor from the game to the fixtures. */
export type NextMatch = { href: string; title: string; when: string; where: string };

type Props = {
  /** The puzzles for every date a visitor could be on now; the browser picks its own. */
  puzzles: Puzzle[];
  nextMatches: Partial<Record<Country, NextMatch>>;
  /** The game's address, for the shared result. */
  url: string;
};

function browserStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const panel = "rounded-[1.25rem] border border-line bg-surface p-4 sm:p-5";
const pill =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-[15px] font-medium transition";

/**
 * Mystery Cricketer. The day is the visitor's own, so the game waits for the browser: the server
 * cannot know the visitor's date, or what this browser has kept.
 */
export function MysteryCricketer(props: Props) {
  const hydrated = useHydrated();
  const [mode, setMode] = useState<"daily" | "practice">("daily");
  if (!hydrated) {
    return (
      <div className={cn(panel, "grid gap-3")} aria-busy="true">
        <p className="text-sm text-muted">Getting today&apos;s cricketer…</p>
        <div className="h-12 rounded-xl border border-line bg-background" />
        <noscript>
          <p>Mystery Cricketer needs JavaScript to run in your browser.</p>
        </noscript>
      </div>
    );
  }
  return (
    <div className="grid gap-4">
      <div
        role="group"
        aria-label="Game"
        className="inline-flex w-fit rounded-full border border-line bg-surface p-1"
      >
        {(
          [
            ["daily", "Today's cricketer"],
            ["practice", "Practice"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            onClick={() => setMode(value)}
            className={cn(
              "min-h-10 rounded-full px-4 text-sm font-medium",
              mode === value ? "bg-[#176B43] text-white" : "text-muted hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === "daily" ? (
        <Daily {...props} onPractice={() => setMode("practice")} />
      ) : (
        <Practice avoid={new Set(props.puzzles.map((puzzle) => puzzle.answer))} />
      )}
    </div>
  );
}

function Daily({ puzzles, nextMatches, url, onPractice }: Props & { onPractice: () => void }) {
  const [today] = useState(() => localDateKey(new Date()));
  const puzzle = puzzles.find((item) => item.date === today);
  const answer = puzzle ? playerById(puzzle.answer) : undefined;
  if (!puzzle || !answer) {
    return (
      <div className={cn(panel, "grid gap-3")}>
        <p className="font-semibold">A new day has started where you are.</p>
        <p className="text-sm text-muted">Load the page again to get today&apos;s cricketer.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className={cn(pill, "w-fit bg-[#176B43] text-white hover:bg-[#105535]")}
        >
          <RotateCcw aria-hidden="true" size={17} />
          Get today&apos;s cricketer
        </button>
      </div>
    );
  }
  return (
    <DailyGame
      puzzle={puzzle}
      answer={answer}
      next={nextMatches[answer.country]}
      url={url}
      onPractice={onPractice}
    />
  );
}

function DailyGame({
  puzzle,
  answer,
  next,
  url,
  onPractice,
}: {
  puzzle: Puzzle;
  answer: Player;
  next: NextMatch | undefined;
  url: string;
  onPractice: () => void;
}) {
  const [saved, setSaved] = useState<Saved>(() => readSaved(browserStorage()));
  const [latest, setLatest] = useState<string | null>(null);
  const day = saved.days[puzzle.date];
  // A day kept for a different answer (the schedule changed) starts again.
  const ids = useMemo(() => (day && day.a === puzzle.answer ? day.g : []), [day, puzzle.answer]);
  const result = outcome({ a: puzzle.answer, g: ids });
  const label = puzzle.number >= 1 ? `#${puzzle.number}` : longDay(puzzle.date);

  function guess(player: Player) {
    if (result !== "playing" || ids.includes(player.id)) return;
    const next = withDay(saved, puzzle.date, {
      n: puzzle.number,
      a: puzzle.answer,
      g: [...ids, player.id],
    });
    setSaved(next);
    writeSaved(browserStorage(), next);
    setLatest(player.id);
  }

  return (
    <Board
      title={
        <>
          <span className="font-display text-2xl font-extrabold">
            {/* Before the schedule's first day, for the time zones already past it. */}
            {puzzle.number >= 1 ? `No. ${puzzle.number}` : "Preview"}
          </span>{" "}
          <span className="text-sm text-muted">{longDay(puzzle.date)}</span>
        </>
      }
      answer={answer}
      on={puzzle.date}
      ids={ids}
      latest={latest}
      onGuess={guess}
      ending={
        result === "playing" ? null : (
          <Ending
            answer={answer}
            won={result === "won"}
            guesses={ids.length}
            on={puzzle.date}
            focus={latest !== null}
          >
            <ShareResult
              text={shareText({
                label,
                rows: ids.map((id) => compare(playerById(id)!, answer, puzzle.date)),
                won: result === "won",
                url,
              })}
            />
            <Record
              stats={stats(saved, puzzle.date)}
              today={result === "won" ? ids.length : null}
            />
            <NextCricketer date={puzzle.date} />
            {next ? (
              <NextMatchLink next={next} country={answer.country} />
            ) : (
              <Link
                href="/matches?kind=international"
                className="inline-flex min-h-11 items-center gap-1.5 font-medium text-link underline underline-offset-4"
              >
                See upcoming internationals
              </Link>
            )}
            <button
              type="button"
              onClick={onPractice}
              className={cn(pill, "w-fit border border-line bg-background hover:bg-surface")}
            >
              <Shuffle aria-hidden="true" size={17} />
              Play a practice round
            </button>
          </Ending>
        )
      }
    />
  );
}

function randomAnswer(avoid: Set<string>) {
  const pool = ANSWERS.filter((player) => !avoid.has(player.id));
  return pool[Math.floor(Math.random() * pool.length)]!;
}

/** Practice: a random cricketer, never one of today's, that does not count towards the record. */
function Practice({ avoid }: { avoid: Set<string> }) {
  const [today] = useState(() => localDateKey(new Date()));
  const [answer, setAnswer] = useState(() => randomAnswer(avoid));
  const [ids, setIds] = useState<string[]>([]);
  const [latest, setLatest] = useState<string | null>(null);
  const result = outcome({ a: answer.id, g: ids });

  return (
    <Board
      title={
        <>
          <span className="font-display text-2xl font-extrabold">Practice</span>{" "}
          <span className="text-sm text-muted">Doesn&apos;t count towards your record</span>
        </>
      }
      answer={answer}
      on={today}
      ids={ids}
      latest={latest}
      onGuess={(player) => {
        if (result !== "playing" || ids.includes(player.id)) return;
        setIds([...ids, player.id]);
        setLatest(player.id);
      }}
      ending={
        result === "playing" ? null : (
          <Ending
            answer={answer}
            won={result === "won"}
            guesses={ids.length}
            on={today}
            focus={latest !== null}
          >
            <button
              type="button"
              onClick={() => {
                setAnswer(randomAnswer(new Set([...avoid, answer.id])));
                setIds([]);
                setLatest(null);
              }}
              className={cn(pill, "w-fit bg-[#176B43] text-white hover:bg-[#105535]")}
            >
              <Shuffle aria-hidden="true" size={17} />
              Another cricketer
            </button>
          </Ending>
        )
      }
    />
  );
}

/** The guess box, the guesses so far, newest first, and the ending once the game is over. */
function Board({
  title,
  answer,
  on,
  ids,
  latest,
  onGuess,
  ending,
}: {
  title: ReactNode;
  answer: Player;
  on: string;
  ids: string[];
  /** The guess made just now, whose tiles turn over. */
  latest: string | null;
  onGuess: (player: Player) => void;
  ending: ReactNode;
}) {
  const guessed = useMemo(() => new Set(ids), [ids]);
  const rows = ids.map((id, index) => {
    const player = playerById(id)!;
    return { player, number: index + 1, clues: compare(player, answer, on) };
  });
  const last = rows[rows.length - 1];
  const left = MAX_GUESSES - ids.length;
  const announcement =
    last && last.player.id === latest
      ? solved(last.clues)
        ? `${last.player.name} is right. You found the mystery cricketer in ${rows.length} ${rows.length === 1 ? "guess" : "guesses"}.`
        : `${last.player.name}: ${last.clues.filter((clue) => clue.verdict === "hit").length} of 7 clues match, ${last.clues.filter((clue) => clue.verdict === "near").length} close.${left === 0 ? ` Out of guesses. The mystery cricketer was ${answer.name}.` : ""}`
      : "";

  return (
    <div className="grid gap-4">
      <div className={cn(panel, "grid gap-4")}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <h2 className="flex flex-wrap items-baseline gap-x-2">{title}</h2>
          <p className="flex items-center gap-2 text-sm text-muted">
            <span aria-hidden="true" className="flex gap-1">
              {Array.from({ length: MAX_GUESSES }, (_, index) => (
                <span
                  key={index}
                  className={cn(
                    "h-2.5 w-2.5 rounded-full border",
                    index < ids.length ? "border-ball bg-ball" : "border-muted/50",
                  )}
                />
              ))}
            </span>
            {left} of {MAX_GUESSES} guesses left
          </p>
        </div>
        {ending ? null : (
          <>
            <PlayerPicker players={PLAYERS} exclude={guessed} onPick={onGuess} />
            <ClueLegend />
          </>
        )}
        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>
      </div>
      {ending}
      {rows.length ? (
        <ol aria-label="Your guesses, newest first" className="grid gap-3">
          {[...rows].reverse().map((row) => (
            <li key={row.player.id} className={cn(panel, "grid gap-2.5 p-3 sm:p-4")}>
              <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-xs font-semibold tracking-[0.12em] text-muted uppercase">
                  Guess {row.number}
                </span>
                <span className="font-semibold">{row.player.name}</span>
              </p>
              <ClueTiles
                player={row.player}
                clues={row.clues}
                on={on}
                animate={row.player.id === latest}
              />
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted">
          Your guesses show up here, each with seven clues about the mystery cricketer.
        </p>
      )}
    </div>
  );
}

function Ending({
  answer,
  won,
  guesses,
  on,
  focus,
  children,
}: {
  answer: Player;
  won: boolean;
  guesses: number;
  on: string;
  /** The game ended just now: the guess box has gone, so focus moves to the result. */
  focus: boolean;
  children: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focus) heading.current?.focus();
  }, [focus]);
  return (
    <section
      aria-labelledby="game-result"
      className={cn(panel, "grid gap-5", won ? "border-hit" : "border-line")}
    >
      <div>
        <h2
          id="game-result"
          ref={heading}
          tabIndex={-1}
          className="font-display text-3xl font-extrabold tracking-tight outline-none!"
        >
          {won
            ? guesses === 1
              ? "First guess. Brilliant."
              : `Got him in ${guesses}.`
            : "Not this time."}
        </h2>
        <p className="mt-1 text-muted">
          The mystery cricketer was{" "}
          <span className="font-semibold text-foreground">{answer.name}</span> of {answer.country}.
        </p>
      </div>
      {won ? null : <ClueTiles player={answer} clues={compare(answer, answer, on)} on={on} />}
      {children}
    </section>
  );
}

function ShareResult({ text }: { text: string }) {
  const [copied, setCopied] = useState<"no" | "yes" | "failed">("no");
  const canShare = typeof navigator.share === "function";
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {canShare ? (
          <button
            type="button"
            onClick={() => {
              navigator.share({ text }).catch(() => {
                // Closing the share sheet is not an error.
              });
            }}
            className={cn(pill, "bg-[#176B43] text-white hover:bg-[#105535]")}
          >
            <Share2 aria-hidden="true" size={17} />
            Share
          </button>
        ) : null}
        <a
          href={`https://wa.me/?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            pill,
            canShare
              ? "border border-line bg-background hover:bg-surface"
              : "bg-[#176B43] text-white hover:bg-[#105535]",
          )}
        >
          <MessageCircle aria-hidden="true" size={17} />
          WhatsApp
        </a>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(text).then(
              () => setCopied("yes"),
              () => setCopied("failed"),
            );
          }}
          className={cn(pill, "border border-line bg-background hover:bg-surface")}
        >
          <Copy aria-hidden="true" size={17} />
          {copied === "yes" ? "Copied" : "Copy result"}
        </button>
      </div>
      <p role="status" className="text-sm text-muted">
        {copied === "failed"
          ? "Your browser would not copy it. Select the result below instead."
          : "Your result shows coloured squares, never the name."}
      </p>
      {copied === "failed" ? (
        <textarea
          readOnly
          value={text}
          rows={text.split("\n").length}
          className="field font-mono text-sm"
          onFocus={(event) => event.currentTarget.select()}
        />
      ) : null}
    </div>
  );
}

function Record({ stats: record, today }: { stats: Stats; today: number | null }) {
  const winRate = record.played ? Math.round((record.won / record.played) * 100) : 0;
  const most = Math.max(1, ...record.wins);
  const figures: [string, number | string][] = [
    ["Played", record.played],
    ["Won", `${winRate}%`],
    ["Streak", record.streak],
    ["Best streak", record.best],
  ];
  return (
    <div className="grid gap-4">
      <div>
        <h3 className="font-display text-xl font-bold">Your record</h3>
        <dl className="mt-2 grid grid-cols-4 gap-2">
          {figures.map(([name, value]) => (
            <div
              key={name}
              className="flex flex-col-reverse rounded-xl bg-background px-2 py-2.5 text-center"
            >
              <dt className="text-xs text-muted">{name}</dt>
              <dd className="font-display text-2xl font-extrabold">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div>
        <h3 className="font-display text-xl font-bold">Guesses to win</h3>
        <ol className="mt-2 grid gap-1">
          {record.wins.map((count, index) => (
            <li key={index} className="grid grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-2">
              <span className="text-right text-sm text-muted">{index + 1}</span>
              <span
                className={cn(
                  "flex h-6 min-w-7 items-center justify-end rounded-md px-2 text-xs font-semibold",
                  today === index + 1 ? "bg-hit text-hit-ink" : "bg-background text-foreground",
                )}
                style={{ width: `${Math.max(8, (count / most) * 100)}%` }}
              >
                <span className="sr-only">
                  {count} {count === 1 ? "win" : "wins"} in {index + 1}{" "}
                  {index === 0 ? "guess" : "guesses"}
                </span>
                <span aria-hidden="true">{count}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-xs text-muted">
          Kept in this browser, on this device. Clearing your browsing data clears it.
        </p>
      </div>
    </div>
  );
}

/** A countdown to the visitor's midnight, then a way to load the new cricketer. */
function NextCricketer({ date }: { date: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  if (localDateKey(now) !== date) {
    return (
      <button
        type="button"
        onClick={() => window.location.reload()}
        className={cn(pill, "w-fit bg-[#176B43] text-white hover:bg-[#105535]")}
      >
        <RotateCcw aria-hidden="true" size={17} />
        Today&apos;s cricketer is ready
      </button>
    );
  }
  const seconds = Math.floor(untilMidnight(now) / 1000);
  const parts = [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60];
  return (
    <p className="text-sm text-muted">
      Next cricketer in{" "}
      <time
        className="font-display text-lg font-bold text-foreground tabular-nums"
        dateTime={`PT${parts[0]}H${parts[1]}M${parts[2]}S`}
      >
        {parts.map((part) => String(part).padStart(2, "0")).join(":")}
      </time>
      , at midnight your time.
    </p>
  );
}

function NextMatchLink({ next, country }: { next: NextMatch; country: Country }) {
  return (
    <Link
      href={next.href}
      className="group flex items-center justify-between gap-3 rounded-2xl border border-line bg-background p-4 no-underline"
    >
      <span className="min-w-0">
        <span className="block text-xs font-semibold tracking-[0.14em] text-link uppercase">
          {country} play next · {COUNTRIES[country].code}
        </span>
        <span className="mt-1 block font-semibold">{next.title}</span>
        <span className="block text-sm text-muted">
          {next.when} · {next.where}
        </span>
      </span>
      <ArrowRight
        aria-hidden="true"
        size={20}
        className="shrink-0 text-link transition group-hover:translate-x-0.5"
      />
    </Link>
  );
}

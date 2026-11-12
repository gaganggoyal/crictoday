import { MAX_GUESSES } from "@/lib/game/clues";
import { addDays, dayNumber } from "@/lib/game/dates";

/**
 * Each day's game and the record built from it, kept in the visitor's browser only. The privacy
 * policy names the storage key.
 */

export const STORAGE_KEY = "mystery-cricketer";

/** n: the puzzle number. a: the answer's id. g: the ids guessed, in order. */
export type Day = { n: number; a: string; g: string[] };
export type Saved = { v: 1; days: Record<string, Day> };

export type Outcome = "won" | "lost" | "playing";

export function outcome(day: Pick<Day, "a" | "g">): Outcome {
  if (day.g.includes(day.a)) return "won";
  return day.g.length >= MAX_GUESSES ? "lost" : "playing";
}

function empty(): Saved {
  return { v: 1, days: {} };
}

function isDay(value: unknown): value is Day {
  if (!value || typeof value !== "object") return false;
  const day = value as Record<string, unknown>;
  return (
    typeof day.n === "number" &&
    typeof day.a === "string" &&
    Array.isArray(day.g) &&
    day.g.every((id) => typeof id === "string")
  );
}

/** What this browser has kept, or an empty record if storage is blocked or holds something else. */
export function readSaved(storage: Pick<Storage, "getItem"> | null): Saved {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as { v?: unknown; days?: unknown };
    if (parsed.v !== 1 || !parsed.days || typeof parsed.days !== "object") return empty();
    const days: Record<string, Day> = {};
    for (const [key, day] of Object.entries(parsed.days)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(key) && isDay(day)) days[key] = day;
    }
    return { v: 1, days };
  } catch {
    return empty();
  }
}

/** The record with one day's game set; days over a year and a half old are dropped. */
export function withDay(saved: Saved, date: string, day: Day): Saved {
  const oldest = addDays(date, -550);
  const days: Record<string, Day> = {};
  for (const [key, value] of Object.entries(saved.days)) {
    if (key >= oldest) days[key] = value;
  }
  days[date] = day;
  return { v: 1, days };
}

export function writeSaved(storage: Pick<Storage, "setItem"> | null, saved: Saved) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // Private windows and full storage: the game goes on, it just isn't kept.
  }
}

export type Stats = {
  played: number;
  won: number;
  /** Days won in a row, up to today, or up to yesterday while today's game is unfinished. */
  streak: number;
  best: number;
  /** wins[k] is how many games were won with k + 1 guesses. */
  wins: number[];
};

export function stats(saved: Saved, today: string): Stats {
  const entries = Object.entries(saved.days).sort(([a], [b]) => a.localeCompare(b));
  const wins = Array.from({ length: MAX_GUESSES }, () => 0);
  let played = 0;
  let won = 0;
  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const [date, day] of entries) {
    const result = outcome(day);
    if (result === "playing") continue;
    played += 1;
    if (result === "won") {
      won += 1;
      wins[Math.min(day.g.length, MAX_GUESSES) - 1]! += 1;
      run = previous !== null && dayNumber(date) - dayNumber(previous) === 1 ? run + 1 : 1;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
    previous = result === "won" ? date : null;
  }
  const todays = saved.days[today];
  let date = todays && outcome(todays) !== "playing" ? today : addDays(today, -1);
  let streak = 0;
  while (saved.days[date] && outcome(saved.days[date]!) === "won") {
    streak += 1;
    date = addDays(date, -1);
  }
  return { played, won, streak, best, wins };
}

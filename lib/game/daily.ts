import "server-only";
import schedule from "@/data/game/schedule.json";
import { addDays, dayNumber, utcDateKey } from "@/lib/game/dates";

/**
 * Which cricketer is the answer on which day. The schedule stays on the server: a page gets only
 * the days some time zone is living through, so the answers to come are not in the browser.
 */

export type Puzzle = {
  /** The visitor's calendar date it belongs to, YYYY-MM-DD. */
  date: string;
  /** 1 on the schedule's first day. */
  number: number;
  /** The answer's player id. */
  answer: string;
};

export const SCHEDULE_START = schedule.start;

export function puzzleOn(date: string): Puzzle {
  const number = dayNumber(date) - dayNumber(schedule.start) + 1;
  const count = schedule.answers.length;
  // After the last scheduled day the schedule starts again from the top.
  const index = (((number - 1) % count) + count) % count;
  return { date, number, answer: schedule.answers[index]! };
}

const HOUR_MS = 3_600_000;

/**
 * The puzzles for every date a visitor anywhere could be on at this moment: clocks run from 12
 * hours behind UTC to 14 hours ahead of it.
 */
export function puzzlesNow(now: Date): Puzzle[] {
  const first = utcDateKey(new Date(now.getTime() - 12 * HOUR_MS));
  const last = utcDateKey(new Date(now.getTime() + 14 * HOUR_MS));
  const puzzles: Puzzle[] = [];
  for (let date = first; date <= last; date = addDays(date, 1)) puzzles.push(puzzleOn(date));
  return puzzles;
}

import { describe, expect, it, vi } from "vitest";
import curated from "@/data/game/curated.json";
import schedule from "@/data/game/schedule.json";
import { EXAMPLE, compare } from "@/lib/game/clues";
import { puzzleOn, puzzlesNow } from "@/lib/game/daily";
import { localDateKey } from "@/lib/game/dates";
import {
  ANSWERS,
  BOWLING,
  COUNTRIES,
  IPL_TEAMS,
  PLAYERS,
  ROLES,
  playerById,
} from "@/lib/game/players";
import { searchPlayers } from "@/lib/game/search";

vi.mock("server-only", () => ({}));

describe("the players", () => {
  it("each have one id and every clue", () => {
    expect(new Set(PLAYERS.map((player) => player.id)).size).toBe(PLAYERS.length);
    expect(new Set(PLAYERS.map((player) => player.name)).size).toBe(PLAYERS.length);
    for (const player of PLAYERS) {
      expect(COUNTRIES[player.country], player.name).toBeDefined();
      expect(ROLES[player.role], player.name).toBeDefined();
      expect(["L", "R"], player.name).toContain(player.bats);
      if (player.bowls) expect(BOWLING[player.bowls], player.name).toBeDefined();
      expect(player.born, player.name).toMatch(/^(19[5-9]\d|20[01]\d)-\d{2}-\d{2}$/);
      expect(player.debut, player.name).toBeGreaterThan(Number(player.born.slice(0, 4)) + 14);
      expect(player.debut, player.name).toBeLessThanOrEqual(2026);
      if (player.ipl) expect(IPL_TEAMS[player.ipl], player.name).toBeDefined();
    }
  });

  it("include every curated answer, with each IPL franchise it played for", () => {
    const names = Object.values(curated.answers).flat();
    expect(ANSWERS.map((player) => player.name).sort()).toEqual([...names].sort());
    for (const answer of ANSWERS) {
      expect(answer.iplTeams, answer.name).toBeDefined();
      if (answer.ipl) expect(answer.iplTeams, answer.name).toContain(answer.ipl);
      else expect(answer.iplTeams, answer.name).toEqual([]);
    }
  });

  it("make the How to play example come out as the page explains it", () => {
    const answer = playerById(EXAMPLE.answer)!;
    const guess = playerById(EXAMPLE.guess)!;
    expect(answer.answer).toBeUndefined();
    expect(compare(guess, answer, "2026-11-12")).toEqual([
      { key: "country", verdict: "hit" },
      { key: "role", verdict: "near" },
      { key: "bowls", verdict: "near" },
      { key: "bats", verdict: "miss" },
      { key: "age", verdict: "miss", direction: "higher" },
      { key: "debut", verdict: "miss", direction: "lower" },
      { key: "ipl", verdict: "hit" },
    ]);
  });

  it("are found by surname, initials and nickname", () => {
    expect(searchPlayers("kohli", PLAYERS)[0]?.name).toBe("Virat Kohli");
    expect(searchPlayers("V Kohli", PLAYERS)[0]?.name).toBe("Virat Kohli");
    expect(searchPlayers("msd", PLAYERS)[0]?.name).toBe("MS Dhoni");
    expect(searchPlayers("de kock", PLAYERS)[0]?.name).toBe("Quinton de Kock");
    expect(searchPlayers("mcgurk", PLAYERS)[0]?.name).toBe("Jake Fraser-McGurk");
    expect(searchPlayers("rashid", PLAYERS).map((player) => player.name)).toContain("Rashid Khan");
    expect(searchPlayers("", PLAYERS)).toEqual([]);
    const kohli = playerById("virat-kohli")!;
    expect(searchPlayers("kohli", PLAYERS, { exclude: new Set([kohli.id]) })).not.toContain(kohli);
  });
});

describe("the schedule", () => {
  it("names only answers, every answer, and never one country two days running", () => {
    const answerIds = new Set(ANSWERS.map((player) => player.id));
    for (const id of schedule.answers) expect(answerIds.has(id), id).toBe(true);
    expect(new Set(schedule.answers)).toEqual(answerIds);
    for (let day = 1; day < schedule.answers.length; day += 1) {
      const today = playerById(schedule.answers[day]!)!;
      const yesterday = playerById(schedule.answers[day - 1]!)!;
      expect(today.country, `day ${day + 1}`).not.toBe(yesterday.country);
    }
  });

  it("numbers days from its start and starts again after its last day", () => {
    expect(puzzleOn(schedule.start)).toEqual({
      date: schedule.start,
      number: 1,
      answer: schedule.answers[0],
    });
    const after = new Date(`${schedule.start}T00:00:00Z`);
    after.setUTCDate(after.getUTCDate() + schedule.answers.length);
    const wrapped = puzzleOn(after.toISOString().slice(0, 10));
    expect(wrapped.number).toBe(schedule.answers.length + 1);
    expect(wrapped.answer).toBe(schedule.answers[0]);
  });

  it("covers every time zone's date, and only those", () => {
    // 11:00 UTC on 20 November: Baker Island is still on the 19th, Kiribati already on the 21st.
    const now = new Date("2026-11-20T11:00:00Z");
    expect(puzzlesNow(now).map((puzzle) => puzzle.date)).toEqual([
      "2026-11-19",
      "2026-11-20",
      "2026-11-21",
    ]);
    // At 23:00 UTC nowhere is on the 19th any more.
    expect(puzzlesNow(new Date("2026-11-20T23:00:00Z")).map((puzzle) => puzzle.date)).toEqual([
      "2026-11-20",
      "2026-11-21",
    ]);
    // This machine's own date is always among them.
    const dates = puzzlesNow(new Date()).map((puzzle) => puzzle.date);
    expect(dates).toContain(localDateKey(new Date()));
  });
});

import { ageOn } from "@/lib/game/dates";
import {
  BOWLING,
  COUNTRIES,
  IPL_TEAMS,
  ROLES,
  type Bowling,
  type Player,
  type Role,
} from "@/lib/game/players";

/** How a guess compares with the day's cricketer, one clue at a time. */

export const MAX_GUESSES = 8;

/**
 * The How to play example: a guess of Yuvraj Singh against Sachin Tendulkar. Sachin is never a
 * day's answer, so the example gives nothing away; a test keeps the page's explanation true.
 */
export const EXAMPLE = { answer: "sachin-tendulkar", guess: "yuvraj-singh" } as const;

/** In the order the tiles show them: the three with longer words first, so a phone gives them room. */
export const CLUES = ["country", "role", "bowls", "bats", "age", "debut", "ipl"] as const;
export type ClueKey = (typeof CLUES)[number];

export const CLUE_NAMES: Record<ClueKey, string> = {
  country: "Country",
  role: "Role",
  bowls: "Bowls",
  bats: "Bats",
  age: "Age",
  debut: "Debut",
  ipl: "Last IPL team",
};

/** hit: the same. near: close (see each rule). miss: neither. */
export type Verdict = "hit" | "near" | "miss";

export type Clue = {
  key: ClueKey;
  verdict: Verdict;
  /** For age and debut: whether the day's cricketer is higher (older, later) or lower. */
  direction?: "higher" | "lower";
};

const PACE = new Set<Bowling>(["right-pace", "left-pace"]);

/** Roles that share a skill: an all-rounder bats and bowls, and a keeper bats. */
const CLOSE_ROLES: [Role, Role][] = [
  ["bat", "ar"],
  ["bowl", "ar"],
  ["bat", "wk"],
];

function rolesShareASkill(a: Role, b: Role) {
  return CLOSE_ROLES.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
}

function numeric(key: "age" | "debut", guess: number, answer: number): Clue {
  if (guess === answer) return { key, verdict: "hit" };
  return {
    key,
    verdict: Math.abs(guess - answer) <= 2 ? "near" : "miss",
    direction: answer > guess ? "higher" : "lower",
  };
}

/** The clues a guess earns. `on` is the puzzle's date, which fixes both players' ages. */
export function compare(guess: Player, answer: Player, on: string): Clue[] {
  const country: Verdict =
    guess.country === answer.country
      ? "hit"
      : COUNTRIES[guess.country].region === COUNTRIES[answer.country].region
        ? "near"
        : "miss";
  const role: Verdict =
    guess.role === answer.role
      ? "hit"
      : rolesShareASkill(guess.role, answer.role)
        ? "near"
        : "miss";
  const bowls: Verdict =
    guess.bowls === answer.bowls
      ? "hit"
      : guess.bowls && answer.bowls && PACE.has(guess.bowls) === PACE.has(answer.bowls)
        ? "near"
        : "miss";
  const ipl: Verdict =
    guess.ipl === answer.ipl
      ? "hit"
      : guess.ipl && answer.iplTeams?.includes(guess.ipl)
        ? "near"
        : "miss";
  return [
    { key: "country", verdict: country },
    { key: "role", verdict: role },
    { key: "bowls", verdict: bowls },
    { key: "bats", verdict: guess.bats === answer.bats ? "hit" : "miss" },
    numeric("age", ageOn(guess.born, on), ageOn(answer.born, on)),
    numeric("debut", guess.debut, answer.debut),
    { key: "ipl", verdict: ipl },
  ];
}

export function solved(clues: Clue[]) {
  return clues.every((clue) => clue.verdict === "hit");
}

/** What a tile shows for a player, short enough for a phone. */
export function clueValue(player: Player, key: ClueKey, on: string) {
  switch (key) {
    case "country":
      return COUNTRIES[player.country].code;
    case "role":
      return ROLES[player.role];
    case "bats":
      return player.bats === "L" ? "Left" : "Right";
    case "bowls":
      return player.bowls ? BOWLING[player.bowls] : "Doesn't bowl";
    case "age":
      return String(ageOn(player.born, on));
    case "debut":
      return String(player.debut);
    case "ipl":
      return player.ipl ?? "None";
  }
}

/** The same in full, for screen readers and tooltips. */
export function clueValueInFull(player: Player, key: ClueKey, on: string) {
  switch (key) {
    case "country":
      return player.country;
    case "bats":
      return player.bats === "L" ? "Left-handed" : "Right-handed";
    case "ipl":
      return player.ipl ? IPL_TEAMS[player.ipl] : "Never played in the IPL";
    default:
      return clueValue(player, key, on);
  }
}

const VERDICT_WORDS: Record<Verdict, string> = { hit: "match", near: "close", miss: "no match" };

/** "Age 37: no match, the mystery cricketer is older." */
export function describeClue(player: Player, clue: Clue, on: string) {
  const value = clueValueInFull(player, clue.key, on);
  const direction =
    clue.direction === undefined
      ? ""
      : clue.key === "age"
        ? clue.direction === "higher"
          ? ", the mystery cricketer is older"
          : ", the mystery cricketer is younger"
        : clue.direction === "higher"
          ? ", the mystery cricketer made his debut later"
          : ", the mystery cricketer made his debut earlier";
  return `${CLUE_NAMES[clue.key]} ${value}: ${VERDICT_WORDS[clue.verdict]}${direction}`;
}

import { describe, expect, it } from "vitest";
import { compare, describeClue, solved, type Clue } from "@/lib/game/clues";
import { ageOn } from "@/lib/game/dates";
import type { Player } from "@/lib/game/players";
import { shareText } from "@/lib/game/share";

function player(patch: Partial<Player> = {}): Player {
  return {
    id: "a",
    name: "A",
    country: "India",
    role: "bat",
    bats: "R",
    bowls: null,
    born: "1990-06-15",
    debut: 2012,
    ipl: "MI",
    answer: true,
    iplTeams: ["MI"],
    ...patch,
  };
}

const ON = "2026-11-12";

function verdicts(guess: Player, answer: Player) {
  return Object.fromEntries(compare(guess, answer, ON).map((clue) => [clue.key, clue.verdict]));
}

describe("compare", () => {
  it("marks every clue a match for the answer itself", () => {
    const answer = player();
    expect(solved(compare(answer, answer, ON))).toBe(true);
  });

  it("calls a country in the same part of the world close", () => {
    const answer = player({ country: "India" });
    expect(verdicts(player({ country: "Pakistan" }), answer).country).toBe("near");
    expect(verdicts(player({ country: "Afghanistan" }), answer).country).toBe("near");
    expect(verdicts(player({ country: "England" }), answer).country).toBe("miss");
    expect(verdicts(player({ country: "Ireland" }), player({ country: "England" })).country).toBe(
      "near",
    );
    expect(
      verdicts(player({ country: "Zimbabwe" }), player({ country: "South Africa" })).country,
    ).toBe("near");
  });

  it("calls roles that share a skill close", () => {
    const role = (guess: Player["role"], answer: Player["role"]) =>
      verdicts(player({ role: guess }), player({ role: answer })).role;
    expect(role("ar", "bat")).toBe("near");
    expect(role("bowl", "ar")).toBe("near");
    expect(role("wk", "bat")).toBe("near");
    expect(role("bat", "bowl")).toBe("miss");
    expect(role("wk", "ar")).toBe("miss");
    expect(role("wk", "bowl")).toBe("miss");
  });

  it("calls the same kind of bowling close, and a non-bowler a match only for another", () => {
    const bowls = (guess: Player["bowls"], answer: Player["bowls"]) =>
      verdicts(player({ bowls: guess }), player({ bowls: answer })).bowls;
    expect(bowls("left-pace", "right-pace")).toBe("near");
    expect(bowls("off-spin", "left-wrist")).toBe("near");
    expect(bowls("leg-spin", "right-pace")).toBe("miss");
    expect(bowls(null, null)).toBe("hit");
    expect(bowls(null, "off-spin")).toBe("miss");
    expect(bowls("off-spin", null)).toBe("miss");
  });

  it("points age and debut towards the answer and calls two years either way close", () => {
    const answer = player({ born: "1988-11-05", debut: 2008 });
    const clues = compare(player({ born: "1992-01-01", debut: 2010 }), answer, ON);
    const age = clues.find((clue) => clue.key === "age")!;
    const debut = clues.find((clue) => clue.key === "debut")!;
    // 38 against 34: the answer is older, by more than two years.
    expect(age).toEqual({ key: "age", verdict: "miss", direction: "higher" });
    // 2008 against 2010: earlier, and within two years.
    expect(debut).toEqual({ key: "debut", verdict: "near", direction: "lower" });
    // Born in January 1988 and in November 1988: both are 38 on 12 November 2026.
    const same = compare(player({ born: "1988-01-31", debut: 2008 }), answer, ON);
    expect(same.find((clue) => clue.key === "age")).toEqual({ key: "age", verdict: "hit" });
    expect(same.find((clue) => clue.key === "debut")).toEqual({ key: "debut", verdict: "hit" });
  });

  it("calls an IPL franchise close when the answer once played for it", () => {
    const answer = player({ ipl: "RR", iplTeams: ["CSK", "RR"] });
    expect(verdicts(player({ ipl: "RR" }), answer).ipl).toBe("hit");
    expect(verdicts(player({ ipl: "CSK" }), answer).ipl).toBe("near");
    expect(verdicts(player({ ipl: "MI" }), answer).ipl).toBe("miss");
    expect(verdicts(player({ ipl: null }), answer).ipl).toBe("miss");
    const never = player({ ipl: null, iplTeams: [] });
    expect(verdicts(player({ ipl: null }), never).ipl).toBe("hit");
    expect(verdicts(player({ ipl: "MI" }), never).ipl).toBe("miss");
  });

  it("describes a clue in words for screen readers", () => {
    const guess = player({ born: "1995-01-01" });
    const clue: Clue = { key: "age", verdict: "miss", direction: "higher" };
    expect(describeClue(guess, clue, ON)).toBe("Age 31: no match, the mystery cricketer is older");
    expect(describeClue(player({ ipl: null }), { key: "ipl", verdict: "hit" }, ON)).toBe(
      "Last IPL team Never played in the IPL: match",
    );
  });
});

describe("ageOn", () => {
  it("counts a birthday only once it has come", () => {
    expect(ageOn("1988-11-05", "2026-11-04")).toBe(37);
    expect(ageOn("1988-11-05", "2026-11-05")).toBe(38);
    expect(ageOn("2000-02-29", "2026-02-28")).toBe(25);
    expect(ageOn("2000-02-29", "2026-03-01")).toBe(26);
  });
});

describe("shareText", () => {
  it("shares the score and squares without naming anyone", () => {
    const rows: Clue[][] = [
      [
        { key: "country", verdict: "near" },
        { key: "role", verdict: "miss" },
      ],
      [
        { key: "country", verdict: "hit" },
        { key: "role", verdict: "hit" },
      ],
    ];
    expect(
      shareText({ label: "#12", rows, won: true, url: "https://cricketmatch.today/games/x" }),
    ).toBe("Mystery Cricketer #12 🏏 2/8\n\n🟨⬛\n🟩🟩\n\nhttps://cricketmatch.today/games/x");
    expect(shareText({ label: "#3", rows, won: false, url: "u" })).toContain("X/8");
  });
});

import { describe, expect, it } from "vitest";
import {
  STORAGE_KEY,
  outcome,
  readSaved,
  stats,
  withDay,
  writeSaved,
  type Saved,
} from "@/lib/game/record";

function memory(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    items,
  };
}

const won = (guesses: number) => ({
  n: 1,
  a: "answer",
  g: [...Array.from({ length: guesses - 1 }, (_, i) => `miss-${i}`), "answer"],
});
const lost = { n: 1, a: "answer", g: Array.from({ length: 8 }, (_, i) => `miss-${i}`) };
const playing = { n: 1, a: "answer", g: ["miss-0"] };

function saved(days: Saved["days"]): Saved {
  return { v: 1, days };
}

describe("outcome", () => {
  it("is won once the answer is guessed and lost after eight misses", () => {
    expect(outcome(won(3))).toBe("won");
    expect(outcome(lost)).toBe("lost");
    expect(outcome(playing)).toBe("playing");
  });
});

describe("stats", () => {
  it("counts games, wins and the guesses each win took", () => {
    const result = stats(
      saved({
        "2026-11-01": won(2),
        "2026-11-02": lost,
        "2026-11-03": won(5),
        "2026-11-04": playing,
      }),
      "2026-11-04",
    );
    expect(result.played).toBe(3);
    expect(result.won).toBe(2);
    expect(result.wins).toEqual([0, 1, 0, 0, 1, 0, 0, 0]);
  });

  it("keeps a streak alive until today's game is over", () => {
    const days = { "2026-11-10": won(4), "2026-11-11": won(3) };
    expect(stats(saved(days), "2026-11-12").streak).toBe(2);
    expect(stats(saved({ ...days, "2026-11-12": playing }), "2026-11-12").streak).toBe(2);
    expect(stats(saved({ ...days, "2026-11-12": won(1) }), "2026-11-12").streak).toBe(3);
    expect(stats(saved({ ...days, "2026-11-12": lost }), "2026-11-12").streak).toBe(0);
  });

  it("ends a streak on a missed day and remembers the best one", () => {
    const result = stats(
      saved({
        "2026-11-01": won(2),
        "2026-11-02": won(2),
        "2026-11-03": won(2),
        "2026-11-05": won(2),
        "2026-11-06": won(2),
      }),
      "2026-11-07",
    );
    expect(result.streak).toBe(2);
    expect(result.best).toBe(3);
    // Nothing played yesterday: no streak today.
    expect(stats(saved({ "2026-11-05": won(2) }), "2026-11-07").streak).toBe(0);
  });
});

describe("storage", () => {
  it("reads back what it wrote and ignores anything malformed", () => {
    const storage = memory();
    writeSaved(storage, withDay(saved({}), "2026-11-12", won(3)));
    expect(readSaved(storage).days["2026-11-12"]).toEqual(won(3));
    expect(readSaved(memory({ [STORAGE_KEY]: "not json" }))).toEqual({ v: 1, days: {} });
    expect(
      readSaved(
        memory({
          [STORAGE_KEY]: JSON.stringify({ v: 1, days: { x: won(1), "2026-11-01": { g: 3 } } }),
        }),
      ),
    ).toEqual({ v: 1, days: {} });
    expect(readSaved(null)).toEqual({ v: 1, days: {} });
  });

  it("survives storage that throws", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
    };
    expect(readSaved(broken)).toEqual({ v: 1, days: {} });
    expect(() => writeSaved(broken, saved({}))).not.toThrow();
  });

  it("drops days over a year and a half old", () => {
    const next = withDay(
      saved({ "2025-01-01": won(1), "2026-06-01": won(1) }),
      "2026-11-12",
      won(2),
    );
    expect(Object.keys(next.days)).toEqual(["2026-06-01", "2026-11-12"]);
  });
});

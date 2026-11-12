import type { Player } from "@/lib/game/players";

/** Lower case, without accents or punctuation, so "Fraser-McGurk" and "fraser mcgurk" agree. */
export function normalize(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

type Entry = { player: Player; names: string[][]; full: string[] };

const indexes = new WeakMap<Player[], Entry[]>();

function index(players: Player[]) {
  let entries = indexes.get(players);
  if (!entries) {
    entries = players.map((player) => {
      const full = [player.name, ...(player.aka ?? [])].map(normalize);
      return { player, full, names: full.map((name) => name.split(" ")) };
    });
    indexes.set(players, entries);
  }
  return entries;
}

/**
 * Players whose name or nickname has a word starting with every word typed, so "kohli",
 * "v kohli" and "virat" all find Virat Kohli. Names that start with what was typed come first,
 * then the well-known players a day's answer can be, then the rest alphabetically.
 */
export function searchPlayers(
  query: string,
  players: Player[],
  { exclude = new Set<string>(), limit = 8 }: { exclude?: Set<string>; limit?: number } = {},
) {
  const typed = normalize(query);
  if (!typed) return [];
  const words = typed.split(" ");
  const found: { player: Player; rank: number }[] = [];
  for (const entry of index(players)) {
    if (exclude.has(entry.player.id)) continue;
    const matches = entry.names.some((name) =>
      words.every((word) => name.some((part) => part.startsWith(word))),
    );
    if (!matches) continue;
    const starts = entry.full.some((name) => name.startsWith(typed));
    found.push({ player: entry.player, rank: (starts ? 0 : 2) + (entry.player.answer ? 0 : 1) });
  }
  return found
    .sort((a, b) => a.rank - b.rank || a.player.name.localeCompare(b.player.name))
    .slice(0, limit)
    .map((item) => item.player);
}

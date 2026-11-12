import { MAX_GUESSES, type Clue, type Verdict } from "@/lib/game/clues";

const SQUARES: Record<Verdict, string> = { hit: "🟩", near: "🟨", miss: "⬛" };

/**
 * The result to paste into a chat: the puzzle, the score and a grid of squares, which gives no
 * names away.
 */
export function shareText({
  label,
  rows,
  won,
  url,
}: {
  /** "#12", or the date for a practice game. */
  label: string;
  rows: Clue[][];
  won: boolean;
  url: string;
}) {
  const score = `${won ? rows.length : "X"}/${MAX_GUESSES}`;
  const grid = rows.map((row) => row.map((clue) => SQUARES[clue.verdict]).join("")).join("\n");
  return `Mystery Cricketer ${label} 🏏 ${score}\n\n${grid}\n\n${url}`;
}

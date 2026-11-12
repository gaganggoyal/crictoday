import { ArrowDown, ArrowUp, Check, EqualApproximately } from "lucide-react";
import {
  CLUE_NAMES,
  clueValue,
  clueValueInFull,
  describeClue,
  type Clue,
  type ClueKey,
  type Verdict,
} from "@/lib/game/clues";
import type { Player } from "@/lib/game/players";
import { cn } from "@/lib/utils";

/** Tile labels: the IPL one is shortened to fit a phone. */
const TILE_NAMES: Record<ClueKey, string> = { ...CLUE_NAMES, ipl: "IPL" };

const TILE: Record<Verdict, string> = {
  hit: "border-hit bg-hit text-hit-ink",
  near: "border-near bg-near text-near-ink",
  miss: "border-line bg-surface text-foreground",
};

/**
 * A guess's seven clues: in one row where there is room, otherwise the three with the longest
 * words (country, role, bowling) over the four short ones. Room is measured on the tiles' own box,
 * so the same tiles fit the game and the narrow How to play column. Each tile says in words what
 * its colour and arrow show.
 */
export function ClueTiles({
  player,
  clues,
  on,
  animate = false,
}: {
  player: Player;
  clues: Clue[];
  /** The puzzle's date, for ages. */
  on: string;
  /** Turn the tiles over one by one, for the guess just made. */
  animate?: boolean;
}) {
  return (
    <div className="@container">
      <ul className="grid grid-cols-12 gap-1.5 @2xl:grid-cols-7">
        {clues.map((clue, index) => {
          const Arrow = clue.direction === "higher" ? ArrowUp : ArrowDown;
          const Mark =
            clue.verdict === "hit" ? Check : clue.verdict === "near" ? EqualApproximately : null;
          return (
            <li
              key={clue.key}
              title={`${CLUE_NAMES[clue.key]}: ${clueValueInFull(player, clue.key, on)}`}
              className={cn(
                "flex min-h-18 min-w-0 flex-col justify-between gap-1 rounded-xl border px-1.5 py-1.5 @md:px-2",
                index < 3 ? "col-span-4" : "col-span-3",
                "@2xl:col-span-1",
                TILE[clue.verdict],
                animate && "tile-in",
              )}
              style={animate ? { animationDelay: `${index * 90}ms` } : undefined}
            >
              <span aria-hidden="true" className="flex items-start justify-between gap-0.5">
                <span className="min-w-0 truncate text-[10px] font-semibold tracking-[0.04em] uppercase opacity-80">
                  {TILE_NAMES[clue.key]}
                </span>
                {Mark ? <Mark size={12} strokeWidth={3} className="shrink-0" /> : null}
              </span>
              <span
                aria-hidden="true"
                className="flex flex-wrap items-end gap-px text-xs leading-tight font-bold @min-[18rem]:text-[13px] sm:text-sm"
              >
                {/* Words may break to fit a narrow tile; a year or an age never does. */}
                <span
                  className={cn(
                    "min-w-0",
                    clue.direction || clue.key === "age" || clue.key === "debut"
                      ? "whitespace-nowrap"
                      : "wrap-break-word",
                  )}
                >
                  {clueValue(player, clue.key, on)}
                </span>
                {clue.direction ? (
                  <Arrow size={13} strokeWidth={3} className="mb-px shrink-0" />
                ) : null}
              </span>
              <span className="sr-only">{describeClue(player, clue, on)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The colours explained in one line, under the guess box. */
export function ClueLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      <li className="inline-flex items-center gap-1.5">
        <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-hit text-hit-ink">
          <Check aria-hidden="true" size={11} strokeWidth={3} />
        </span>
        Match
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-near text-near-ink">
          <EqualApproximately aria-hidden="true" size={11} strokeWidth={3} />
        </span>
        Close
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span className="inline-flex h-4 w-4 rounded border border-line bg-surface" />
        No match
      </li>
      <li className="inline-flex items-center gap-1">
        <ArrowUp aria-hidden="true" size={13} strokeWidth={2.75} />
        <ArrowDown aria-hidden="true" size={13} strokeWidth={2.75} />
        The answer is higher or lower
      </li>
    </ul>
  );
}

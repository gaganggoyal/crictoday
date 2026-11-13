"use client";

import { Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { COUNTRIES, ROLES, type Player } from "@/lib/game/players";
import { searchPlayers } from "@/lib/game/search";
import { cn } from "@/lib/utils";

/**
 * The guess box: type part of a name and pick the cricketer from the list. Arrow keys move
 * through the list, Enter picks and Escape closes it, as in the ARIA combobox pattern. With a
 * keyboard, typing a letter anywhere on the page starts a guess.
 */
export function PlayerPicker({
  players,
  exclude,
  onPick,
  disabled = false,
}: {
  players: Player[];
  /** Cricketers already guessed. */
  exclude: Set<string>;
  onPick: (player: Player) => void;
  /** The same box, not yet usable, while the game loads. */
  disabled?: boolean;
}) {
  const id = useId();
  const listId = `${id}-options`;
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const results = useMemo(
    () => searchPlayers(query, players, { exclude }),
    [query, players, exclude],
  );
  const showing = open && query.trim().length > 0;
  const current = showing ? results[active] : undefined;
  // Nothing left to pick: say whether the name was already guessed or is unknown.
  const guessedAlready = useMemo(
    () =>
      showing && results.length === 0
        ? searchPlayers(query, players, { limit: 1 }).find((player) => exclude.has(player.id))
        : undefined,
    [showing, results, query, players, exclude],
  );

  useEffect(() => {
    if (disabled) return;
    function onType(event: globalThis.KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
      if (!/^[a-z]$/i.test(event.key)) return;
      // Only when nothing has focus, so menus, the site search and other fields keep their keys.
      if (document.activeElement && document.activeElement !== document.body) return;
      // Add the letter here rather than trust each browser to type it into a box that took focus
      // during the key press.
      event.preventDefault();
      input.current?.focus();
      setQuery((typed) => typed + event.key);
      setActive(0);
      setOpen(true);
    }
    document.addEventListener("keydown", onType);
    return () => document.removeEventListener("keydown", onType);
  }, [disabled]);

  function pick(player: Player) {
    onPick(player);
    setQuery("");
    setActive(0);
    setOpen(false);
    if (window.matchMedia("(pointer: coarse)").matches) {
      // On a touch screen the keyboard would cover the new guess's clues, so put it away.
      input.current?.blur();
    } else {
      input.current?.focus();
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (current) pick(current);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={box} className="relative scroll-mt-20">
      <label htmlFor={`${id}-input`} className="text-sm font-semibold">
        Guess a cricketer
      </label>
      <div className="relative mt-1.5">
        <Search
          aria-hidden="true"
          size={18}
          className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted"
        />
        <input
          ref={input}
          id={`${id}-input`}
          type="text"
          role="combobox"
          aria-expanded={showing}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={current ? `${id}-${current.id}` : undefined}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="words"
          spellCheck={false}
          enterKeyHint="go"
          disabled={disabled}
          placeholder={
            disabled ? "Getting today's cricketer…" : "Start typing a name, such as Kohli"
          }
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            // On a phone the keyboard and the bottom bar leave little room under the box, so
            // bring the box to the top of the screen, under the header.
            if (window.matchMedia("(max-width: 767px)").matches) {
              const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
              box.current?.scrollIntoView({ block: "start", behavior: still ? "auto" : "smooth" });
            }
          }}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          // .field sets its own padding, so the room for the search icon needs !important.
          className="field min-h-12 pl-10! text-base"
        />
      </div>
      <ul
        id={listId}
        role="listbox"
        aria-label="Cricketers"
        hidden={!showing || results.length === 0}
        className="absolute inset-x-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-2xl border border-line bg-surface p-1 shadow-[0_18px_40px_rgba(22,32,24,0.16)]"
      >
        {results.map((player, index) => (
          <li
            key={player.id}
            id={`${id}-${player.id}`}
            role="option"
            aria-selected={index === active}
            // Keep focus in the box, so the list stays open until the click lands.
            onMouseDown={(event) => event.preventDefault()}
            onMouseMove={() => setActive(index)}
            onClick={() => pick(player)}
            className={cn(
              "flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2",
              index === active && "bg-background",
            )}
          >
            <span className="font-medium">{player.name}</span>
            <span className="shrink-0 text-xs text-muted">
              {COUNTRIES[player.country].code} · {ROLES[player.role]}
            </span>
          </li>
        ))}
      </ul>
      {showing && results.length === 0 ? (
        <p role="status" className="mt-2 text-sm text-muted">
          {guessedAlready
            ? `You have already guessed ${guessedAlready.name}.`
            : "No cricketer by that name. You can guess any man who has played international cricket for one of the 12 Test nations since 2012."}
        </p>
      ) : null}
    </div>
  );
}

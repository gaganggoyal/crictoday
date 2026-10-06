"use client";

import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { INDIA_STATES, POPULAR_CITIES } from "@/lib/data/india";
import { PROFILE_KIND_PLURAL, PROFILE_KINDS } from "@/lib/domain/profiles";
import { cn } from "@/lib/utils";

export type MenuData = {
  countries: Array<{ slug: string; name: string }>;
  leagues: Array<{ slug: string; name: string; seasonName: string }>;
};

type Panel = "places" | "leagues" | "clubs";

const INTERNATIONAL = [
  { href: "/matches?kind=international", label: "All internationals" },
  { href: "/matches?kind=international&format=test", label: "Tests" },
  { href: "/matches?kind=international&format=odi", label: "ODIs" },
  { href: "/matches?kind=international&format=t20", label: "T20Is" },
];

const CLUB_LINKS = PROFILE_KINDS.map((kind) => ({
  href: `/academies?kind=${kind}`,
  label: PROFILE_KIND_PLURAL[kind],
}));

const panelLink =
  "flex min-h-10 items-center justify-between gap-2 rounded-xl px-3 text-sm hover:bg-background focus-visible:bg-background";

/** The browse bar under the header on wider screens, with shop-style flyout panels. */
export function CategoryBar({ menu }: { menu: MenuData }) {
  const [open, setOpen] = useState<Panel | null>(null);
  const bar = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);

  const later = (next: Panel | null, delay: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(next), delay);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(null);
      document.getElementById(`browse-${open}`)?.focus();
    };
    const onPointer = (event: MouseEvent) => {
      if (!bar.current?.contains(event.target as Node)) setOpen(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const trigger = (id: Panel, label: string) => (
    <button
      id={`browse-${id}`}
      type="button"
      aria-expanded={open === id}
      aria-controls={`browse-panel-${id}`}
      onClick={() => setOpen(open === id ? null : id)}
      onMouseEnter={() => later(id, open ? 0 : 120)}
      className={cn(
        "inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-medium",
        open === id ? "bg-surface text-foreground" : "text-muted hover:text-foreground",
      )}
    >
      {label}
      <ChevronDown aria-hidden="true" size={15} />
    </button>
  );

  return (
    <div
      ref={bar}
      className="relative hidden border-t border-line md:block"
      onMouseLeave={() => later(null, 220)}
      onMouseEnter={() => window.clearTimeout(timer.current)}
    >
      <nav
        aria-label="Browse"
        className="mx-auto flex w-full max-w-[1120px] items-center gap-1 px-5"
      >
        {trigger("places", "Countries")}
        {trigger("leagues", "Leagues & internationals")}
        {trigger("clubs", "Clubs & academies")}
        <Link
          href="/matches"
          className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-medium text-muted hover:text-foreground"
        >
          All matches
        </Link>
        <Link
          href="/matches?tickets=free"
          className="hidden min-h-11 items-center rounded-full px-3 text-sm font-medium text-muted hover:text-foreground lg:inline-flex"
        >
          Free entry
        </Link>
      </nav>
      {open ? (
        <div
          id={`browse-panel-${open}`}
          role="region"
          aria-labelledby={`browse-${open}`}
          className="absolute inset-x-0 top-full z-50 border-y border-line bg-surface shadow-[0_24px_60px_rgba(22,32,24,0.14)]"
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("a")) setOpen(null);
          }}
        >
          <div className="mx-auto w-full max-w-[1120px] px-5 py-5">
            {open === "places" ? <PlacesPanel countries={menu.countries} /> : null}
            {open === "leagues" ? <LeaguesPanel leagues={menu.leagues} /> : null}
            {open === "clubs" ? <ClubsPanel /> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PlacesPanel({ countries }: { countries: MenuData["countries"] }) {
  const [country, setCountry] = useState("india");
  const [stateSlug, setStateSlug] = useState<string | null>(null);
  const active = INDIA_STATES.find((item) => item.slug === stateSlug) ?? null;
  const current = countries.find((item) => item.slug === country);

  return (
    <div className="grid grid-cols-[12rem_15rem_minmax(0,1fr)] gap-4">
      <ul aria-label="Countries" className="grid content-start gap-0.5 border-r border-line pr-3">
        {countries.map((item) => (
          <li key={item.slug}>
            <Link
              href={`/country/${item.slug}`}
              onMouseEnter={() => {
                setCountry(item.slug);
                setStateSlug(null);
              }}
              onFocus={() => {
                setCountry(item.slug);
                setStateSlug(null);
              }}
              className={cn(panelLink, country === item.slug && "bg-background font-semibold")}
            >
              {item.name}
              {item.slug === "india" ? <ChevronRight aria-hidden="true" size={15} /> : null}
            </Link>
          </li>
        ))}
      </ul>
      {country === "india" ? (
        <>
          <ul
            aria-label="States and union territories of India"
            className="grid max-h-[26rem] content-start gap-0.5 overflow-y-auto border-r border-line pr-3"
          >
            <li>
              <Link href="/country/india" className={cn(panelLink, "font-semibold text-link")}>
                All of India
              </Link>
            </li>
            {INDIA_STATES.map((item) => (
              <li key={item.slug}>
                <Link
                  href={`/country/india/state/${item.slug}`}
                  onMouseEnter={() => setStateSlug(item.slug)}
                  onFocus={() => setStateSlug(item.slug)}
                  className={cn(
                    panelLink,
                    stateSlug === item.slug && "bg-background font-semibold",
                  )}
                >
                  {item.name}
                  <ChevronRight aria-hidden="true" size={15} />
                </Link>
              </li>
            ))}
          </ul>
          <div className="min-w-0">
            <p className="px-3 text-xs font-semibold tracking-[0.14em] text-muted uppercase">
              {active ? `Cities in ${active.name}` : "Popular cities"}
            </p>
            <ul className="mt-2 grid grid-cols-2 gap-0.5 lg:grid-cols-3">
              {(active
                ? active.cities.map((city) => ({ ...city, stateSlug: active.slug }))
                : POPULAR_CITIES
              ).map((city) => (
                <li key={city.slug}>
                  <Link href={`/country/india/${city.slug}`} className={panelLink}>
                    {city.name}
                  </Link>
                </li>
              ))}
            </ul>
            {active ? (
              <Link
                href={`/country/india/state/${active.slug}`}
                className="mt-3 inline-flex min-h-10 items-center px-3 text-sm font-semibold text-link"
              >
                All of {active.name}
              </Link>
            ) : (
              <p className="mt-3 px-3 text-sm text-muted">
                Point at a state to see its cities. Every city page lists its matches, clubs and
                academies.
              </p>
            )}
          </div>
        </>
      ) : (
        <div className="col-span-2 grid content-start gap-2 px-3">
          <Link href={`/country/${country}`} className="font-display text-2xl font-extrabold">
            Cricket in {current?.name}
          </Link>
          <p className="text-sm text-muted">
            Matches by city are on the country page. States and cities are listed for India first.
          </p>
        </div>
      )}
    </div>
  );
}

function LeaguesPanel({ leagues }: { leagues: MenuData["leagues"] }) {
  return (
    <div className="grid grid-cols-[16rem_minmax(0,1fr)] gap-6">
      <div>
        <p className="px-3 text-xs font-semibold tracking-[0.14em] text-muted uppercase">
          International cricket
        </p>
        <ul className="mt-2 grid gap-0.5">
          {INTERNATIONAL.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className={panelLink}>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="px-3 text-xs font-semibold tracking-[0.14em] text-muted uppercase">Leagues</p>
        <ul className="mt-2 grid grid-cols-2 gap-0.5 lg:grid-cols-3">
          {leagues.map((league) => (
            <li key={league.slug}>
              <Link href={`/league/${league.slug}`} className={cn(panelLink, "block py-2")}>
                <span className="block font-medium">{league.name}</span>
                <span className="block text-xs text-muted">{league.seasonName}</span>
              </Link>
            </li>
          ))}
        </ul>
        <Link
          href="/leagues"
          className="mt-3 inline-flex min-h-10 items-center px-3 text-sm font-semibold text-link"
        >
          All leagues
        </Link>
      </div>
    </div>
  );
}

function ClubsPanel() {
  return (
    <div className="grid grid-cols-[16rem_minmax(0,1fr)] gap-6">
      <div>
        <p className="px-3 text-xs font-semibold tracking-[0.14em] text-muted uppercase">Find</p>
        <ul className="mt-2 grid gap-0.5">
          {CLUB_LINKS.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className={panelLink}>
                {item.label}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/academies" className={cn(panelLink, "font-semibold text-link")}>
              All clubs and academies
            </Link>
          </li>
        </ul>
      </div>
      <div className="rounded-[1.25rem] border border-line bg-background p-5">
        <p className="font-display text-2xl font-extrabold">Run a club, academy or committee?</p>
        <p className="mt-2 max-w-lg text-sm text-muted">
          Create a free profile, list what you offer, and post your matches. Fans in your city find
          them on the city and state pages.
        </p>
        <Link
          href="/get-listed"
          className="mt-4 inline-flex min-h-11 items-center rounded-full bg-[#176B43] px-5 text-sm font-medium text-white"
        >
          List your club for free
        </Link>
      </div>
    </div>
  );
}

type Screen =
  | { id: "root" }
  | { id: "countries" }
  | { id: "india" }
  | { id: "state"; slug: string }
  | { id: "leagues" }
  | { id: "clubs" };

/** The phone menu: one list at a time, like a shop's category drawer. */
export function MenuDrawer({ menu, email }: { menu: MenuData; email: string | null }) {
  const [open, setOpen] = useState(false);
  const [trail, setTrail] = useState<Screen[]>([{ id: "root" }]);
  const close = useRef<HTMLButtonElement>(null);
  const screen = trail[trail.length - 1]!;

  useEffect(() => {
    if (!open) return;
    close.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const go = (next: Screen) => setTrail((current) => [...current, next]);
  const back = () => setTrail((current) => (current.length > 1 ? current.slice(0, -1) : current));
  const state =
    screen.id === "state" ? INDIA_STATES.find((item) => item.slug === screen.slug) : null;
  const title =
    screen.id === "countries"
      ? "Countries"
      : screen.id === "india"
        ? "India"
        : screen.id === "state"
          ? (state?.name ?? "")
          : screen.id === "leagues"
            ? "Leagues & internationals"
            : screen.id === "clubs"
              ? "Clubs & academies"
              : "Browse";

  const row = "flex min-h-12 w-full items-center justify-between gap-3 border-b border-line px-5";
  const next = (label: string, target: Screen) => (
    <li>
      <button type="button" className={cn(row, "text-left")} onClick={() => go(target)}>
        {label}
        <ChevronRight aria-hidden="true" size={18} />
      </button>
    </li>
  );
  const link = (href: string, label: string, strong = false) => (
    <li>
      <Link href={href} className={cn(row, strong && "font-semibold text-link")}>
        {label}
      </Link>
    </li>
  );

  return (
    <>
      <button
        type="button"
        aria-label="Open the menu"
        aria-expanded={open}
        aria-controls="menu-drawer"
        onClick={() => {
          setTrail([{ id: "root" }]);
          setOpen(true);
        }}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full md:hidden"
      >
        <Menu aria-hidden="true" size={22} />
      </button>
      {/* The header's backdrop blur would clip a fixed child, so the drawer renders on body. */}
      {open
        ? createPortal(
            <div
              id="menu-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              className="fixed inset-0 z-50 flex flex-col bg-background md:hidden"
              onClick={(event) => {
                if ((event.target as HTMLElement).closest("a")) setOpen(false);
              }}
            >
              <div className="flex h-16 items-center gap-2 border-b border-line px-3">
                {trail.length > 1 ? (
                  <button
                    type="button"
                    onClick={back}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full"
                    aria-label="Back"
                  >
                    <ChevronLeft aria-hidden="true" size={22} />
                  </button>
                ) : null}
                <p className="mr-auto px-2 font-display text-xl font-extrabold">{title}</p>
                <button
                  ref={close}
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full"
                  aria-label="Close the menu"
                >
                  <X aria-hidden="true" size={22} />
                </button>
              </div>
              <ul className="flex-1 overflow-y-auto pb-10 text-[15px]">
                {screen.id === "root" ? (
                  <>
                    {next("Countries", { id: "countries" })}
                    {next("Leagues & internationals", { id: "leagues" })}
                    {next("Clubs & academies", { id: "clubs" })}
                    {link("/matches", "All matches")}
                    {link("/matches?tickets=free", "Free entry matches")}
                    {link(email ? "/dashboard" : "/login", email ? "Your account" : "Sign in")}
                    {link("/get-listed", "List your club for free", true)}
                  </>
                ) : null}
                {screen.id === "countries"
                  ? menu.countries.map((item) =>
                      item.slug === "india" ? (
                        <li key={item.slug}>
                          <button
                            type="button"
                            className={cn(row, "text-left")}
                            onClick={() => go({ id: "india" })}
                          >
                            India
                            <ChevronRight aria-hidden="true" size={18} />
                          </button>
                        </li>
                      ) : (
                        <li key={item.slug}>
                          <Link href={`/country/${item.slug}`} className={row}>
                            {item.name}
                          </Link>
                        </li>
                      ),
                    )
                  : null}
                {screen.id === "india" ? (
                  <>
                    {link("/country/india", "All of India", true)}
                    {INDIA_STATES.map((item) => (
                      <li key={item.slug}>
                        <button
                          type="button"
                          className={cn(row, "text-left")}
                          onClick={() => go({ id: "state", slug: item.slug })}
                        >
                          {item.name}
                          <ChevronRight aria-hidden="true" size={18} />
                        </button>
                      </li>
                    ))}
                  </>
                ) : null}
                {screen.id === "state" && state ? (
                  <>
                    {link(`/country/india/state/${state.slug}`, `All of ${state.name}`, true)}
                    {state.cities.map((city) => (
                      <li key={city.slug}>
                        <Link href={`/country/india/${city.slug}`} className={row}>
                          {city.name}
                        </Link>
                      </li>
                    ))}
                  </>
                ) : null}
                {screen.id === "leagues" ? (
                  <>
                    {INTERNATIONAL.map((item) => (
                      <li key={item.href}>
                        <Link href={item.href} className={row}>
                          {item.label}
                        </Link>
                      </li>
                    ))}
                    {menu.leagues.map((league) => (
                      <li key={league.slug}>
                        <Link href={`/league/${league.slug}`} className={row}>
                          <span>
                            {league.name}
                            <span className="block text-xs text-muted">{league.seasonName}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                    {link("/leagues", "All leagues", true)}
                  </>
                ) : null}
                {screen.id === "clubs" ? (
                  <>
                    {CLUB_LINKS.map((item) => (
                      <li key={item.href}>
                        <Link href={item.href} className={row}>
                          {item.label}
                        </Link>
                      </li>
                    ))}
                    {link("/academies", "All clubs and academies")}
                    {link("/get-listed", "List your club for free", true)}
                  </>
                ) : null}
              </ul>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

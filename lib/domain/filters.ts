import { resolveAttendance, ticketSortRank } from "@/lib/domain/ticket-state";
import { formatDateKey } from "@/lib/domain/time";
import type {
  AttendanceState,
  CompetitionKind,
  MatchFormat,
  StoredMatch,
} from "@/lib/domain/types";

export const PAGE_SIZE = 12;

export type MatchSort = "featured" | "soonest" | "verified" | "tickets";

/** Shortcuts for the days people plan around, judged by the date at each ground. */
export type MatchWhen = "today" | "tomorrow" | "weekend";

export type MatchFilters = {
  q?: string;
  country?: string;
  city?: string;
  from?: string;
  to?: string;
  kind?: CompetitionKind;
  format?: MatchFormat;
  tickets?: string;
  when?: MatchWhen;
  sort: MatchSort;
  page: number;
};

const KINDS = new Set<CompetitionKind>(["international", "league", "domestic", "academy", "local"]);
const FORMATS = new Set<MatchFormat>(["test", "odi", "t20", "t10", "hundred", "other"]);
const SORTS = new Set<MatchSort>(["featured", "soonest", "verified", "tickets"]);
const WHENS = new Set<MatchWhen>(["today", "tomorrow", "weekend"]);

export const TICKET_QUERY: Record<string, AttendanceState> = {
  official: "OFFICIAL_LINK",
  partner: "AUTHORISED_PARTNER",
  alert: "REQUEST_ALERT",
  free: "FREE_ENTRY",
  sold_out: "SOLD_OUT",
  private: "PRIVATE_EVENT",
  cancelled: "CANCELLED",
  postponed: "POSTPONED",
};

export function parseFilters(input: Record<string, string | undefined>): MatchFilters {
  const kind =
    input.kind && KINDS.has(input.kind as CompetitionKind)
      ? (input.kind as CompetitionKind)
      : undefined;
  const format =
    input.format && FORMATS.has(input.format as MatchFormat)
      ? (input.format as MatchFormat)
      : undefined;
  const sort =
    input.sort && SORTS.has(input.sort as MatchSort) ? (input.sort as MatchSort) : "featured";
  const page = Math.max(1, Number.parseInt(input.page || "1", 10) || 1);
  const tickets = input.tickets && TICKET_QUERY[input.tickets] ? input.tickets : undefined;
  const when =
    input.when && WHENS.has(input.when as MatchWhen) ? (input.when as MatchWhen) : undefined;
  return {
    q: input.q?.trim() || undefined,
    country: input.country?.trim() || undefined,
    city: input.city?.trim() || undefined,
    from: input.from?.trim() || undefined,
    to: input.to?.trim() || undefined,
    kind,
    format,
    tickets,
    when,
    sort,
    page,
  };
}

/** True when anything narrows the list, so the view is not the plain directory. */
export function isFiltered(filters: MatchFilters) {
  return Boolean(
    filters.q ||
    filters.country ||
    filters.city ||
    filters.from ||
    filters.to ||
    filters.kind ||
    filters.format ||
    filters.tickets ||
    filters.when ||
    filters.sort !== "featured",
  );
}

export function filtersToQuery(filters: MatchFilters, overrides: Partial<MatchFilters> = {}) {
  const next = { ...filters, ...overrides };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.country) params.set("country", next.country);
  if (next.city) params.set("city", next.city);
  if (next.from) params.set("from", next.from);
  if (next.to) params.set("to", next.to);
  if (next.kind) params.set("kind", next.kind);
  if (next.format) params.set("format", next.format);
  if (next.tickets) params.set("tickets", next.tickets);
  if (next.when) params.set("when", next.when);
  if (next.sort !== "featured") params.set("sort", next.sort);
  if (next.page > 1) params.set("page", String(next.page));
  const query = params.toString();
  return query ? `?${query}` : "";
}

function haystack(match: StoredMatch) {
  return [
    match.homeName,
    match.awayName,
    match.competitionName,
    match.venueName,
    match.cityName,
    match.countryName,
  ]
    .join(" ")
    .toLowerCase();
}

/** Upcoming: not yet six hours past its start, or postponed. */
export function inDefaultWindow(match: StoredMatch, now: Date) {
  if (match.status === "postponed") return true;
  return new Date(match.startsAt).getTime() >= now.getTime() - 6 * 60 * 60 * 1000;
}

function shiftDay(key: string, days: number) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day! + days)).toISOString().slice(0, 10);
}

/** The dates, at the ground, that `when` covers. A weekend seen on a Sunday is that Sunday. */
function wantedDays(when: MatchWhen, now: Date, timeZone: string) {
  const today = formatDateKey(now.toISOString(), timeZone);
  if (when === "today") return [today];
  if (when === "tomorrow") return [shiftDay(today, 1)];
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  if (weekday === 0) return [today];
  const saturday = shiftDay(today, 6 - weekday);
  return [saturday, shiftDay(saturday, 1)];
}

/** Whether a match is on during any of the days `when` covers. A Test runs for five days. */
export function playsOn(match: StoredMatch, when: MatchWhen, now: Date) {
  const first = formatDateKey(match.startsAt, match.timezone);
  const last = match.endsAt
    ? formatDateKey(match.endsAt, match.timezone)
    : match.format === "test"
      ? shiftDay(first, 4)
      : first;
  return wantedDays(when, now, match.timezone).some((day) => day >= first && day <= last);
}

export function filterMatches(matches: StoredMatch[], filters: MatchFilters, now: Date) {
  const query = filters.q?.toLowerCase();
  const wanted = filters.tickets ? TICKET_QUERY[filters.tickets] : undefined;
  const filtered = matches.filter((match) => {
    if (match.status === "draft" || match.status === "pending") return false;
    if (!match.sourceUrl) return false;
    if (filters.when) {
      if (match.status === "postponed" || !playsOn(match, filters.when, now)) return false;
    } else if (!filters.from && !filters.to && !inDefaultWindow(match, now)) return false;
    if (filters.country && match.countrySlug !== filters.country) return false;
    if (filters.city && match.citySlug !== filters.city) return false;
    if (filters.kind && match.kind !== filters.kind) return false;
    if (filters.format && match.format !== filters.format) return false;
    if (query && !haystack(match).includes(query)) return false;
    if (
      filters.from &&
      new Date(match.startsAt).getTime() < new Date(`${filters.from}T00:00:00.000Z`).getTime()
    ) {
      return false;
    }
    if (
      filters.to &&
      new Date(match.startsAt).getTime() > new Date(`${filters.to}T23:59:59.999Z`).getTime()
    ) {
      return false;
    }
    if (wanted && resolveAttendance(match, match.offers) !== wanted) return false;
    return true;
  });

  // A day's matches read best in the order they start.
  const sort = filters.when && filters.sort === "featured" ? "soonest" : filters.sort;
  const sorted = [...filtered].sort((a, b) => compareMatches(a, b, sort));
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const start = (page - 1) * PAGE_SIZE;
  return {
    items: sorted.slice(start, start + PAGE_SIZE),
    total: sorted.length,
    page,
    pageCount,
  };
}

function compareMatches(a: StoredMatch, b: StoredMatch, sort: MatchSort) {
  if (sort === "soonest") return +new Date(a.startsAt) - +new Date(b.startsAt);
  if (sort === "verified") {
    return +new Date(b.lastVerifiedAt || 0) - +new Date(a.lastVerifiedAt || 0);
  }
  if (sort === "tickets") {
    const rank =
      ticketSortRank(resolveAttendance(a, a.offers)) -
      ticketSortRank(resolveAttendance(b, b.offers));
    if (rank !== 0) return rank;
    return +new Date(a.startsAt) - +new Date(b.startsAt);
  }
  if (b.featuredRank !== a.featuredRank) return b.featuredRank - a.featuredRank;
  return +new Date(a.startsAt) - +new Date(b.startsAt) || a.slug.localeCompare(b.slug);
}

export function pickHero(matches: StoredMatch[], now: Date) {
  return matches
    .filter(
      (match) =>
        match.status === "published" &&
        match.sourceUrl &&
        new Date(match.startsAt).getTime() >= now.getTime() - 6 * 60 * 60 * 1000,
    )
    .sort(
      (a, b) => b.featuredRank - a.featuredRank || +new Date(a.startsAt) - +new Date(b.startsAt),
    )[0];
}

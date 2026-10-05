import { resolveAttendance, ticketSortRank } from "@/lib/domain/ticket-state";
import type {
  AttendanceState,
  CompetitionKind,
  MatchFormat,
  StoredMatch,
} from "@/lib/domain/types";

export const PAGE_SIZE = 12;

export type MatchSort = "featured" | "soonest" | "verified" | "tickets";

export type MatchFilters = {
  q?: string;
  country?: string;
  city?: string;
  from?: string;
  to?: string;
  kind?: CompetitionKind;
  format?: MatchFormat;
  tickets?: string;
  sort: MatchSort;
  page: number;
};

const KINDS = new Set<CompetitionKind>(["international", "league", "domestic", "academy"]);
const FORMATS = new Set<MatchFormat>(["test", "odi", "t20", "t10", "hundred", "other"]);
const SORTS = new Set<MatchSort>(["featured", "soonest", "verified", "tickets"]);

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
  const kind = input.kind && KINDS.has(input.kind as CompetitionKind)
    ? (input.kind as CompetitionKind)
    : undefined;
  const format = input.format && FORMATS.has(input.format as MatchFormat)
    ? (input.format as MatchFormat)
    : undefined;
  const sort = input.sort && SORTS.has(input.sort as MatchSort) ? (input.sort as MatchSort) : "featured";
  const page = Math.max(1, Number.parseInt(input.page || "1", 10) || 1);
  const tickets = input.tickets && TICKET_QUERY[input.tickets] ? input.tickets : undefined;
  return {
    q: input.q?.trim() || undefined,
    country: input.country?.trim() || undefined,
    city: input.city?.trim() || undefined,
    from: input.from?.trim() || undefined,
    to: input.to?.trim() || undefined,
    kind,
    format,
    tickets,
    sort,
    page,
  };
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

function inDefaultWindow(match: StoredMatch, now: Date) {
  if (match.status === "postponed") return true;
  return new Date(match.startsAt).getTime() >= now.getTime() - 6 * 60 * 60 * 1000;
}

export function filterMatches(matches: StoredMatch[], filters: MatchFilters, now: Date) {
  const query = filters.q?.toLowerCase();
  const wanted = filters.tickets ? TICKET_QUERY[filters.tickets] : undefined;
  const filtered = matches.filter((match) => {
    if (match.status === "draft" || match.status === "pending") return false;
    if (!match.sourceUrl) return false;
    if (!filters.from && !filters.to && !inDefaultWindow(match, now)) return false;
    if (filters.country && match.countrySlug !== filters.country) return false;
    if (filters.city && match.citySlug !== filters.city) return false;
    if (filters.kind && match.kind !== filters.kind) return false;
    if (filters.format && match.format !== filters.format) return false;
    if (query && !haystack(match).includes(query)) return false;
    if (filters.from && new Date(match.startsAt).getTime() < new Date(`${filters.from}T00:00:00.000Z`).getTime()) {
      return false;
    }
    if (filters.to && new Date(match.startsAt).getTime() > new Date(`${filters.to}T23:59:59.999Z`).getTime()) {
      return false;
    }
    if (wanted && resolveAttendance(match, match.offers) !== wanted) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => compareMatches(a, b, filters.sort));
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
      ticketSortRank(resolveAttendance(a, a.offers)) - ticketSortRank(resolveAttendance(b, b.offers));
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
      (a, b) =>
        b.featuredRank - a.featuredRank || +new Date(a.startsAt) - +new Date(b.startsAt),
    )[0];
}

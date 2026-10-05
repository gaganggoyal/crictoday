import type { MatchFormat, MatchStatus, TicketKind } from "@/lib/domain/types";

export type FixtureProviderName = "manual" | "sportmonks" | "ticketmaster";

export type NormalizedMatch = {
  externalId: string;
  provider: FixtureProviderName;
  competition: string;
  home: string;
  away: string;
  startsAt: string;
  timezone: string;
  venue: string;
  city: string;
  country: string;
  format: MatchFormat;
  status: MatchStatus;
  sourceUrl: string | null;
};

export type NormalizedTicketOffer = {
  externalId: string;
  sellerName: string;
  sellerDomain: string;
  url: string;
  kind: TicketKind;
  currency: string | null;
  priceFrom: number | null;
  status: "active" | "sold_out" | "expired" | "unknown";
  source: string | null;
};

export interface FixtureProvider {
  name: FixtureProviderName;
  fetchBetween(input: { from: Date; to: Date; competitionIds?: string[] }): Promise<NormalizedMatch[]>;
  fetchByExternalId(id: string): Promise<NormalizedMatch | null>;
}

export interface TicketProvider {
  name: string;
  findOffers(match: NormalizedMatch): Promise<NormalizedTicketOffer[]>;
  checkOffer(url: string): Promise<"active" | "sold_out" | "expired" | "unknown">;
}

export type SportMonksFixture = {
  id?: number | string;
  starting_at?: string;
  type?: string;
  status?: string;
  localteam?: { name?: string; code?: string };
  visitorteam?: { name?: string; code?: string };
  venue?: { name?: string; city?: string; country?: { name?: string } | string };
  league?: { name?: string; id?: number };
};

const FORMAT_MAP: Record<string, MatchFormat> = {
  test: "test",
  t20: "t20",
  t20i: "t20",
  odi: "odi",
  t10: "t10",
  hundred: "hundred",
  "the hundred": "hundred",
};

export function mapFormat(value: string | undefined): MatchFormat {
  if (!value) return "other";
  return FORMAT_MAP[value.trim().toLowerCase()] ?? "other";
}

export function mapProviderStatus(value: string | undefined): MatchStatus {
  const status = value?.toLowerCase() ?? "";
  if (status.includes("postpon")) return "postponed";
  if (status.includes("cancel") || status.includes("abandon")) return "cancelled";
  if (status.includes("finished") || status.includes("completed")) return "completed";
  return "published";
}

export function normalizeSportMonksFixture(raw: SportMonksFixture): NormalizedMatch | null {
  const home = raw.localteam?.name?.trim();
  const away = raw.visitorteam?.name?.trim();
  const start = raw.starting_at?.trim();
  if (!raw.id || !home || !away || !start || home.toLowerCase() === away.toLowerCase()) return null;
  const startsAt = start.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(start) ? new Date(start).toISOString() : `${start.replace(" ", "T")}Z`;
  if (Number.isNaN(new Date(startsAt).getTime())) return null;
  const country =
    typeof raw.venue?.country === "string"
      ? raw.venue.country
      : raw.venue?.country?.name || "Unknown";
  return {
    externalId: `sportmonks:${raw.id}`,
    provider: "sportmonks",
    competition: raw.league?.name?.trim() || "Cricket",
    home,
    away,
    startsAt,
    timezone: "UTC",
    venue: raw.venue?.name?.trim() || "Venue to be confirmed",
    city: raw.venue?.city?.trim() || "City to be confirmed",
    country,
    format: mapFormat(raw.type),
    status: mapProviderStatus(raw.status),
    sourceUrl: "https://www.sportmonks.com/",
  };
}

export type TicketmasterEvent = {
  id?: string;
  name?: string;
  url?: string;
  source?: string;
  dates?: { start?: { dateTime?: string }; status?: { code?: string } };
  _embedded?: {
    venues?: Array<{ name?: string; city?: { name?: string }; country?: { name?: string } }>;
  };
  priceRanges?: Array<{ min?: number; currency?: string }>;
};

const ACCEPTED_TICKETMASTER_SOURCES = new Set(["ticketmaster", "tdba"]);

export function normalizeTicketmasterEvent(raw: TicketmasterEvent): NormalizedTicketOffer | null {
  if (!raw.id || !raw.url || !raw.url.startsWith("https://")) return null;
  const source = raw.source?.toLowerCase() ?? "ticketmaster";
  if (!ACCEPTED_TICKETMASTER_SOURCES.has(source)) return null;
  if (/resale/i.test(raw.url) || /resale/i.test(raw.name || "")) return null;
  let host = "";
  try {
    host = new URL(raw.url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
  if (!/(^|\.)ticketmaster\.[a-z.]+$/.test(host) && !host.endsWith("livenation.com")) return null;
  const price = raw.priceRanges?.find((item) => item.currency && item.min != null);
  const code = raw.dates?.status?.code?.toLowerCase();
  const status = code === "offsale" ? "sold_out" : code === "cancelled" ? "expired" : "unknown";
  return {
    externalId: `ticketmaster:${raw.id}`,
    sellerName: "Ticketmaster",
    sellerDomain: host,
    url: raw.url,
    kind: "authorised_partner",
    currency: price?.currency ?? null,
    priceFrom: price?.min ?? null,
    status,
    source,
  };
}

export function shouldRetryStatus(status: number) {
  return status === 429 || status >= 500;
}

export type ExistingImportRow = {
  sourceExternalId: string | null;
  sourceType: "api" | "organiser" | "academy" | "admin";
  home: string;
  away: string;
  venue: string;
  competition: string;
  startsAt: string;
  id: string;
};

export function planImport(existing: ExistingImportRow[], incoming: NormalizedMatch[]) {
  const inserts: NormalizedMatch[] = [];
  const updates: Array<{ id: string; match: NormalizedMatch }> = [];
  const conflicts: Array<{ match: NormalizedMatch; existingId: string; reason: string }> = [];
  const seen = new Set<string>();

  for (const match of incoming) {
    if (seen.has(match.externalId)) continue;
    seen.add(match.externalId);
    const byId = existing.find((row) => row.sourceExternalId === match.externalId);
    if (byId) {
      if (byId.sourceType === "organiser" || byId.sourceType === "academy") {
        conflicts.push({
          match,
          existingId: byId.id,
          reason: "Provider id matches organiser-verified data.",
        });
      } else {
        updates.push({ id: byId.id, match });
      }
      continue;
    }
    const start = new Date(match.startsAt).getTime();
    const pair = [match.home, match.away]
      .map((name) => name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim())
      .sort()
      .join("|");
    const duplicate = existing.find((row) => {
      const rowPair = [row.home, row.away]
        .map((name) => name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim())
        .sort()
        .join("|");
      return rowPair === pair && Math.abs(new Date(row.startsAt).getTime() - start) <= 12 * 60 * 60 * 1000;
    });
    if (duplicate) {
      conflicts.push({
        match,
        existingId: duplicate.id,
        reason: "Same teams within 12 hours of an existing fixture. Left for moderation.",
      });
      continue;
    }
    inserts.push(match);
  }

  return { inserts, updates, conflicts };
}

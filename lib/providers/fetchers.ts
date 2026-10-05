import "server-only";
import type { FixtureProvider, NormalizedMatch, TicketProvider } from "@/lib/domain/providers";
import {
  normalizeSportMonksFixture,
  normalizeTicketmasterEvent,
  shouldRetryStatus,
  type SportMonksFixture,
  type TicketmasterEvent,
} from "@/lib/domain/providers";
import { matches } from "@/lib/data/seed";

async function fetchJson(url: string, attempt = 0): Promise<unknown> {
  const response = await fetch(url, { cache: "no-store" });
  if (shouldRetryStatus(response.status) && attempt < 2) {
    await new Promise((resolve) => setTimeout(resolve, 200 * 2 ** attempt));
    return fetchJson(url, attempt + 1);
  }
  if (!response.ok) {
    const error = new Error(`Provider returned ${response.status}.`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return response.json();
}

export function manualFixtureProvider(): FixtureProvider {
  const fetchBetween: FixtureProvider["fetchBetween"] = async ({ from, to }) =>
    matches
      .filter((match) => {
        const start = new Date(match.startsAt).getTime();
        return start >= from.getTime() && start <= to.getTime();
      })
      .map<NormalizedMatch>((match) => ({
        externalId: `manual:${match.id}`,
        provider: "manual",
        competition: match.competitionName,
        home: match.homeName,
        away: match.awayName,
        startsAt: match.startsAt,
        timezone: match.timezone,
        venue: match.venueName,
        city: match.cityName,
        country: match.countryName,
        format: match.format,
        status: match.status,
        sourceUrl: match.sourceUrl,
      }));

  return {
    name: "manual",
    fetchBetween,
    async fetchByExternalId(id: string) {
      const match = matches.find((item) => `manual:${item.id}` === id);
      if (!match) return null;
      const [found] = await fetchBetween({
        from: new Date(match.startsAt),
        to: new Date(match.startsAt),
      });
      return found ?? null;
    },
  };
}

export function sportMonksFixtureProvider(token = process.env.SPORTMONKS_API_TOKEN): FixtureProvider | null {
  if (!token) return null;
  return {
    name: "sportmonks",
    async fetchBetween({ from, to }) {
      const start = from.toISOString().slice(0, 10);
      const end = to.toISOString().slice(0, 10);
      const collected: NormalizedMatch[] = [];
      for (let page = 1; page <= 5; page += 1) {
        const url = new URL("https://cricket.sportmonks.com/api/v2.0/fixtures");
        url.searchParams.set("api_token", token);
        url.searchParams.set("include", "localteam,visitorteam,venue,league");
        url.searchParams.set("filter[starts_between]", `${start},${end}`);
        url.searchParams.set("page", String(page));
        const body = (await fetchJson(url.toString())) as { data?: SportMonksFixture[] };
        const rows = body.data ?? [];
        collected.push(
          ...rows
            .map((row) => normalizeSportMonksFixture(row))
            .filter((row): row is NormalizedMatch => Boolean(row)),
        );
        if (rows.length < 25) break;
      }
      return collected;
    },
    async fetchByExternalId(id: string) {
      const rawId = id.replace(/^sportmonks:/, "");
      const url = new URL(`https://cricket.sportmonks.com/api/v2.0/fixtures/${rawId}`);
      url.searchParams.set("api_token", token);
      url.searchParams.set("include", "localteam,visitorteam,venue,league");
      const body = (await fetchJson(url.toString())) as { data?: SportMonksFixture };
      return body.data ? normalizeSportMonksFixture(body.data) : null;
    },
  };
}

export function ticketmasterProvider(apiKey = process.env.TICKETMASTER_API_KEY): TicketProvider | null {
  if (!apiKey) return null;
  return {
    name: "ticketmaster",
    async findOffers(match) {
      const url = new URL("https://app.ticketmaster.com/discovery/v2/events.json");
      url.searchParams.set("apikey", apiKey);
      url.searchParams.set("keyword", `${match.home} ${match.away} cricket`);
      url.searchParams.set("classificationName", "sports");
      url.searchParams.set("startDateTime", new Date(new Date(match.startsAt).getTime() - 36 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, "Z"));
      url.searchParams.set("endDateTime", new Date(new Date(match.startsAt).getTime() + 36 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, "Z"));
      url.searchParams.set("size", "5");
      const body = (await fetchJson(url.toString())) as {
        _embedded?: { events?: TicketmasterEvent[] };
      };
      return (body._embedded?.events ?? [])
        .map((event) => normalizeTicketmasterEvent(event))
        .filter((event): event is NonNullable<typeof event> => Boolean(event));
    },
    async checkOffer(target) {
      const response = await fetch(target, { method: "GET", redirect: "manual" });
      if (response.status === 404 || response.status === 410) return "expired";
      if (response.status >= 200 && response.status < 400) return "active";
      return "unknown";
    },
  };
}

export function activeFixtureProviders() {
  return [manualFixtureProvider(), sportMonksFixtureProvider()].filter(
    (provider): provider is FixtureProvider => Boolean(provider),
  );
}

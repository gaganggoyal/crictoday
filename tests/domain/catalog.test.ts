import { describe, expect, it } from "vitest";
import { findDuplicateCandidates } from "@/lib/domain/duplicates";
import { filterMatches, parseFilters, pickHero } from "@/lib/domain/filters";
import { planImport, normalizeSportMonksFixture, normalizeTicketmasterEvent } from "@/lib/domain/providers";
import { priceLabel, resolveAttendance } from "@/lib/domain/ticket-state";
import { zonedTimeToUtc } from "@/lib/domain/time";
import { assertHttpsUrl } from "@/lib/domain/urls";
import type { StoredMatch, StoredOffer } from "@/lib/domain/types";
import { matches } from "@/lib/data/seed";
import { matchSubmissionSchema } from "@/lib/validation/schemas";

const now = new Date("2026-10-04T12:00:00.000Z");

function offer(patch: Partial<StoredOffer> = {}): StoredOffer {
  return {
    id: "offer-1",
    sellerName: "Board",
    sellerDomain: "tickets.demo.cricketmatch.today",
    url: "https://tickets.demo.cricketmatch.today/match",
    kind: "official",
    currency: "INR",
    priceFrom: 1500,
    status: "active",
    lastCheckedAt: "2026-10-03T12:00:00.000Z",
    approved: true,
    ...patch,
  };
}

describe("attendance and price", () => {
  it("uses one state and hides a price that was not checked in the last 7 days", () => {
    const match = matches.find((item) => item.slug === "india-vs-australia-1st-test-ahmedabad-2026-10-16");
    expect(match).toBeTruthy();
    expect(resolveAttendance(match!, match!.offers)).toBe("OFFICIAL_LINK");
    expect(priceLabel(match!.offers[0], now)).toContain("1,500");
    expect(priceLabel(offer({ lastCheckedAt: "2026-09-01T12:00:00.000Z" }), now)).toBeNull();
    expect(priceLabel(offer({ currency: null }), now)).toBeNull();
  });

  it("keeps cancelled, free, private and sold out ahead of a ticket link", () => {
    const base = matches[0];
    expect(resolveAttendance({ ...base, status: "cancelled" }, [offer()])).toBe("CANCELLED");
    expect(resolveAttendance({ ...base, status: "postponed" }, [offer()])).toBe("POSTPONED");
    expect(resolveAttendance({ ...base, attendanceType: "free" }, [])).toBe("FREE_ENTRY");
    expect(resolveAttendance({ ...base, attendanceType: "private" }, [])).toBe("PRIVATE_EVENT");
    expect(resolveAttendance(base, [offer({ status: "sold_out" })])).toBe("SOLD_OUT");
    expect(resolveAttendance(base, [offer({ approved: false })])).toBe("REQUEST_ALERT");
  });
});

describe("local time and urls", () => {
  it("converts 16 Oct 2026 09:30 in Kolkata to 04:00 UTC", () => {
    expect(zonedTimeToUtc("2026-10-16T09:30:00", "Asia/Kolkata")).toBe("2026-10-16T04:00:00.000Z");
  });

  it("accepts https and rejects shorteners, http and localhost", () => {
    expect(assertHttpsUrl("https://tickets.demo.cricketmatch.today/match")?.hostname).toBe(
      "tickets.demo.cricketmatch.today",
    );
    expect(assertHttpsUrl("http://tickets.demo.cricketmatch.today/match")).toBeNull();
    expect(assertHttpsUrl("https://bit.ly/abc")).toBeNull();
    expect(assertHttpsUrl("https://localhost/tickets")).toBeNull();
    expect(assertHttpsUrl("https://user:pass@example.com/tickets")).toBeNull();
  });
});

describe("catalog filters", () => {
  it("hides drafts and matches the hero fixture", () => {
    const hidden: StoredMatch = { ...matches[0], slug: "hidden-draft", status: "draft" };
    const result = filterMatches([hidden, ...matches], parseFilters({ q: "ahmedabad" }), now);
    expect(result.items.every((match) => match.citySlug === "ahmedabad")).toBe(true);
    expect(result.items.some((match) => match.status === "draft")).toBe(false);
    expect(pickHero(matches, now)?.slug).toBe("india-vs-australia-1st-test-ahmedabad-2026-10-16");
  });
});

describe("duplicates and import planning", () => {
  const existing = [
    {
      id: "seed-1",
      sourceExternalId: "sportmonks:1",
      sourceType: "api" as const,
      home: "India",
      away: "Australia",
      venue: "Narendra Modi Stadium",
      competition: "Test series",
      startsAt: "2026-10-16T04:00:00.000Z",
    },
    {
      id: "org-1",
      sourceExternalId: "sportmonks:9",
      sourceType: "organiser" as const,
      home: "Mumbai",
      away: "Karnataka",
      venue: "Wankhede",
      competition: "Ranji",
      startsAt: "2026-10-20T04:00:00.000Z",
    },
  ];

  it("updates an api id, conflicts with organiser data, and conflicts inside 12 hours", () => {
    const fresh = {
      externalId: "sportmonks:2",
      provider: "sportmonks" as const,
      competition: "Tour",
      home: "England",
      away: "New Zealand",
      startsAt: "2026-11-01T10:00:00.000Z",
      timezone: "UTC",
      venue: "Lord's",
      city: "London",
      country: "England",
      format: "test" as const,
      status: "published" as const,
      sourceUrl: "https://www.sportmonks.com/",
    };
    const plan = planImport(existing, [
      { ...fresh, externalId: "sportmonks:1", home: "India", away: "Australia", startsAt: "2026-10-16T05:00:00.000Z" },
      { ...fresh, externalId: "sportmonks:9", home: "Mumbai", away: "Karnataka" },
      { ...fresh, externalId: "sportmonks:3", home: "Australia", away: "India", startsAt: "2026-10-16T08:00:00.000Z" },
      fresh,
      fresh,
    ]);
    expect(plan.updates.map((item) => item.id)).toEqual(["seed-1"]);
    expect(plan.inserts.map((item) => item.externalId)).toEqual(["sportmonks:2"]);
    expect(plan.conflicts).toHaveLength(2);
    expect(findDuplicateCandidates(existing, {
      home: "Australia",
      away: "India",
      venue: "Other",
      competition: "Other",
      startsAt: "2026-10-16T06:00:00.000Z",
    })).toHaveLength(1);
  });
});

describe("provider normalizers", () => {
  it("drops incomplete fixtures and resale or off-host ticket offers", () => {
    expect(normalizeSportMonksFixture({ id: 1, localteam: { name: "India" } })).toBeNull();
    const fixture = normalizeSportMonksFixture({
      id: 42,
      starting_at: "2026-10-16 04:00:00",
      type: "T20I",
      status: "NS",
      localteam: { name: "India" },
      visitorteam: { name: "Australia" },
      venue: { name: "Wankhede", city: "Mumbai", country: "India" },
      league: { name: "T20I" },
    });
    expect(fixture?.externalId).toBe("sportmonks:42");
    expect(fixture?.format).toBe("t20");
    expect(
      normalizeTicketmasterEvent({
        id: "abc",
        url: "https://www.ticketmaster.co.uk/event/abc",
        source: "ticketmaster",
        name: "India vs Australia",
      })?.sellerDomain,
    ).toBe("ticketmaster.co.uk");
    expect(
      normalizeTicketmasterEvent({
        id: "resale",
        url: "https://www.ticketmaster.com/resale/abc",
        source: "ticketmaster",
      }),
    ).toBeNull();
    expect(
      normalizeTicketmasterEvent({
        id: "other",
        url: "https://www.example.com/event",
        source: "ticketmaster",
      }),
    ).toBeNull();
    expect(
      normalizeTicketmasterEvent({
        id: "feed",
        url: "https://www.ticketmaster.com/event/abc",
        source: "universe",
      }),
    ).toBeNull();
  });
});

describe("submission schema", () => {
  const valid = {
    organiserType: "club",
    contactEmail: "club@example.com",
    competition: "Local cup",
    homeTeam: "North",
    awayTeam: "South",
    startsAt: "2026-12-01T15:00",
    timezone: "Asia/Kolkata",
    venue: "Gymkhana",
    city: "Mumbai",
    country: "India",
    format: "t20",
    attendanceType: "ticketed",
    sourceUrl: "https://example.com/fixture",
    ticketUrl: "https://tickets.example.com/match",
    consent: "on",
  };

  it("rejects the same side, a shortener, and a missing consent", () => {
    expect(matchSubmissionSchema.safeParse({ ...valid, awayTeam: "North" }).success).toBe(false);
    expect(matchSubmissionSchema.safeParse({ ...valid, ticketUrl: "https://bit.ly/abc" }).success).toBe(false);
    expect(matchSubmissionSchema.safeParse({ ...valid, consent: false }).success).toBe(false);
    expect(matchSubmissionSchema.safeParse(valid).success).toBe(true);
  });
});

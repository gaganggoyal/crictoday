import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildFixtureMatches } from "@/lib/data/fixtures";
import type { StoredMatch, StoredOffer } from "@/lib/domain/types";
import {
  breadcrumbJsonLd,
  matchDescription,
  matchLabel,
  matchTitle,
  seriesName,
  sportsEventJsonLd,
  upcomingSummary,
} from "@/lib/seo";

const file = JSON.parse(readFileSync("data/fixtures/2026-27.json", "utf8"));

/** The real fixture file as the site lists it, each ticket link as an approved offer. */
const fixtures: StoredMatch[] = buildFixtureMatches(file).map(
  ({ slugBase, tickets, ...match }) => ({
    ...match,
    id: match.sourceExternalId,
    slug: slugBase,
    offers: tickets
      ? [
          {
            id: `offer-${slugBase}`,
            sellerName: tickets.sellerName,
            sellerDomain: tickets.sellerDomain,
            url: tickets.url,
            kind: "official",
            currency: null,
            priceFrom: null,
            status: tickets.status,
            lastCheckedAt: null,
            approved: true,
          },
        ]
      : [],
  }),
);

/** Before any match in the file starts. */
const before = new Date("2026-10-01T00:00:00Z");

function find(key: string) {
  const match = fixtures.find((item) => item.sourceExternalId === `fixtures:${key}`);
  if (!match) throw new Error(`No fixture ${key}`);
  return match;
}

describe("match titles and descriptions", () => {
  it("gives every real fixture its own title and description", () => {
    const titles = fixtures.map((match) => matchTitle(match, before));
    const descriptions = fixtures.map((match) => matchDescription(match, before));
    expect(fixtures.length).toBeGreaterThan(200);
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });

  it("leads with the teams, the match label, the town and the day", () => {
    const match = find("west-indies-in-india-2026-27:t20i-1");
    expect(matchLabel(match)).toBe("1st T20I");
    expect(seriesName(match)).toBe("West Indies tour of India");
    expect(matchTitle(match, before)).toBe(
      "India vs West Indies 1st T20I tickets – Lucknow, 6 Oct 2026",
    );
    expect(matchDescription(match, before)).toBe(
      "India vs West Indies, 1st T20I, at Ekana Cricket Stadium, Lucknow, Tue, 6 Oct 2026 at 19:00 local time. Official tickets from District by Zomato.",
    );
  });

  it("says when a match is postponed, cancelled or free", () => {
    const match = find("west-indies-in-india-2026-27:t20i-1");
    expect(matchTitle({ ...match, status: "postponed" }, before)).toBe(
      "India vs West Indies 1st T20I (postponed) – Lucknow",
    );
    expect(matchTitle({ ...match, status: "cancelled" }, before)).toBe(
      "India vs West Indies 1st T20I (cancelled) – Lucknow, 6 Oct 2026",
    );
    const free = { ...match, attendanceType: "free" as const, offers: [] };
    expect(matchTitle(free, before)).toBe("India vs West Indies 1st T20I – Lucknow, 6 Oct 2026");
    expect(matchDescription(free, before)).toMatch(/Free entry\.$/);
  });

  it("stops offering tickets once a match has started", () => {
    const match = find("west-indies-in-india-2026-27:t20i-1");
    const during = new Date("2026-10-06T15:00:00Z");
    const after = new Date("2026-10-07T00:00:00Z");
    expect(matchTitle(match, during)).toBe("India vs West Indies 1st T20I – Lucknow, 6 Oct 2026");
    expect(matchDescription(match, during)).toMatch(/local time\. This match is under way\.$/);
    expect(matchDescription(match, after)).toMatch(/local time\. This match is over\.$/);
    expect(sportsEventJsonLd(match, during)).not.toHaveProperty("offers");
  });
});

describe("structured data", () => {
  const match = find("west-indies-in-india-2026-27:t20i-1");

  it("marks a real, approved sale as an offer and nothing else", () => {
    const listed = sportsEventJsonLd(match, before);
    expect(listed).toMatchObject({
      "@type": "SportsEvent",
      name: "India vs West Indies, 1st T20I",
      eventStatus: "https://schema.org/EventScheduled",
      location: { address: { addressLocality: "Lucknow", addressRegion: "Uttar Pradesh" } },
      offers: {
        "@type": "Offer",
        url: match.offers[0]!.url,
        availability: "https://schema.org/InStock",
      },
    });
    expect(listed?.image[0]).toMatch(
      /\/og\/match\/india-vs-west-indies-1st-t20i-lucknow-2026-10-06$/,
    );

    const soldOut: StoredOffer = { ...match.offers[0]!, status: "sold_out" };
    expect(sportsEventJsonLd({ ...match, offers: [soldOut] }, before)?.offers?.availability).toBe(
      "https://schema.org/SoldOut",
    );
    expect(sportsEventJsonLd({ ...match, offers: [] }, before)).not.toHaveProperty("offers");
    expect(
      sportsEventJsonLd({ ...match, attendanceType: "free", offers: [] }, before),
    ).toMatchObject({
      isAccessibleForFree: true,
    });
  });

  it("numbers breadcrumbs and makes their links absolute", () => {
    const trail = breadcrumbJsonLd([
      { name: "Matches", path: "/matches" },
      { name: "India", path: "/country/india" },
    ]);
    expect(trail.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Matches", item: "http://localhost:3000/matches" },
      {
        "@type": "ListItem",
        position: 2,
        name: "India",
        item: "http://localhost:3000/country/india",
      },
    ]);
  });
});

describe("upcoming summaries", () => {
  it("counts what is still to come, with its grounds and dates", () => {
    const now = new Date("2026-10-01T00:00:00Z");
    const india = fixtures.filter(
      (match) => match.seasonSlug === "west-indies-tour-of-india-2026-27",
    );
    expect(upcomingSummary(india, now)).toMatch(
      /^\d+ upcoming matches at \d+ grounds, from 6 Oct 2026 to \d+ \w{3} 2026$/,
    );
    expect(upcomingSummary(india.slice(0, 1), now, { grounds: false })).toBe(
      "1 upcoming match, on 6 Oct 2026",
    );
    expect(upcomingSummary(india, new Date("2027-12-01T00:00:00Z"))).toBeNull();
  });
});

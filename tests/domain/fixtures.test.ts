import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildFixtureMatches } from "@/lib/data/fixtures";
import { countries, leagues } from "@/lib/data/seed";

const file = JSON.parse(readFileSync("data/fixtures/2026-27.json", "utf8"));

function find(sourceExternalId: string) {
  const match = buildFixtureMatches(file).find(
    (item) => item.sourceExternalId === sourceExternalId,
  );
  if (!match) throw new Error(`Missing ${sourceExternalId}`);
  return match;
}

describe("fixture files", () => {
  it("builds every fixture in the 2026-27 file", () => {
    const matches = buildFixtureMatches(file);
    expect(matches).toHaveLength(209);
    expect(new Set(matches.map((match) => match.slugBase)).size).toBe(matches.length);
    expect(matches.every((match) => match.sourceUrl?.startsWith("https://"))).toBe(true);
    expect(matches.every((match) => match.sourceType === "admin" && !match.demo)).toBe(true);
    expect(matches.filter((match) => match.tickets)).toHaveLength(145);
  });

  it("gives each official ticket link its seller, domain and sale state", () => {
    expect(find("fixtures:england-in-australia-2026-27:odi-2").tickets).toEqual({
      sellerName: "Ticketek",
      sellerDomain: "premier.ticketek.com.au",
      url: "https://premier.ticketek.com.au/shows/show.aspx?sh=ODIADO0127",
      status: "active",
      onSaleAt: null,
    });
    expect(find("fixtures:england-in-south-africa-2026-27:test-3").tickets).toMatchObject({
      sellerName: "Cricket South Africa",
      sellerDomain: "tickets.cricket.co.za",
      status: "sold_out",
    });
    // Referral parameters from Cricket Australia's links are dropped.
    const urls = buildFixtureMatches(file).flatMap((match) => match.tickets?.url ?? []);
    expect(urls.filter((url) => !url.startsWith("https://") || url.includes("did="))).toEqual([]);
  });

  it("uses a series' ticket link unless a match gives its own", () => {
    expect(find("fixtures:india-in-new-zealand-2026-27:t20i-1").tickets).toMatchObject({
      url: "https://tickets.nzc.nz/content/nzc/matches.aspx",
      status: "active",
    });
    expect(find("fixtures:india-in-new-zealand-2026-27:t20i-2").tickets?.status).toBe("sold_out");
    expect(find("fixtures:india-in-new-zealand-2026-27:t20i-3").tickets?.url).toBe(
      "https://tickets.nzc.nz/shows/show.aspx?sh=BCINT20327",
    );
  });

  it("turns a sale's local opening time into an instant", () => {
    // 3pm in Rawalpindi and 6pm in Chennai on 10 October.
    expect(find("fixtures:pakistan-odi-tri-series-2026:match-3").tickets).toMatchObject({
      sellerDomain: "pcb.tcs.com.pk",
      onSaleAt: "2026-10-10T10:00:00.000Z",
    });
    expect(find("fixtures:bbl-16:match-1").tickets?.onSaleAt).toBe("2026-10-10T12:30:00.000Z");
  });

  it("hides the Delhi ODI until the BCCI names another ground", () => {
    expect(find("fixtures:sri-lanka-in-india-2026-27:odi-1")).toMatchObject({
      status: "draft",
      tickets: null,
    });
  });

  it("rejects a ticket link that is not a full https address", () => {
    const insecure = structuredClone(file);
    insecure.series[0].matches[0].tickets = { seller: "Seller", url: "http://tickets.example.com" };
    expect(() => buildFixtureMatches(insecure)).toThrow();
    const shortened = structuredClone(file);
    shortened.series[0].matches[0].tickets = { seller: "Seller", url: "https://bit.ly/tickets" };
    expect(() => buildFixtureMatches(shortened)).toThrow(
      "west-indies-in-india-2026-27/t20i-1: the ticket link must be a full https address.",
    );
  });

  it("turns each ground's local start time into the right instant", () => {
    // Published local times: 7pm IST in Lucknow, 10:20am AWST in Perth, 8pm NZDT in Christchurch.
    expect(find("fixtures:west-indies-in-india-2026-27:t20i-1").startsAt).toBe(
      "2026-10-06T13:30:00.000Z",
    );
    expect(find("fixtures:new-zealand-in-australia-2026-27:test-1").startsAt).toBe(
      "2026-12-09T02:20:00.000Z",
    );
    expect(find("fixtures:india-in-new-zealand-2026-27:t20i-1").startsAt).toBe(
      "2026-10-22T07:00:00.000Z",
    );
    expect(find("fixtures:australia-in-india-2026-27:test-3").startsAt).toBe(
      "2027-02-11T03:30:00.000Z",
    );
    const chennai = find("fixtures:bbl-16:match-1");
    expect(chennai).toMatchObject({
      startsAt: "2026-12-12T09:10:00.000Z",
      timezone: "Asia/Kolkata",
      countrySlug: "india",
      competitionName: "Big Bash League, Match 1",
      seasonSlug: "bbl-2026-27",
    });
  });

  it("names each match and keeps its slug readable", () => {
    const match = find("fixtures:west-indies-in-india-2026-27:t20i-1");
    expect(match.competitionName).toBe("West Indies tour of India, 1st T20I");
    expect(match.slugBase).toBe("india-vs-west-indies-1st-t20i-lucknow-2026-10-06");
    expect(match.venueAddress).toBe("Lucknow, India");
  });

  it("only lists countries and leagues the site has pages for", () => {
    const matches = buildFixtureMatches(file);
    const countrySlugs = new Set(countries.map((country) => country.slug));
    expect(matches.filter((match) => !countrySlugs.has(match.countrySlug))).toEqual([]);
    for (const match of matches.filter((item) => item.kind === "league")) {
      const league = leagues.find((item) => item.slug === match.competitionSlug);
      expect(league?.seasonSlug).toBe(match.seasonSlug);
    }
  });

  it("rejects unknown teams and grounds with the fixture's name", () => {
    const broken = structuredClone(file);
    broken.series[0].matches[0].home = "nobody";
    broken.series[0].matches[1].venue = "nowhere";
    expect(() => buildFixtureMatches(broken)).toThrow(
      /west-indies-in-india-2026-27\/t20i-1: no team "nobody"[\s\S]*t20i-2: no ground "nowhere"/,
    );
  });

  it("rejects a check time in the future", () => {
    const future = structuredClone(file);
    future.checkedAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    expect(() => buildFixtureMatches(future)).toThrow(/checkedAt cannot be in the future/);
  });

  it("rejects a start time without the local date and time", () => {
    const broken = structuredClone(file);
    broken.series[0].matches[0].start = "2026-10-06";
    expect(() => buildFixtureMatches(broken)).toThrow(/local time/);
  });
});

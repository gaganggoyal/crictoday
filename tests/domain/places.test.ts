import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildFixtureMatches } from "@/lib/data/fixtures";
import { INDIA_STATES, POPULAR_CITIES, indiaCity, placeState, stateOfCity } from "@/lib/data/india";
import { matches as seedMatches } from "@/lib/data/seed";

describe("India's states and towns", () => {
  it("lists 28 states and 8 union territories, each with a town", () => {
    expect(INDIA_STATES.filter((state) => !state.territory)).toHaveLength(28);
    expect(INDIA_STATES.filter((state) => state.territory)).toHaveLength(8);
    expect(INDIA_STATES.every((state) => state.cities.length > 0)).toBe(true);
  });

  it("gives every town one state, so a city page has one parent", () => {
    const slugs = INDIA_STATES.flatMap((state) => state.cities.map((city) => city.slug));
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(stateOfCity("mumbai")?.name).toBe("Maharashtra");
    expect(stateOfCity("delhi")?.name).toBe("Delhi");
    expect(indiaCity("chhatrapati-sambhajinagar")?.name).toBe("Chhatrapati Sambhajinagar");
    expect(stateOfCity("sangamner")).toBeNull();
    expect(POPULAR_CITIES.map((city) => city.stateSlug)).not.toContain(undefined);
  });

  it("puts every Indian fixture in its state", () => {
    const fixtures = buildFixtureMatches(
      JSON.parse(readFileSync("data/fixtures/2026-27.json", "utf8")),
    );
    const indian = fixtures.filter((match) => match.countrySlug === "india");
    expect(indian.length).toBeGreaterThan(0);
    expect(indian.filter((match) => !match.stateSlug)).toEqual([]);
    expect(
      fixtures.find(
        (match) => match.sourceExternalId === "fixtures:west-indies-in-india-2026-27:t20i-1",
      ),
    ).toMatchObject({ stateName: "Uttar Pradesh", stateSlug: "uttar-pradesh" });
    expect(fixtures.filter((match) => match.countrySlug !== "india" && match.stateSlug)).toEqual(
      [],
    );
  });

  it("reads a stored state first, then the town list, and never outside India", () => {
    expect(
      placeState({ countrySlug: "india", citySlug: "sangamner", stateSlug: "maharashtra" })?.name,
    ).toBe("Maharashtra");
    expect(placeState({ countrySlug: "india", citySlug: "indore", stateSlug: null })?.name).toBe(
      "Madhya Pradesh",
    );
    expect(placeState({ countrySlug: "australia", citySlug: "perth", stateSlug: null })).toBeNull();
    const mumbai = seedMatches.find((match) => match.citySlug === "mumbai");
    expect(mumbai?.stateSlug).toBe("maharashtra");
  });
});

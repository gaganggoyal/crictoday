import type { MetadataRoute } from "next";
import { getDirectory } from "@/lib/data/catalog";
import { INDIA_STATES } from "@/lib/data/india";
import { profilePath } from "@/lib/domain/profiles";
import { siteUrl } from "@/lib/utils";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const directory = await getDirectory();
  const root = siteUrl();
  const citiesWithListings = new Set(
    [...directory.matches, ...directory.academies].map(
      (item) => `/country/${item.countrySlug}/${item.citySlug}`,
    ),
  );
  const staticPaths = [
    "",
    "/matches",
    "/countries",
    "/leagues",
    "/academies",
    "/get-listed",
    "/submit/match",
    "/submit/academy",
    "/legal/terms",
    "/legal/privacy",
    "/legal/ticket-policy",
    "/about/demo-data",
  ];
  const urls = [
    ...staticPaths.map((path) => ({ url: `${root}${path || "/"}`, lastModified: new Date() })),
    ...directory.matches.map((match) => ({
      url: `${root}/match/${match.slug}`,
      lastModified: match.lastVerifiedAt ? new Date(match.lastVerifiedAt) : new Date(),
    })),
    ...directory.countries.map((country) => ({ url: `${root}/country/${country.slug}` })),
    ...directory.leagues.flatMap((league) => [
      { url: `${root}/league/${league.slug}` },
      { url: `${root}/league/${league.slug}/${league.seasonSlug}` },
    ]),
    ...directory.academies.map((academy) => ({ url: `${root}${profilePath(academy)}` })),
    ...INDIA_STATES.map((state) => ({ url: `${root}/country/india/state/${state.slug}` })),
    // City pages with something listed; empty ones exist for clubs to start from but stay out.
    ...[...citiesWithListings].map((path) => ({ url: `${root}${path}` })),
  ];
  return urls;
}

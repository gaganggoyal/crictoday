import type { MetadataRoute } from "next";
import { getDirectory } from "@/lib/data/catalog";
import { siteUrl } from "@/lib/utils";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const directory = await getDirectory();
  const root = siteUrl();
  const staticPaths = [
    "",
    "/matches",
    "/countries",
    "/leagues",
    "/academies",
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
    ...directory.academies.map((academy) => ({ url: `${root}/academy/${academy.slug}` })),
  ];
  return urls;
}

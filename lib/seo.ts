import type { Metadata } from "next";
import type { StoredMatch } from "@/lib/domain/types";
import { siteUrl } from "@/lib/utils";

export function pageMetadata(
  title: string,
  description: string,
  path: string,
  index = true,
): Metadata {
  const url = `${siteUrl()}${path}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: index ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: { title, description, url, siteName: "cricketmatch.today", type: "website" },
  };
}

export function sportsEventJsonLd(match: StoredMatch) {
  if (!match.sourceUrl || !match.startsAt || !match.venueName) return null;
  const status =
    match.status === "cancelled"
      ? "https://schema.org/EventCancelled"
      : match.status === "postponed"
        ? "https://schema.org/EventPostponed"
        : "https://schema.org/EventScheduled";
  return {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `${match.homeName} vs ${match.awayName}`,
    startDate: match.startsAt,
    eventStatus: status,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    sport: "Cricket",
    url: `${siteUrl()}/match/${match.slug}`,
    location: {
      "@type": "Place",
      name: match.venueName,
      address: {
        "@type": "PostalAddress",
        streetAddress: match.venueAddress,
        addressLocality: match.cityName,
        addressCountry: match.countryName,
      },
    },
    homeTeam: { "@type": "SportsTeam", name: match.homeName },
    awayTeam: { "@type": "SportsTeam", name: match.awayName },
    organizer: { "@type": "Organization", name: match.competitionName },
  };
}

export function jsonLdScript(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

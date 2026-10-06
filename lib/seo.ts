import type { Metadata } from "next";
import { imageSrc, socialImageSrc } from "@/lib/domain/media";
import type { StoredAcademy, StoredMatch } from "@/lib/domain/types";
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

/** schema.org data for a club or academy profile. */
export function profileJsonLd(profile: StoredAcademy, path: string) {
  const sameAs = [
    profile.website,
    profile.links.instagram,
    profile.links.facebook,
    profile.links.youtube,
  ].filter(Boolean);
  const images = [profile.cover, ...profile.photos]
    .filter((image) => image !== null)
    .map((image) => `${siteUrl()}${imageSrc(image)}`);
  return {
    "@context": "https://schema.org",
    "@type": profile.kind === "ground" ? "SportsActivityLocation" : "SportsOrganization",
    name: profile.name,
    description: profile.description,
    sport: "Cricket",
    url: `${siteUrl()}${path}`,
    ...(profile.contactEmail ? { email: profile.contactEmail } : {}),
    ...(profile.phone ? { telephone: profile.phone } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    ...(profile.logo ? { logo: `${siteUrl()}${imageSrc(profile.logo)}` } : {}),
    ...(images.length ? { image: images } : {}),
    address: {
      "@type": "PostalAddress",
      streetAddress: profile.address,
      addressLocality: profile.cityName,
      ...(profile.stateName ? { addressRegion: profile.stateName } : {}),
      addressCountry: profile.countryName,
    },
  };
}

/**
 * A profile page's metadata, with its cover photo (or else its logo) as the link preview that
 * WhatsApp, Facebook and X show. The preview is a JPEG copy, which every chat app reads.
 */
export function profileMetadata(profile: StoredAcademy, title: string, path: string): Metadata {
  const metadata = pageMetadata(title, profile.description, path);
  const picture = profile.cover ?? profile.logo;
  if (!picture) return metadata;
  const scale = Math.min(1, 1200 / Math.max(picture.width, picture.height));
  return {
    ...metadata,
    openGraph: {
      ...metadata.openGraph,
      images: [
        {
          url: `${siteUrl()}${socialImageSrc(picture)}`,
          width: Math.round(picture.width * scale),
          height: Math.round(picture.height * scale),
          alt: profile.cover ? profile.name : `${profile.name} logo`,
        },
      ],
    },
    twitter: { card: profile.cover ? "summary_large_image" : "summary" },
  };
}

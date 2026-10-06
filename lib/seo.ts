import type { Metadata } from "next";
import { CONTACT_EMAIL, FOUNDERS } from "@/lib/company";
import { imageSrc, socialImageSrc } from "@/lib/domain/media";
import { primaryOffer, priceLabel, resolveAttendance } from "@/lib/domain/ticket-state";
import type { AttendanceState, StoredAcademy, StoredMatch, StoredOffer } from "@/lib/domain/types";
import { siteUrl } from "@/lib/utils";

export type SocialImage = { url: string; width: number; height: number; alt: string };

/** The branded picture a shared link shows when the page has none of its own. */
export function siteSocialImage(): SocialImage {
  return {
    url: `${siteUrl()}/og/site`,
    width: 1200,
    height: 630,
    alt: "cricketmatch.today: cricket matches today, fixtures and official tickets",
  };
}

export function pageMetadata(
  title: string,
  description: string,
  path: string,
  index = true,
  image: SocialImage = siteSocialImage(),
): Metadata {
  const url = `${siteUrl()}${path}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: index ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: {
      title,
      description,
      url,
      siteName: "cricketmatch.today",
      type: "website",
      locale: "en_IN",
      images: [image],
    },
  };
}

/** "1st T20I" from "West Indies tour of India, 1st T20I", or null when there is no label. */
export function matchLabel(match: Pick<StoredMatch, "competitionName">) {
  const at = match.competitionName.lastIndexOf(", ");
  return at === -1 ? null : match.competitionName.slice(at + 2);
}

/** "West Indies tour of India" from "West Indies tour of India, 1st T20I". */
export function seriesName(match: Pick<StoredMatch, "competitionName">) {
  const at = match.competitionName.lastIndexOf(", ");
  return at === -1 ? match.competitionName : match.competitionName.slice(0, at);
}

/** "India vs West Indies, 1st T20I", or just the teams. */
export function matchName(match: StoredMatch) {
  const label = matchLabel(match);
  return `${match.homeName} vs ${match.awayName}${label ? `, ${label}` : ""}`;
}

function dayAt(match: StoredMatch, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-GB", { ...options, timeZone: match.timezone }).format(
    new Date(match.startsAt),
  );
}

/** "Tue, 6 Oct 2026 at 19:00", in the ground's time zone. */
export function groundTime(match: StoredMatch) {
  const day = dayAt(match, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const time = dayAt(match, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return `${day} at ${time}`;
}

/**
 * A title no other match shares: the teams, the match label, the town and the day, as in
 * "India vs West Indies 1st T20I tickets – Lucknow, 6 Oct 2026".
 */
export function matchTitle(match: StoredMatch, now: Date) {
  const state = resolveAttendance(match, match.offers, now);
  const label = matchLabel(match);
  const teams = `${match.homeName} vs ${match.awayName}${label ? ` ${label}` : ""}`;
  const day = dayAt(match, { day: "numeric", month: "short", year: "numeric" });
  if (state === "POSTPONED") return `${teams} (postponed) – ${match.cityName}`;
  if (state === "CANCELLED") return `${teams} (cancelled) – ${match.cityName}, ${day}`;
  // Once a match has started, its page is no longer the place to find tickets.
  const started = state === "IN_PLAY" || state === "FINISHED";
  const tickets = match.attendanceType === "ticketed" && !started ? " tickets" : "";
  return `${teams}${tickets} – ${match.cityName}, ${day}`;
}

function attendanceSentence(state: AttendanceState, offer: StoredOffer | null) {
  switch (state) {
    case "OFFICIAL_LINK":
      return offer ? `Official tickets from ${offer.sellerName}.` : "Official tickets on sale.";
    case "AUTHORISED_PARTNER":
      return offer
        ? `Tickets from ${offer.sellerName}, an authorised partner.`
        : "Tickets from an authorised partner.";
    case "SOLD_OUT":
      return "The official sale is sold out.";
    case "FREE_ENTRY":
      return "Free entry.";
    case "PRIVATE_EVENT":
      return "A private match, not open to the public.";
    case "CANCELLED":
      return "This match is cancelled.";
    case "POSTPONED":
      return "This match is postponed until a new date is confirmed.";
    case "IN_PLAY":
      return "This match is under way.";
    case "FINISHED":
      return "This match is over.";
    default:
      return "Tickets are not on sale here yet: get an email when an official link appears.";
  }
}

/** A description no other match shares, with the ground, the local start and how to get in. */
export function matchDescription(match: StoredMatch, now: Date) {
  const state = resolveAttendance(match, match.offers, now);
  const label = matchLabel(match);
  const what = label
    ? `${match.homeName} vs ${match.awayName}, ${label}`
    : `${match.homeName} vs ${match.awayName}, ${match.competitionName}`;
  const when = state === "POSTPONED" ? "" : `, ${groundTime(match)} local time`;
  return `${what}, at ${match.venueName}, ${match.cityName}${when}. ${attendanceSentence(state, primaryOffer(match.offers))}`;
}

/** Matches still to come: scheduled, and not more than six hours past their start. */
export function upcomingMatches(matches: StoredMatch[], now: Date) {
  return matches
    .filter(
      (match) =>
        match.status === "published" &&
        new Date(match.startsAt).getTime() >= now.getTime() - 6 * 60 * 60 * 1000,
    )
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
}

/**
 * "12 upcoming matches at 4 grounds, from 6 Oct 2026 to 20 Dec 2026", so that each place, league
 * and team describes itself in its own words. Null when nothing is coming up.
 */
export function upcomingSummary(matches: StoredMatch[], now: Date, { grounds = true } = {}) {
  const upcoming = upcomingMatches(matches, now);
  if (upcoming.length === 0) return null;
  const day = (match: StoredMatch) =>
    dayAt(match, { day: "numeric", month: "short", year: "numeric" });
  const from = day(upcoming[0]!);
  const to = day(upcoming[upcoming.length - 1]!);
  const venues = new Set(upcoming.map((match) => match.venueSlug)).size;
  const count = `${upcoming.length} upcoming ${upcoming.length === 1 ? "match" : "matches"}`;
  const where = grounds ? ` at ${venues} ${venues === 1 ? "ground" : "grounds"}` : "";
  return `${count}${where}, ${from === to ? `on ${from}` : `from ${from} to ${to}`}`;
}

/** The match's own link preview: teams, ground, date and ticket state. */
export function matchSocialImage(match: StoredMatch): SocialImage {
  return {
    url: `${siteUrl()}/og/match/${match.slug}`,
    width: 1200,
    height: 630,
    alt: `${matchName(match)} at ${match.venueName}, ${match.cityName}`,
  };
}

export function sportsEventJsonLd(match: StoredMatch, now: Date) {
  if (!match.sourceUrl || !match.startsAt || !match.venueName) return null;
  const state = resolveAttendance(match, match.offers, now);
  const status =
    match.status === "cancelled"
      ? "https://schema.org/EventCancelled"
      : match.status === "postponed"
        ? "https://schema.org/EventPostponed"
        : "https://schema.org/EventScheduled";
  const home = { "@type": "SportsTeam", name: match.homeName };
  const away = { "@type": "SportsTeam", name: match.awayName };
  const offer = primaryOffer(match.offers);
  const live = offer && (state === "OFFICIAL_LINK" || state === "AUTHORISED_PARTNER");
  const price = live ? priceLabel(offer, now) : null;
  return {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: matchName(match),
    description: matchDescription(match, now),
    image: [matchSocialImage(match).url],
    startDate: match.startsAt,
    ...(match.endsAt ? { endDate: match.endsAt } : {}),
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
        ...(match.stateName ? { addressRegion: match.stateName } : {}),
        addressCountry: match.countryName,
      },
    },
    homeTeam: home,
    awayTeam: away,
    competitor: [home, away],
    performer: [home, away],
    organizer: {
      "@type": "Organization",
      name: seriesName(match),
      ...(match.sourceUrl ? { url: match.sourceUrl } : {}),
    },
    ...(state === "FREE_ENTRY" ? { isAccessibleForFree: true } : {}),
    // Only a real, approved sale is an Offer; an alert or a "not yet on sale" page is not.
    ...(offer && (live || state === "SOLD_OUT")
      ? {
          offers: {
            "@type": "Offer",
            url: offer.url,
            availability: live ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
            ...(price && offer.currency && offer.priceFrom != null
              ? { price: offer.priceFrom, priceCurrency: offer.currency }
              : {}),
            seller: { "@type": "Organization", name: offer.sellerName },
          },
        }
      : {}),
  };
}

export function jsonLdScript(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/** cricketmatch.today itself, for the home and about pages. */
export function organizationJsonLd() {
  const root = siteUrl();
  return {
    "@type": "Organization",
    "@id": `${root}/#organization`,
    name: "cricketmatch.today",
    url: `${root}/`,
    logo: `${root}/brand/logo-512.png`,
    email: CONTACT_EMAIL,
    founder: FOUNDERS.map((person) => ({
      "@type": "Person",
      name: person.name,
      jobTitle: person.title,
    })),
  };
}

/** The site's name for search results, with the organisation that runs it. */
export function homeJsonLd() {
  const root = siteUrl();
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${root}/#website`,
        name: "cricketmatch.today",
        alternateName: ["cricketmatch", "Cricket Match Today"],
        url: `${root}/`,
        inLanguage: "en-IN",
        publisher: { "@id": `${root}/#organization` },
      },
      organizationJsonLd(),
    ],
  };
}

export type Crumb = { name: string; path: string };

/** A page's place in the site, from its section down to the page itself. */
export function breadcrumbJsonLd(crumbs: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: `${siteUrl()}${crumb.path}`,
    })),
  };
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

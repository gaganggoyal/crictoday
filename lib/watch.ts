import { siteUrl } from "@/lib/utils";

/**
 * Live streams with a page of their own, under /watch. A page plays its YouTube video only when
 * the visitor presses play, so until then it loads nothing from YouTube, as the privacy policy
 * promises.
 */
export type WatchPage = {
  slug: string;
  /** "India A vs Pakistan A", as the home page names it while it is live. */
  name: string;
  /** "IND A vs PAK A", for phones. */
  short: string;
  youtubeId: string;
  video: {
    /** Our name for the video, for search results. */
    name: string;
    description: string;
    /** The YouTube channel that streams it. */
    channel: string;
    channelUrl: string;
    /** When the channel published it, from YouTube. */
    uploadedAt: string;
  };
  /** When the stream went live on YouTube. */
  liveFrom: string;
  /** When the match should be over, with time to spare. After this the page stops saying live. */
  liveUntil: string;
  /** When the page's facts were last compared with their sources. */
  checkedAt: string;
  match: {
    name: string;
    description: string;
    /** The scheduled start of play, in UTC. */
    startsAt: string;
    timezone: string;
    venue: string;
    city: string;
    /** ISO 3166 code, for schema.org addresses. */
    countryCode: string;
    teams: [string, string];
    organizer: string;
    tournament: { name: string; startDate: string; endDate: string };
  };
  /** The link preview's text, drawn by /og/watch/[slug]. */
  card: { kicker: string; title: string; lines: string[] };
};

export const IND_A_V_PAK_A_2026: WatchPage = {
  slug: "india-a-vs-pakistan-a-asia-cup-rising-stars-2026",
  name: "India A vs Pakistan A",
  short: "IND A vs PAK A",
  youtubeId: "yG06f6yORy4",
  video: {
    name: "India A vs Pakistan A live stream, Asia Cup Rising Stars 2026",
    description:
      "IND A vs PAK A live from Doha: a live score and fan chat stream of India A vs Pakistan A, Match 8 of the ACC Men's Asia Cup Rising Stars 2026, from the KM PUNK YouTube channel.",
    channel: "KM PUNK",
    channelUrl: "https://www.youtube.com/@KMPUNK",
    uploadedAt: "2026-11-22T09:09:46Z",
  },
  liveFrom: "2026-11-22T09:25:22Z",
  liveUntil: "2026-11-22T19:00:00Z",
  checkedAt: "2026-11-22T12:20:00Z",
  match: {
    name: "India A vs Pakistan A, Match 8, Asia Cup Rising Stars 2026",
    description:
      "India A play Pakistan A in Group B of the ACC Men's Asia Cup Rising Stars 2026, a 50-over match at the West End Park International Cricket Stadium, Doha, starting at 1pm local time (3:30pm IST).",
    // 1pm in Doha, which is UTC+3 all year.
    startsAt: "2026-11-22T10:00:00Z",
    timezone: "Asia/Qatar",
    venue: "West End Park International Cricket Stadium",
    city: "Doha",
    countryCode: "QA",
    teams: ["India A", "Pakistan A"],
    organizer: "Asian Cricket Council",
    tournament: {
      name: "ACC Men's Asia Cup Rising Stars 2026",
      startDate: "2026-11-19",
      endDate: "2026-11-29",
    },
  },
  card: {
    kicker: "Asia Cup Rising Stars 2026 · Group B",
    title: "India A vs Pakistan A",
    lines: [
      "West End Park International Cricket Stadium, Doha",
      "Sun 22 Nov · 1pm local, 3:30pm IST",
    ],
  },
};

export const WATCH_PAGES: WatchPage[] = [IND_A_V_PAK_A_2026];

export function watchPath(page: Pick<WatchPage, "slug">) {
  return `/watch/${page.slug}`;
}

export function findWatchPage(slug: string) {
  return WATCH_PAGES.find((page) => page.slug === slug) ?? null;
}

export type StreamState = "upcoming" | "live" | "ended";

export function streamState(
  page: Pick<WatchPage, "liveFrom" | "liveUntil">,
  now: Date,
): StreamState {
  const time = now.getTime();
  if (time < Date.parse(page.liveFrom)) return "upcoming";
  if (time < Date.parse(page.liveUntil)) return "live";
  return "ended";
}

/** Streams that are live now, soonest to end first, for the home page. */
export function liveStreams(now: Date) {
  return WATCH_PAGES.filter((page) => streamState(page, now) === "live").sort(
    (a, b) => Date.parse(a.liveUntil) - Date.parse(b.liveUntil),
  );
}

export function watchSocialImage(page: WatchPage) {
  return {
    url: `${siteUrl()}/og/watch/${page.slug}`,
    width: 1200,
    height: 630,
    alt: `${page.match.name}, at the ${page.match.venue}, ${page.match.city}`,
  };
}

/** schema.org data: the live stream as a VideoObject, and the match it shows as a SportsEvent. */
export function watchJsonLd(page: WatchPage) {
  const url = `${siteUrl()}${watchPath(page)}`;
  const image = watchSocialImage(page).url;
  const teams = page.match.teams.map((name) => ({ "@type": "SportsTeam", name }));
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "VideoObject",
        "@id": `${url}#video`,
        name: page.video.name,
        description: page.video.description,
        thumbnailUrl: [`https://i.ytimg.com/vi/${page.youtubeId}/hqdefault.jpg`, image],
        uploadDate: page.video.uploadedAt,
        embedUrl: `https://www.youtube.com/embed/${page.youtubeId}`,
        author: { "@type": "Organization", name: page.video.channel, url: page.video.channelUrl },
        publication: {
          "@type": "BroadcastEvent",
          isLiveBroadcast: true,
          startDate: page.liveFrom,
          endDate: page.liveUntil,
        },
        about: { "@id": `${url}#match` },
      },
      {
        "@type": "SportsEvent",
        "@id": `${url}#match`,
        name: page.match.name,
        description: page.match.description,
        image: [image],
        url,
        sport: "Cricket",
        startDate: page.match.startsAt,
        eventStatus: "https://schema.org/EventScheduled",
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        location: {
          "@type": "Place",
          name: page.match.venue,
          address: {
            "@type": "PostalAddress",
            addressLocality: page.match.city,
            addressCountry: page.match.countryCode,
          },
        },
        homeTeam: teams[0],
        awayTeam: teams[1],
        competitor: teams,
        performer: teams,
        organizer: { "@type": "Organization", name: page.match.organizer },
        superEvent: {
          "@type": "SportsEvent",
          name: page.match.tournament.name,
          startDate: page.match.tournament.startDate,
          endDate: page.match.tournament.endDate,
          location: {
            "@type": "Place",
            name: page.match.city,
            address: { "@type": "PostalAddress", addressCountry: page.match.countryCode },
          },
        },
      },
    ],
  };
}

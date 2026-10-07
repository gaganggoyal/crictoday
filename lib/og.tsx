import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { resolveAttendance } from "@/lib/domain/ticket-state";
import type { AttendanceState, StoredMatch } from "@/lib/domain/types";
import { groundTime, matchLabel, seriesName } from "@/lib/seo";

/** Link previews are 1200 by 630, the size WhatsApp, Facebook, X and LinkedIn all crop to. */
export const OG_SIZE = { width: 1200, height: 630 };

// Geist (SIL Open Font License, see assets/fonts/OFL.txt). The image renderer cannot read the
// site's WOFF2 fonts.
const fonts = Promise.all([
  readFile(join(process.cwd(), "assets/fonts/Geist-Medium.ttf")),
  readFile(join(process.cwd(), "assets/fonts/Geist-ExtraBold.ttf")),
]);

const BADGE: Record<AttendanceState, string> = {
  OFFICIAL_LINK: "Official tickets",
  AUTHORISED_PARTNER: "Authorised seller",
  REQUEST_ALERT: "Get a ticket alert",
  FREE_ENTRY: "Free entry",
  SOLD_OUT: "Sold out",
  PRIVATE_EVENT: "Private match",
  CANCELLED: "Cancelled",
  POSTPONED: "Postponed",
  IN_PLAY: "Under way",
  FINISHED: "Finished",
};

function clip(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function Card({
  kicker,
  title,
  lines,
  badge,
}: {
  kicker: string;
  title: string;
  lines: string[];
  badge: string | null;
}) {
  const size = title.length <= 22 ? 96 : title.length <= 34 ? 78 : 62;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "56px 72px",
        position: "relative",
        backgroundColor: "#105535",
        backgroundImage: "linear-gradient(135deg, #0b3a24 0%, #176b43 58%, #1f8352 100%)",
        color: "#f3f5ef",
        fontFamily: "Geist",
      }}
    >
      <div
        style={{
          position: "absolute",
          right: -70,
          top: -70,
          width: 250,
          height: 250,
          borderRadius: 9999,
          backgroundColor: "#d85f25",
        }}
      />
      <div style={{ display: "flex", alignItems: "center" }}>
        <svg width="60" height="60" viewBox="0 0 32 32">
          <rect width="32" height="32" rx="8" fill="#f3f5ef" />
          <rect x="8" y="9" width="2" height="13" rx="1" fill="#176B43" />
          <rect x="15" y="8" width="2" height="14" rx="1" fill="#176B43" />
          <rect x="22" y="9" width="2" height="13" rx="1" fill="#176B43" />
          <circle cx="25" cy="23" r="3.2" fill="#D85F25" />
        </svg>
        {/* One colour: the renderer opens a gap wherever a run of text changes style. */}
        <div style={{ display: "flex", marginLeft: 18, fontSize: 36, fontWeight: 800 }}>
          cricketmatch.today
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", maxWidth: 1040 }}>
        <div
          style={{
            display: "flex",
            fontSize: 26,
            fontWeight: 500,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: "rgba(243, 245, 239, 0.78)",
          }}
        >
          {clip(kicker, 56)}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 14,
            fontSize: size,
            fontWeight: 800,
            lineHeight: 1.02,
            letterSpacing: -2,
          }}
        >
          {clip(title, 60)}
        </div>
        {lines.map((line) => (
          <div
            key={line}
            style={{
              display: "flex",
              marginTop: 14,
              fontSize: 34,
              fontWeight: 500,
              color: "rgba(243, 245, 239, 0.9)",
            }}
          >
            {clip(line, 58)}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {badge ? (
          <div
            style={{
              display: "flex",
              backgroundColor: "#f3f5ef",
              color: "#105535",
              borderRadius: 9999,
              padding: "12px 28px",
              fontSize: 28,
              fontWeight: 800,
            }}
          >
            {badge}
          </div>
        ) : (
          <div style={{ display: "flex" }} />
        )}
        <div style={{ display: "flex", fontSize: 26, fontWeight: 500, color: "#d6e4d9" }}>
          Find the match. Feel the ground.
        </div>
      </div>
    </div>
  );
}

async function render(card: Parameters<typeof Card>[0], cacheControl: string) {
  const [medium, extraBold] = await fonts;
  return new ImageResponse(<Card {...card} />, {
    ...OG_SIZE,
    fonts: [
      { name: "Geist", data: medium, weight: 500, style: "normal" },
      { name: "Geist", data: extraBold, weight: 800, style: "normal" },
    ],
    headers: { "Cache-Control": cacheControl },
  });
}

/** The site's own preview, for pages without a picture of their own. */
export function siteImage() {
  return render(
    {
      kicker: "Internationals, leagues and local cricket",
      title: "Cricket matches today",
      lines: ["Fixtures, grounds and start times", "Official ticket links, checked by a person"],
      badge: "Free for clubs and academies",
    },
    "public, max-age=86400",
  );
}

/** A match's preview: teams, label, ground, local start and ticket state. */
export function matchImage(match: StoredMatch, now: Date) {
  const state = resolveAttendance(match, match.offers, now);
  const label = matchLabel(match);
  return render(
    {
      kicker: label ? `${label} · ${seriesName(match)}` : match.competitionName,
      title: `${match.homeName} vs ${match.awayName}`,
      lines: [
        `${match.venueName}, ${match.cityName}`,
        state === "POSTPONED" ? "New date to be confirmed" : `${groundTime(match)} local time`,
      ],
      badge: BADGE[state],
    },
    // Ticket states change, so chat apps and browsers may keep a preview for an hour at most.
    "public, max-age=3600, stale-while-revalidate=86400",
  );
}

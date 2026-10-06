import { toIcsUtc } from "@/lib/domain/time";
import type { MatchFormat, StoredMatch } from "@/lib/domain/types";

/** Typical playing time in minutes, used when a fixture has no end time. A Test's is one day. */
export const DAY_MINUTES: Record<MatchFormat, number> = {
  test: 480,
  odi: 480,
  t20: 210,
  t10: 120,
  hundred: 180,
  other: 240,
};

/** Minutes as an iCalendar duration (RFC 5545, 3.3.6), such as PT3H30M. */
function icsDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `PT${hours ? `${hours}H` : ""}${rest ? `${rest}M` : ""}`;
}

/** Escape an iCalendar TEXT value (RFC 5545, 3.3.11). */
export function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** Fold a content line at 75 octets without splitting a character (RFC 5545, 3.1). */
export function foldIcsLine(line: string) {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const width = encoder.encode(char).length;
    // A continuation line starts with a space, which counts toward its 75 octets.
    const limit = parts.length === 0 ? 75 : 74;
    if (size + width > limit) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += char;
    size += width;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export function matchCalendar(match: StoredMatch, site: string, now: Date) {
  const url = `${site}/match/${match.slug}`;
  const endsAt =
    match.endsAt && Date.parse(match.endsAt) > Date.parse(match.startsAt) ? match.endsAt : null;
  const status =
    match.status === "cancelled"
      ? "CANCELLED"
      : match.status === "postponed"
        ? "TENTATIVE"
        : "CONFIRMED";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//cricketmatch.today//EN",
    "BEGIN:VEVENT",
    `UID:${match.slug}@cricketmatch.today`,
    `DTSTAMP:${toIcsUtc(now.toISOString())}`,
    `DTSTART:${toIcsUtc(match.startsAt)}`,
    // A Test's calendar entry covers its first day.
    endsAt ? `DTEND:${toIcsUtc(endsAt)}` : `DURATION:${icsDuration(DAY_MINUTES[match.format])}`,
    `SUMMARY:${escapeIcsText(`${match.homeName} vs ${match.awayName}`)}`,
    `LOCATION:${escapeIcsText(`${match.venueName}, ${match.cityName}`)}`,
    `DESCRIPTION:${escapeIcsText(`${match.competitionName}. Ticket state and the latest check: ${url}`)}`,
    `URL:${url}`,
    `STATUS:${status}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}

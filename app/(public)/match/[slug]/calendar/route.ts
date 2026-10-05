import { getMatch } from "@/lib/data/catalog";
import { toIcsUtc } from "@/lib/domain/time";
import { siteUrl } from "@/lib/utils";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const match = await getMatch(slug);
  if (!match) return new Response("Not found", { status: 404 });
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//cricketmatch.today//EN",
    "BEGIN:VEVENT",
    `UID:${match.slug}@cricketmatch.today`,
    `DTSTAMP:${toIcsUtc(new Date().toISOString())}`,
    `DTSTART:${toIcsUtc(match.startsAt)}`,
    `SUMMARY:${match.homeName} vs ${match.awayName}`,
    `LOCATION:${match.venueName}, ${match.cityName}`,
    `URL:${siteUrl()}/match/${match.slug}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${match.slug}.ics"`,
    },
  });
}

import { getMatch } from "@/lib/data/catalog";
import { matchCalendar } from "@/lib/domain/calendar";
import { siteUrl } from "@/lib/utils";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const match = await getMatch(slug);
  if (!match) return new Response("Not found", { status: 404 });
  return new Response(matchCalendar(match, siteUrl(), new Date()), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${match.slug}.ics"`,
    },
  });
}

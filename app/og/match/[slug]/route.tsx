import { getMatch } from "@/lib/data/catalog";
import { matchImage } from "@/lib/og";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const match = await getMatch(slug);
  if (!match) {
    return new Response("Not found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  return matchImage(match);
}

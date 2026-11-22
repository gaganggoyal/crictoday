import { streamImage } from "@/lib/og";
import { findWatchPage } from "@/lib/watch";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = findWatchPage(slug);
  if (!page) {
    return new Response("Not found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  return streamImage(page.card);
}

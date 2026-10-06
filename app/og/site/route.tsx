import { siteImage } from "@/lib/og";

// The same picture for every page without its own, so it is drawn once, at build time.
export const dynamic = "force-static";

export function GET() {
  return siteImage();
}

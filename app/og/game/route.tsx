import { gameImage } from "@/lib/og";

// Mystery Cricketer's link preview never changes, so it is drawn once, at build time.
export const dynamic = "force-static";

export function GET() {
  return gameImage();
}

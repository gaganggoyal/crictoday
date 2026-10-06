import { dataMode } from "@/lib/data/mode";

/**
 * The time pages and workflows judge matches by. The demo catalogue is dated October 2026, so in
 * demo mode DEMO_NOW (an ISO time such as 2026-10-05T12:00:00Z) can pin it; the end-to-end tests
 * do. A database always runs on the real clock.
 */
export function currentTime() {
  const pinned = dataMode() === "demo" ? Date.parse(process.env.DEMO_NOW ?? "") : Number.NaN;
  return Number.isFinite(pinned) ? new Date(pinned) : new Date();
}

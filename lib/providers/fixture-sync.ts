import "server-only";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { buildFixtureMatches } from "@/lib/data/fixtures";
import { dataMode } from "@/lib/data/mode";
import { loadFixtures } from "@/lib/data/mysql/fixtures";
import { mysqlPool } from "@/lib/data/mysql/pool";
import { notifyListedAlerts } from "@/lib/data/mysql/writes";
import { deliverAlerts } from "@/lib/email/alerts";

const FIXTURE_DIR = path.join(process.cwd(), "data", "fixtures");

/**
 * Applies the fixture files deployed with the site, so new matches and ticket links go live
 * within the hour, ticket links with a sale time included. Then emails the alerts those links
 * answer. MySQL only.
 */
export async function syncFixtureFiles(now = new Date()) {
  if (dataMode() !== "mysql") return null;
  const pool = mysqlPool();
  const files = readdirSync(FIXTURE_DIR)
    .filter((name) => name.endsWith(".json"))
    .sort();
  const loaded = [];
  for (const file of files) {
    try {
      const fixtures = buildFixtureMatches(
        JSON.parse(readFileSync(path.join(FIXTURE_DIR, file), "utf8")),
      );
      const result = await loadFixtures(pool, fixtures, now);
      loaded.push({ file, ...result, skipped: result.skipped.length });
    } catch (error) {
      loaded.push({ file, error: error instanceof Error ? error.message : "Load failed." });
    }
  }
  const emails = await notifyListedAlerts(pool, now);
  const failed = await deliverAlerts(emails);
  return { files: loaded, alerts: emails.length, failedAlerts: failed };
}

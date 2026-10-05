import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import mysql, { type RowDataPacket } from "mysql2/promise";
import { DEFAULT_DENY_DOMAINS } from "@/lib/data/seed";

const MIGRATIONS = path.join(process.cwd(), "db", "mysql");

/** Apply db/mysql/*.sql in name order. Each file runs once and is recorded in schema_migrations. */
export async function migrate(url: string, log: (line: string) => void = console.log) {
  const connection = await mysql.createConnection({
    uri: url,
    multipleStatements: true,
    timezone: "Z",
  });
  try {
    await connection.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(80) NOT NULL PRIMARY KEY,
        applied_at DATETIME(3) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
    );
    const [rows] = await connection.query<RowDataPacket[]>("SELECT version FROM schema_migrations");
    const applied = new Set(rows.map((row) => String(row.version)));
    const files = readdirSync(MIGRATIONS)
      .filter((file) => file.endsWith(".sql"))
      .sort();
    for (const file of files) {
      if (applied.has(file)) continue;
      await connection.query(readFileSync(path.join(MIGRATIONS, file), "utf8"));
      await connection.query("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)", [
        file,
        new Date(),
      ]);
      log(`applied ${file}`);
    }
    // Link shorteners stay blocked as seller domains, whatever moderators approve later.
    await connection.query(
      "INSERT IGNORE INTO domain_rules (host, decision, created_at) VALUES ?",
      [DEFAULT_DENY_DOMAINS.map((host) => [host, "deny", new Date()])],
    );
  } finally {
    await connection.end();
  }
}

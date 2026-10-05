import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

const root = path.resolve(__dirname, "../..");

export const FAN = "11111111-1111-4111-8111-111111111111";
export const MOD = "22222222-2222-4222-8222-222222222222";
export const HOME = "33333333-3333-4333-8333-333333333333";
export const AWAY = "44444444-4444-4444-8444-444444444444";
export const COMP = "55555555-5555-4555-8555-555555555555";
export const VENUE = "66666666-6666-4666-8666-666666666666";
export const PUBLIC_MATCH = "77777777-7777-4777-8777-777777777777";
export const DRAFT_MATCH = "88888888-8888-4888-8888-888888888888";
export const UNSOURCED_MATCH = "99999999-9999-4999-8999-999999999999";

export async function database() {
  const db = new PGlite();
  await db.exec(readFileSync(path.join(root, "supabase/tests/bootstrap.sql"), "utf8"));
  await db.exec(
    readFileSync(path.join(root, "supabase/migrations/20261004120000_init.sql"), "utf8"),
  );
  await db.exec(
    readFileSync(
      path.join(root, "supabase/migrations/20261004180000_service_workflows.sql"),
      "utf8",
    ),
  );
  await db.exec(`
    INSERT INTO auth.users (id, email) VALUES
      ('${FAN}', 'fan@example.com'),
      ('${MOD}', 'mod@example.com');
    UPDATE profiles SET role = 'moderator' WHERE id = '${MOD}';

    INSERT INTO countries (iso2, name, slug, timezone_default)
    VALUES ('IN', 'India', 'india', 'Asia/Kolkata');
    INSERT INTO cities (country_id, name, slug)
    VALUES ((SELECT id FROM countries WHERE slug = 'india'), 'Ahmedabad', 'ahmedabad');
    INSERT INTO venues (id, city_id, name, slug, address, verification_status)
    VALUES (
      '${VENUE}',
      (SELECT id FROM cities WHERE slug = 'ahmedabad'),
      'Narendra Modi Stadium',
      'narendra-modi-stadium',
      'Ahmedabad',
      'verified'
    );
    INSERT INTO teams (id, name, slug, short_name) VALUES
      ('${HOME}', 'India', 'india', 'IND'),
      ('${AWAY}', 'Australia', 'australia', 'AUS');
    INSERT INTO competitions (id, name, slug, kind)
    VALUES ('${COMP}', 'Border-Gavaskar Trophy', 'border-gavaskar', 'international');
    INSERT INTO matches (
      id, slug, competition_id, home_team_id, away_team_id, venue_id,
      starts_at, source_timezone, format, status, attendance_type, source_type, source_url, source_label
    ) VALUES
      (
        '${PUBLIC_MATCH}', 'india-australia-public', '${COMP}', '${HOME}', '${AWAY}', '${VENUE}',
        '2026-10-16 04:00:00+00', 'Asia/Kolkata', 'test', 'published', 'ticketed', 'admin',
        'https://example.com/board', 'Board'
      ),
      (
        '${DRAFT_MATCH}', 'india-australia-draft', '${COMP}', '${HOME}', '${AWAY}', '${VENUE}',
        '2026-10-17 04:00:00+00', 'Asia/Kolkata', 'test', 'draft', 'ticketed', 'admin',
        'https://example.com/draft', 'Board'
      ),
      (
        '${UNSOURCED_MATCH}', 'india-australia-unsourced', '${COMP}', '${HOME}', '${AWAY}', '${VENUE}',
        '2026-10-18 04:00:00+00', 'Asia/Kolkata', 'test', 'published', 'ticketed', 'admin',
        NULL, 'Board'
      );
    INSERT INTO audit_log (actor_id, action, entity_type, entity_id)
    VALUES ('${MOD}', 'match.publish', 'match', '${PUBLIC_MATCH}');
  `);
  return db;
}

export async function asRole<T>(
  db: PGlite,
  role: "anon" | "authenticated",
  sub: string | null,
  run: () => Promise<T>,
) {
  await db.exec(`SET ROLE ${role}`);
  await db.exec(`SELECT set_config('request.jwt.claim.sub', '${sub ?? ""}', false)`);
  await db.exec(`SELECT set_config('request.jwt.claim.role', '${role}', false)`);
  try {
    return await run();
  } finally {
    await db.exec("RESET ROLE");
    await db.exec(`SELECT set_config('request.jwt.claim.sub', '', false)`);
    await db.exec(`SELECT set_config('request.jwt.claim.role', '', false)`);
  }
}

export async function asService<T>(db: PGlite, run: () => Promise<T>) {
  await db.exec("SET ROLE service_role");
  await db.exec(`SELECT set_config('request.jwt.claim.role', 'service_role', false)`);
  await db.exec(`SELECT set_config('request.jwt.claim.sub', '', false)`);
  try {
    return await run();
  } finally {
    await db.exec("RESET ROLE");
    await db.exec(`SELECT set_config('request.jwt.claim.role', '', false)`);
  }
}

import { describe, expect, it } from "vitest";
import { asRole, AWAY, COMP, database, FAN, HOME, MOD } from "@/tests/rls/harness";

describe("row level security", () => {
  it("lets an anonymous reader see only published matches that have a source", async () => {
    const db = await database();
    const rows = await asRole(db, "anon", null, async () => {
      const result = await db.query<{ slug: string }>("SELECT slug FROM matches ORDER BY slug");
      return result.rows;
    });
    expect(rows.map((row) => row.slug)).toEqual(["india-australia-public"]);
    const directory = await asRole(db, "anon", null, async () => {
      const result = await db.query<{ slug: string }>("SELECT slug FROM match_directory ORDER BY slug");
      return result.rows;
    });
    expect(directory.map((row) => row.slug)).toEqual(["india-australia-public"]);
    await db.close();
  });

  it("refuses anonymous inserts and anonymous audit reads", async () => {
    const db = await database();
    await expect(
      asRole(db, "anon", null, () =>
        db.query(`
          INSERT INTO matches (
            slug, competition_id, home_team_id, away_team_id, starts_at, source_timezone,
            format, status, attendance_type, source_type, source_url
          ) VALUES (
            'sneaky', '${COMP}', '${HOME}', '${AWAY}', '2026-11-01 00:00:00+00', 'UTC',
            't20', 'published', 'unknown', 'api', 'https://example.com/sneaky'
          )
        `),
      ),
    ).rejects.toThrow(/permission denied|row-level security/i);
    await expect(asRole(db, "anon", null, () => db.query("SELECT id FROM audit_log"))).rejects.toThrow(
      /permission denied/i,
    );
    await db.close();
  });

  it("stops a fan from changing their role and lets them change their display name", async () => {
    const db = await database();
    await expect(
      asRole(db, "authenticated", FAN, () => db.query(`UPDATE profiles SET role = 'admin' WHERE id = '${FAN}'`)),
    ).rejects.toThrow(/permission denied|role cannot be changed/i);
    await asRole(db, "authenticated", FAN, () =>
      db.query(`UPDATE profiles SET display_name = 'Asha' WHERE id = '${FAN}'`),
    );
    const profile = await db.query<{ display_name: string; role: string }>(
      `SELECT display_name, role::text AS role FROM profiles WHERE id = '${FAN}'`,
    );
    expect(profile.rows[0]).toMatchObject({ display_name: "Asha", role: "fan" });
    await db.close();
  });

  it("forces a submission created by a signed-in user to stay pending", async () => {
    const db = await database();
    const created = await asRole(db, "authenticated", FAN, () =>
      db.query<{ create_submission: string }>(
        `SELECT create_submission('match', '{"status":"approved"}'::jsonb) AS create_submission`,
      ),
    );
    const id = created.rows[0]?.create_submission;
    const row = await db.query<{ status: string }>(`SELECT status::text AS status FROM submissions WHERE id = '${id}'`);
    expect(row.rows[0]?.status).toBe("pending");
    await db.close();
  });

  it("lets a moderator read the audit log", async () => {
    const db = await database();
    const rows = await asRole(db, "authenticated", MOD, () => db.query("SELECT action FROM audit_log"));
    expect(rows.rows).toEqual([{ action: "match.publish" }]);
    await db.close();
  });
});

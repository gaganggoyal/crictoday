import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { asRole, asService, database, FAN, MOD, PUBLIC_MATCH } from "@/tests/rls/harness";

const HASH = "a".repeat(64);

describe("service role workflows", () => {
  it("hides review, role changes, and rate limits from anonymous and fan sessions", async () => {
    const db = await database();
    await expect(
      asRole(db, "anon", null, () =>
        db.query(`SELECT review_submission('${PUBLIC_MATCH}', 'approve', '', '', '${MOD}')`),
      ),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      asRole(db, "authenticated", FAN, () =>
        db.query(`SELECT set_user_role('${MOD}', 'admin', '${FAN}')`),
      ),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      asRole(db, "anon", null, () => db.query(`SELECT rate_limit_hit('${HASH}', 2, 60000)`)),
    ).rejects.toThrow(/permission denied/i);
    await db.close();
  });

  it("publishes a sourced organiser match, leaves corrections off the fixture, and keeps ticket links pending", async () => {
    const db = await database();
    const created = await asService(db, () =>
      db.query<{ create_submission: string }>(`
        SELECT create_submission('match', jsonb_build_object(
          'organiserType', 'club',
          'contactEmail', 'club@example.com',
          'competition', 'Ahmedabad Cup',
          'homeTeam', 'Gujarat',
          'awayTeam', 'Mumbai',
          'startsAt', '2026-12-01T09:30',
          'startsAtUtc', '2026-12-01T04:00:00.000Z',
          'timezone', 'Asia/Kolkata',
          'venue', 'Narendra Modi Stadium',
          'city', 'Ahmedabad',
          'country', 'India',
          'format', 't20',
          'attendanceType', 'ticketed',
          'sourceUrl', 'https://example.com/gujarat-mumbai',
          'ticketUrl', 'https://tickets.example.com/gujarat',
          'ticketSeller', 'Board box office',
          'status', 'approved'
        ), NULL) AS create_submission
      `),
    );
    const submissionId = created.rows[0]?.create_submission;
    const pending = await db.query<{ status: string }>(
      `SELECT status::text AS status FROM submissions WHERE id = '${submissionId}'`,
    );
    expect(pending.rows[0]?.status).toBe("pending");

    await asService(db, () =>
      db.query(`SELECT review_submission('${submissionId}', 'approve', '', '', '${MOD}')`),
    );
    const visible = await asRole(db, "anon", null, async () => {
      const result = await db.query<{ slug: string; offers: Array<{ approved: boolean }> }>(
        `SELECT slug, offers FROM match_directory WHERE slug LIKE 'gujarat%'`,
      );
      return result.rows;
    });
    expect(visible).toHaveLength(1);
    expect(visible[0]?.offers ?? []).toEqual([]);
    const offer = await db.query<{ status: string; approved_by: string | null }>(
      `SELECT status::text AS status, approved_by::text FROM ticket_offers ORDER BY created_at DESC LIMIT 1`,
    );
    expect(offer.rows[0]).toMatchObject({ status: "pending", approved_by: null });

    const before = await db.query<{ starts_at: string }>(
      `SELECT starts_at::text FROM matches WHERE id = '${PUBLIC_MATCH}'`,
    );
    const correction = await asService(db, () =>
      db.query<{ create_submission: string }>(`
        SELECT create_submission('correction', jsonb_build_object(
          'matchSlug', 'india-australia-public',
          'email', 'fan@example.com',
          'details', 'The start time on the page is an hour early.'
        ), '${FAN}') AS create_submission
      `),
    );
    await asService(db, () =>
      db.query(
        `SELECT review_submission('${correction.rows[0]?.create_submission}', 'approve', '', '', '${MOD}')`,
      ),
    );
    const after = await db.query<{ starts_at: string }>(
      `SELECT starts_at::text FROM matches WHERE id = '${PUBLIC_MATCH}'`,
    );
    expect(after.rows[0]?.starts_at).toBe(before.rows[0]?.starts_at);
    await db.close();
  });

  it("verifies an alert, approves the offer, and returns the ciphertext for the email", async () => {
    const db = await database();
    const offer = await db.query<{ id: string }>(`
      INSERT INTO ticket_offers (match_id, seller_name, seller_domain, url, kind, status)
      VALUES ('${PUBLIC_MATCH}', 'Board', 'tickets.example.com', 'https://tickets.example.com/ind-aus', 'official', 'pending')
      RETURNING id::text
    `);
    const request = await asService(db, () =>
      db.query<{ create_ticket_request: { id: string; already: boolean } }>(`
        SELECT create_ticket_request(
          'india-australia-public', '${"b".repeat(64)}', 'cipher-mail', 2, 'IN', '',
          '${"c".repeat(64)}', '${"d".repeat(64)}', '${FAN}'
        ) AS create_ticket_request
      `),
    );
    expect(request.rows[0]?.create_ticket_request.already).toBe(false);
    await asService(db, () =>
      db.query(`SELECT open_ticket_request('${"c".repeat(64)}', 'verify')`),
    );
    const approved = await asService(db, () =>
      db.query<{ approve_ticket_offer: { notified: number; emails: Array<{ to: string }> } }>(`
        SELECT approve_ticket_offer('${offer.rows[0]?.id}', 'india-australia-public', '${MOD}') AS approve_ticket_offer
      `),
    );
    expect(approved.rows[0]?.approve_ticket_offer.notified).toBe(1);
    expect(approved.rows[0]?.approve_ticket_offer.emails[0]?.to).toBe("cipher-mail");
    const listed = await asRole(db, "anon", null, async () => {
      const result = await db.query<{ offers: Array<{ sellerDomain: string }> }>(
        `SELECT offers FROM match_directory WHERE slug = 'india-australia-public'`,
      );
      return result.rows[0]?.offers;
    });
    expect(listed?.map((item) => item.sellerDomain)).toEqual(["tickets.example.com"]);
    const domain = await db.query<{ decision: string }>(
      `SELECT decision FROM domain_rules WHERE host = 'tickets.example.com'`,
    );
    expect(domain.rows[0]?.decision).toBe("allow");
    await db.close();
  });

  it("upserts a provider fixture without publishing a ticket offer, and shares a rate limit", async () => {
    const db = await database();
    const run = await asService(db, () =>
      db.query<{ begin_import_run: string }>(
        `SELECT begin_import_run('sportmonks') AS begin_import_run`,
      ),
    );
    expect(run.rows[0]?.begin_import_run).toBeTruthy();
    const applied = await asService(db, () =>
      db.query<{ apply_provider_plan: { inserted: number; skipped: number } }>(`
        SELECT apply_provider_plan(
          jsonb_build_array(jsonb_build_object(
            'externalId', 'sportmonks:501',
            'competition', 'Sheffield Shield',
            'home', 'Victoria',
            'away', 'Queensland',
            'startsAt', '2026-11-20T02:30:00.000Z',
            'timezone', 'Australia/Sydney',
            'venue', 'Junction Oval',
            'city', 'Melbourne',
            'country', 'Australia',
            'format', 'test',
            'status', 'published',
            'sourceUrl', 'https://www.sportmonks.com/'
          )),
          '[]'::jsonb
        ) AS apply_provider_plan
      `),
    );
    expect(applied.rows[0]?.apply_provider_plan.inserted).toBe(1);
    await db.exec(`UPDATE matches SET source_type = 'organiser' WHERE id = '${PUBLIC_MATCH}'`);
    const beforeProvider = await db.query<{ starts_at: string }>(
      `SELECT starts_at::text FROM matches WHERE id = '${PUBLIC_MATCH}'`,
    );
    const blocked = await asService(db, () =>
      db.query<{ apply_provider_plan: { inserted: number; skipped: number } }>(`
        SELECT apply_provider_plan(
          jsonb_build_array(jsonb_build_object(
            'externalId', 'sportmonks:502',
            'competition', 'Border-Gavaskar Trophy',
            'home', 'India',
            'away', 'Australia',
            'startsAt', '2026-10-16T06:00:00.000Z',
            'timezone', 'Asia/Kolkata',
            'venue', 'Narendra Modi Stadium',
            'city', 'Ahmedabad',
            'country', 'India',
            'format', 'test',
            'status', 'published',
            'sourceUrl', 'https://www.sportmonks.com/'
          )),
          jsonb_build_array(jsonb_build_object(
            'id', '${PUBLIC_MATCH}',
            'match', jsonb_build_object(
              'externalId', 'sportmonks:9',
              'startsAt', '2026-10-16T08:00:00.000Z',
              'status', 'postponed',
              'format', 'test',
              'timezone', 'Asia/Kolkata',
              'venue', 'Narendra Modi Stadium',
              'city', 'Ahmedabad',
              'country', 'India',
              'sourceUrl', 'https://example.com/board'
            )
          ))
        ) AS apply_provider_plan
      `),
    );
    expect(blocked.rows[0]?.apply_provider_plan.inserted).toBe(0);
    expect(blocked.rows[0]?.apply_provider_plan.skipped).toBeGreaterThanOrEqual(1);
    const unchanged = await db.query<{ starts_at: string; source_type: string }>(
      `SELECT starts_at::text, source_type::text FROM matches WHERE id = '${PUBLIC_MATCH}'`,
    );
    expect(unchanged.rows[0]?.source_type).toBe("organiser");
    expect(unchanged.rows[0]?.starts_at).toBe(beforeProvider.rows[0]?.starts_at);

    await asService(db, () =>
      db.query(`SELECT attach_pending_offers('sportmonks:501', jsonb_build_array(jsonb_build_object(
        'sellerName', 'Ticketmaster',
        'url', 'https://www.ticketmaster.com/victoria',
        'kind', 'authorised_partner',
        'currency', 'AUD',
        'priceFrom', '40',
        'status', 'active'
      )))`),
    );
    const hidden = await asRole(db, "anon", null, async () => {
      const result = await db.query<{ offers: unknown[] }>(
        `SELECT offers FROM match_directory WHERE competition_name = 'Sheffield Shield'`,
      );
      return result.rows[0]?.offers ?? [];
    });
    expect(hidden).toEqual([]);
    const stored = await db.query<{ status: string; approved_by: string | null }>(
      `SELECT o.status::text, o.approved_by::text FROM ticket_offers o
       JOIN matches m ON m.id = o.match_id WHERE m.source_external_id = 'sportmonks:501'`,
    );
    expect(stored.rows[0]).toMatchObject({ status: "pending", approved_by: null });

    const key = createHash("sha256").update("auth:person@example.com").digest("hex");
    const first = await asService(db, () =>
      db.query<{ rate_limit_hit: { ok: boolean } }>(
        `SELECT rate_limit_hit('${key}', 2, 60000) AS rate_limit_hit`,
      ),
    );
    const second = await asService(db, () =>
      db.query<{ rate_limit_hit: { ok: boolean } }>(
        `SELECT rate_limit_hit('${key}', 2, 60000) AS rate_limit_hit`,
      ),
    );
    const third = await asService(db, () =>
      db.query<{ rate_limit_hit: { ok: boolean } }>(
        `SELECT rate_limit_hit('${key}', 2, 60000) AS rate_limit_hit`,
      ),
    );
    expect(first.rows[0]?.rate_limit_hit.ok).toBe(true);
    expect(second.rows[0]?.rate_limit_hit.ok).toBe(true);
    expect(third.rows[0]?.rate_limit_hit.ok).toBe(false);

    await expect(
      asService(db, () => db.query(`SELECT set_user_role('${FAN}', 'admin', '${FAN}')`)),
    ).rejects.toThrow(/not allowed|Choose another account/i);
    await asService(db, () =>
      db.query(`SELECT set_user_role_for_account('fan@example.com', 'organiser', '${MOD}')`),
    );
    const role = await db.query<{ role: string }>(
      `SELECT role::text FROM profiles WHERE id = '${FAN}'`,
    );
    expect(role.rows[0]?.role).toBe("organiser");
    await db.close();
  });
});

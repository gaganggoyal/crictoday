import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildFixtureMatches } from "@/lib/data/fixtures";
import { fixtureOfferId, loadFixtures } from "@/lib/data/mysql/fixtures";
import { matches as seedMatches } from "@/lib/data/seed";
import {
  consumeMagicLink,
  createMagicLink,
  findUser,
  rateLimitHit,
  upsertUserRole,
} from "@/lib/data/mysql/auth";
import { removeDemo, seedDemo } from "@/lib/data/mysql/demo";
import { expireDue, runMysqlImport } from "@/lib/data/mysql/import";
import { migrate } from "@/lib/data/mysql/migrate";
import { createPool } from "@/lib/data/mysql/pool";
import {
  hasDemoListings,
  loadAccount,
  loadDirectory,
  loadModeration,
} from "@/lib/data/mysql/reads";
import {
  approveOffer,
  assignRole,
  createSubmission,
  createTicketRequest,
  markVerified,
  notifyListedAlerts,
  openTicketRequest,
  recordClick,
  reviewSubmission,
} from "@/lib/data/mysql/writes";
import type { NormalizedMatch } from "@/lib/domain/providers";
import { isPublicMatch } from "@/lib/domain/types";
import { ticketAlertEmail } from "@/lib/domain/workflows";

// Runs against a real MySQL 8 server when MYSQL_TEST_URL is set, for example
// mysql://user:password@127.0.0.1:3306 . The user needs CREATE and DROP on cm_t_* databases.
const serverUrl = process.env.MYSQL_TEST_URL;
const now = new Date("2026-10-04T12:00:00.000Z");
const hash = (label: string) => label.padEnd(64, "0").slice(0, 64);
const bySlug = <T extends { slug: string }>(items: T[]) =>
  [...items].sort((a, b) => a.slug.localeCompare(b.slug));

describe.skipIf(!serverUrl)("MySQL backend", () => {
  const database = `cm_t_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  let pool: Pool;
  let admin: string;
  let moderator: string;
  let fan: string;

  beforeAll(async () => {
    const server = await mysql.createConnection({ uri: serverUrl });
    await server.query(
      `CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`,
    );
    await server.end();
    const url = `${serverUrl!.replace(/\/$/, "")}/${database}`;
    await migrate(url, () => undefined);
    pool = createPool(url);
    await seedDemo(pool, now);
    admin = (await upsertUserRole(pool, "admin@cricketmatch.today", "admin", now)).id;
    moderator = (await upsertUserRole(pool, "moderator@cricketmatch.today", "moderator", now)).id;
    fan = (await upsertUserRole(pool, "fan@example.com", "fan", now)).id;
  });

  afterAll(async () => {
    await pool?.end();
    const server = await mysql.createConnection({ uri: serverUrl });
    await server.query(`DROP DATABASE IF EXISTS \`${database}\``);
    await server.end();
  });

  it("reads the seeded DEMO catalogue back exactly", async () => {
    const directory = await loadDirectory(pool);
    expect(bySlug(directory.matches)).toEqual(
      bySlug(seedMatches.filter((match) => isPublicMatch(match))),
    );
    expect(directory.academies.every((academy) => academy.verificationStatus === "verified")).toBe(
      true,
    );
    expect(directory.academies).toHaveLength(7);
    expect(await hasDemoListings(pool)).toBe(true);
  });

  it("signs in with a one-time link and keeps an existing role", async () => {
    await createMagicLink(pool, { email: "New.Fan@Example.com", tokenHash: hash("a1") }, now);
    const first = await consumeMagicLink(pool, hash("a1"), now);
    expect(first.ok && first.result.email).toBe("new.fan@example.com");
    expect(first.ok && first.result.role).toBe("fan");
    expect((await consumeMagicLink(pool, hash("a1"), now)).ok).toBe(false);

    await createMagicLink(pool, { email: "admin@cricketmatch.today", tokenHash: hash("a2") }, now);
    const later = new Date(now.getTime() + 31 * 60 * 1000);
    expect((await consumeMagicLink(pool, hash("a2"), later)).ok).toBe(false);
    await createMagicLink(pool, { email: "admin@cricketmatch.today", tokenHash: hash("a3") }, now);
    const signedIn = await consumeMagicLink(pool, hash("a3"), now);
    expect(signedIn.ok && signedIn.result).toEqual({
      email: "admin@cricketmatch.today",
      role: "admin",
      userId: admin,
    });
    expect(await findUser(pool, admin)).toMatchObject({ role: "admin" });
  });

  it("publishes a submitted fixture and emails a confirmed alert when its link is approved", async () => {
    const submitted = await createSubmission(
      pool,
      {
        entityType: "match",
        submitterId: null,
        payload: {
          organiserType: "club",
          contactEmail: "Club@Example.com",
          competition: "Goa T20 Cup",
          homeTeam: "Harbour XI",
          awayTeam: "Coastal XI",
          startsAt: "2026-12-02T15:30",
          startsAtUtc: "2026-12-02T10:00:00.000Z",
          timezone: "Asia/Kolkata",
          venue: "Campal Ground",
          city: "Panaji",
          country: "India",
          format: "t20",
          attendanceType: "ticketed",
          sourceUrl: "https://example.com/harbour",
          ticketUrl: "https://tickets.example.com/harbour",
          ticketSeller: "Harbour Club",
        },
      },
      now,
    );
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;

    expect(
      (await reviewSubmission(pool, { id: submitted.id, action: "approve", actorId: fan }, now)).ok,
    ).toBe(false);
    expect(
      (
        await reviewSubmission(
          pool,
          { id: submitted.id, action: "approve", actorId: moderator },
          now,
        )
      ).ok,
    ).toBe(true);
    expect(
      await reviewSubmission(
        pool,
        { id: submitted.id, action: "approve", actorId: moderator },
        now,
      ),
    ).toEqual({ ok: false, errors: { form: "This submission has already been closed." } });

    const slug = "harbour-xi-coastal-xi-panaji-2026-12-02";
    let listed = (await loadDirectory(pool)).matches.find((match) => match.slug === slug);
    expect(listed).toMatchObject({
      startsAt: "2026-12-02T10:00:00.000Z",
      demo: false,
      sourceType: "organiser",
      offers: [],
    });

    const request = await createTicketRequest(
      pool,
      {
        matchSlug: slug,
        emailHash: hash("fan1"),
        encryptedEmail: "cipher-text",
        quantity: 2,
        countryCode: "India",
        notes: "",
        verifyTokenHash: hash("v1"),
        unsubTokenHash: hash("u1"),
        userId: fan,
      },
      now,
    );
    expect(request).toMatchObject({ ok: true, already: false });
    expect(await openTicketRequest(pool, hash("v1"), "verify", now)).toEqual({
      ok: true,
      matchSlug: slug,
      intent: "verify",
    });

    const queue = await loadModeration(pool);
    const pending = queue.offers.find((item) => item.matchSlug === slug)!;
    expect(pending.offer).toMatchObject({
      status: "pending",
      approved: false,
      sellerName: "Harbour Club",
    });
    expect((await recordClick(pool, pending.offer.id, null, now)).ok).toBe(false);

    const approved = await approveOffer(
      pool,
      { offerId: pending.offer.id, matchSlug: slug, actorId: moderator },
      now,
    );
    expect(approved.ok && approved.notified).toBe(1);
    // The alert shows the listed match, kick-off included.
    expect(approved.ok && approved.emails[0]).toEqual(
      ticketAlertEmail(
        listed!,
        {
          sellerName: "Harbour Club",
          sellerDomain: "tickets.example.com",
          url: "https://tickets.example.com/harbour",
        },
        "cipher-text",
      ),
    );
    expect(
      (
        await approveOffer(
          pool,
          { offerId: pending.offer.id, matchSlug: slug, actorId: moderator },
          now,
        )
      ).ok,
    ).toBe(false);

    listed = (await loadDirectory(pool)).matches.find((match) => match.slug === slug);
    expect(listed?.offers).toEqual([expect.objectContaining({ status: "active", approved: true })]);
    expect(
      await recordClick(pool, pending.offer.id, "https://cricketmatch.today/", now),
    ).toMatchObject({
      ok: true,
      sellerDomain: "tickets.example.com",
      matchSlug: slug,
    });
    const [rules] = await pool.query<RowDataPacket[]>(
      "SELECT decision FROM domain_rules WHERE host = 'tickets.example.com'",
    );
    expect(rules[0]?.decision).toBe("allow");
    expect((await markVerified(pool, { matchSlug: slug, actorId: moderator }, now)).ok).toBe(true);

    const account = await loadAccount(pool, {
      userId: fan,
      email: "fan@example.com",
      emailHash: hash("fan1"),
    });
    expect(account.alertCount).toBe(1);
  });

  it("rolls back a whole approval when the ticket domain is blocked", async () => {
    await pool.query(
      "INSERT INTO domain_rules (host, decision, created_at) VALUES ('blocked.example', 'deny', ?)",
      [now],
    );
    const submitted = await createSubmission(
      pool,
      {
        entityType: "match",
        submitterId: null,
        payload: {
          organiserType: "league",
          contactEmail: "league@example.com",
          competition: "Night League",
          homeTeam: "Owls",
          awayTeam: "Larks",
          startsAt: "2026-12-05T19:00",
          timezone: "Europe/London",
          venue: "The Oval",
          city: "London",
          country: "England",
          format: "t20",
          attendanceType: "ticketed",
          sourceUrl: "https://example.com/night",
          ticketUrl: "https://shop.blocked.example/night",
        },
      },
      now,
    );
    if (!submitted.ok) throw new Error("submission failed");
    expect(
      await reviewSubmission(
        pool,
        { id: submitted.id, action: "approve", actorId: moderator },
        now,
      ),
    ).toEqual({ ok: false, errors: { form: "That ticket domain is blocked." } });
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS total FROM matches WHERE home_name = 'Owls'",
    );
    expect(Number(rows[0]!.total)).toBe(0);
    const [status] = await pool.query<RowDataPacket[]>(
      "SELECT status FROM submissions WHERE id = ?",
      [submitted.id],
    );
    expect(status[0]!.status).toBe("pending");
  });

  it("asks for a reason, a merge target, and staff rights", async () => {
    const submitted = await createSubmission(
      pool,
      {
        entityType: "correction",
        submitterId: fan,
        payload: { matchSlug: "x", details: "Gate C opens at noon." },
      },
      now,
    );
    if (!submitted.ok) throw new Error("submission failed");
    expect(
      await reviewSubmission(pool, { id: submitted.id, action: "reject", actorId: moderator }, now),
    ).toEqual({
      ok: false,
      errors: { reason: "A reason is required." },
    });
    expect(
      await reviewSubmission(
        pool,
        { id: submitted.id, action: "merge", mergeTarget: "nope", actorId: moderator },
        now,
      ),
    ).toEqual({ ok: false, errors: { mergeTarget: "Choose the canonical match to merge into." } });
    expect(
      await reviewSubmission(
        pool,
        { id: submitted.id, action: "changes", reason: "Which gate?", actorId: moderator },
        now,
      ),
    ).toEqual({ ok: true });
    expect(
      await reviewSubmission(
        pool,
        { id: submitted.id, action: "approve", actorId: moderator },
        now,
      ),
    ).toEqual({ ok: true });
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT reviewer_notes, reviewer_email FROM submissions WHERE id = ?",
      [submitted.id],
    );
    expect(rows[0]).toMatchObject({
      reviewer_notes: "Recorded. Fixture fields were not changed automatically.",
      reviewer_email: "moderator@cricketmatch.today",
    });
  });

  it("verifies a submitted academy and lets an admin change roles", async () => {
    const submitted = await createSubmission(
      pool,
      {
        entityType: "academy",
        submitterId: fan,
        payload: {
          name: "Riverside Nets",
          address: "12 River Road",
          city: "Pune",
          country: "India",
          contactEmail: "fan@example.com",
          website: "https://example.com/riverside",
          ageGroups: ["U14"],
          facilities: ["Nets"],
          description: "Evening nets for school players on a turf pitch.",
        },
      },
      now,
    );
    if (!submitted.ok) throw new Error("submission failed");
    expect(
      (
        await reviewSubmission(
          pool,
          { id: submitted.id, action: "approve", actorId: moderator },
          now,
        )
      ).ok,
    ).toBe(true);
    const academy = (await loadDirectory(pool)).academies.find(
      (item) => item.slug === "riverside-nets",
    );
    expect(academy).toMatchObject({
      verificationLabel: "Contact verified",
      ageGroups: ["U14"],
      demo: false,
    });
    const account = await loadAccount(pool, {
      userId: fan,
      email: "fan@example.com",
      emailHash: hash("none"),
    });
    expect(account.academies.map((item) => item.slug)).toContain("riverside-nets");

    expect(
      (
        await assignRole(
          pool,
          { account: "fan@example.com", role: "organiser", actorId: moderator },
          now,
        )
      ).ok,
    ).toBe(false);
    expect(
      await assignRole(
        pool,
        { account: "admin@cricketmatch.today", role: "fan", actorId: admin },
        now,
      ),
    ).toEqual({
      ok: false,
      errors: { form: "Choose another account." },
    });
    expect(
      await assignRole(pool, { account: "ghost@example.com", role: "fan", actorId: admin }, now),
    ).toEqual({
      ok: false,
      errors: { form: "That person has not signed in yet." },
    });
    expect(
      (
        await assignRole(
          pool,
          { account: "FAN@example.com", role: "organiser", actorId: admin },
          now,
        )
      ).ok,
    ).toBe(true);
    expect(await findUser(pool, fan)).toMatchObject({ role: "organiser" });
  });

  it("dedupes alerts, closes them for cancelled matches, and expires them once play starts", async () => {
    const base = {
      matchSlug: "india-vs-australia-2nd-test-delhi-2026-10-24",
      encryptedEmail: "cipher",
      quantity: 1,
      countryCode: "IN",
      notes: "",
      userId: null,
    };
    const first = await createTicketRequest(
      pool,
      { ...base, emailHash: hash("d1"), verifyTokenHash: hash("dv1"), unsubTokenHash: hash("du1") },
      now,
    );
    const again = await createTicketRequest(
      pool,
      { ...base, emailHash: hash("d1"), verifyTokenHash: hash("dv2"), unsubTokenHash: hash("du2") },
      now,
    );
    expect(first).toMatchObject({ ok: true, already: false });
    expect(again).toEqual({ ok: true, id: first.ok ? first.id : "", already: true });
    expect(
      await createTicketRequest(
        pool,
        {
          ...base,
          matchSlug: "surrey-vs-yorkshire-birmingham-2026-10-22",
          emailHash: hash("d2"),
          verifyTokenHash: hash("dv3"),
          unsubTokenHash: hash("du3"),
        },
        now,
      ),
    ).toEqual({ ok: false, errors: { form: "Alerts are closed for this match." } });

    const afterStart = new Date("2026-10-25T00:00:00.000Z");
    expect(await openTicketRequest(pool, hash("dv1"), "verify", afterStart)).toEqual({
      ok: false,
      errors: { form: "This match has started or been cancelled, so the alert was not activated." },
    });
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT status FROM ticket_requests WHERE verify_token_hash = ?",
      [hash("dv1")],
    );
    expect(rows[0]!.status).toBe("expired");

    // A closed request frees the address to ask again, then the verify link can also unsubscribe.
    const renewed = await createTicketRequest(
      pool,
      { ...base, emailHash: hash("d1"), verifyTokenHash: hash("dv4"), unsubTokenHash: hash("du4") },
      now,
    );
    expect(renewed).toMatchObject({ ok: true, already: false });
    expect(await openTicketRequest(pool, hash("dv4"), "unsubscribe", now)).toMatchObject({
      ok: true,
      intent: "unsubscribe",
    });
    expect(await openTicketRequest(pool, hash("dv4"), "verify", now)).toEqual({
      ok: false,
      errors: { form: "This alert was unsubscribed." },
    });
  });

  it("limits hits per key in a shared window", async () => {
    const key = hash("rl");
    expect((await rateLimitHit(pool, key, 2, 60_000, now)).ok).toBe(true);
    expect((await rateLimitHit(pool, key, 2, 60_000, now)).ok).toBe(true);
    const blocked = await rateLimitHit(pool, key, 2, 60_000, new Date(now.getTime() + 1000));
    expect(blocked).toEqual({ ok: false, retryAfterMs: 59_000 });
    expect((await rateLimitHit(pool, key, 2, 60_000, new Date(now.getTime() + 60_000))).ok).toBe(
      true,
    );
  });

  it("imports provider fixtures without touching organiser rows and expires started offers", async () => {
    const fixture = (patch: Partial<NormalizedMatch>): NormalizedMatch => ({
      externalId: "sm-1",
      provider: "sportmonks",
      competition: "County Championship",
      home: "Kent",
      away: "Essex",
      startsAt: "2026-11-02T10:30:00.000Z",
      timezone: "Europe/London",
      venue: "St Lawrence Ground",
      city: "Canterbury",
      country: "England",
      format: "other",
      status: "published",
      sourceUrl: "https://example.com/kent-essex",
      ...patch,
    });
    let fixtures = [fixture({})];
    const provider = {
      name: "sportmonks" as const,
      fetchBetween: async () => fixtures,
      fetchByExternalId: async () => null,
    };
    const at = (seconds: number) => new Date(now.getTime() + seconds * 1000);
    expect(await runMysqlImport(pool, { fixtures: provider, tickets: null }, at(1))).toMatchObject({
      status: "succeeded",
      fetched: 1,
    });
    fixtures = [fixture({ startsAt: "2026-11-02T11:00:00.000Z" })];
    await runMysqlImport(pool, { fixtures: provider, tickets: null }, at(2));
    const imported = (await loadDirectory(pool)).matches.filter(
      (match) => match.sourceExternalId === "sm-1",
    );
    expect(imported).toHaveLength(1);
    expect(imported[0]).toMatchObject({
      startsAt: "2026-11-02T11:00:00.000Z",
      sourceType: "api",
      offers: [],
    });

    expect(await runMysqlImport(pool, { fixtures: null, tickets: null }, at(3))).toMatchObject({
      status: "skipped",
    });
    const [runs] = await pool.query<RowDataPacket[]>(
      "SELECT status FROM import_runs ORDER BY started_at",
    );
    expect(runs.map((run) => run.status)).toEqual(["succeeded", "succeeded", "skipped"]);

    await expireDue(pool, new Date("2026-10-17T00:00:00.000Z"));
    const [offers] = await pool.query<RowDataPacket[]>(
      "SELECT status FROM ticket_offers WHERE id = 'offer-india-a'",
    );
    expect(offers[0]!.status).toBe("expired");
  });

  it("removes every DEMO row with its offers and alerts", async () => {
    const removed = await removeDemo(pool);
    expect(removed.matches).toBe(22);
    expect(await hasDemoListings(pool)).toBe(false);
    const [offers] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS total FROM ticket_offers WHERE id LIKE 'offer-%'",
    );
    expect(Number(offers[0]!.total)).toBe(0);
    expect((await loadDirectory(pool)).matches.every((match) => !match.demo)).toBe(true);
  });

  it("loads a fixture file, updates what changed, and leaves other listings alone", async () => {
    const fixtures = buildFixtureMatches(
      JSON.parse(readFileSync("data/fixtures/2026-27.json", "utf8")),
    );
    // Seven links wait for sales that open on 10 October.
    expect(await loadFixtures(pool, fixtures, now)).toEqual({
      inserted: 209,
      updated: 0,
      unchanged: 0,
      skipped: [],
      tickets: { added: 138, updated: 0, withdrawn: 0, waiting: 7 },
    });
    // The Delhi ODI is stored but hidden until it has a ground.
    const listed = (await loadDirectory(pool)).matches.filter((match) =>
      match.sourceExternalId?.startsWith("fixtures:"),
    );
    expect(listed).toHaveLength(208);
    const lucknow = "fixtures:west-indies-in-india-2026-27:t20i-1";
    expect(listed.find((match) => match.sourceExternalId === lucknow)).toMatchObject({
      slug: "india-vs-west-indies-1st-t20i-lucknow-2026-10-06",
      startsAt: "2026-10-06T13:30:00.000Z",
      competitionName: "West Indies tour of India, 1st T20I",
      venueName: "Ekana Cricket Stadium",
      status: "published",
      sourceType: "admin",
      demo: false,
      offers: [
        {
          id: fixtureOfferId(lucknow),
          sellerName: "District by Zomato",
          sellerDomain: "district.in",
          url: "https://www.district.in/events/1st-t20i-india-vs-west-indies--lucknow-buy-tickets",
          kind: "official",
          currency: null,
          priceFrom: null,
          status: "active",
          lastCheckedAt: fixtures[0]!.lastVerifiedAt,
          approved: true,
        },
      ],
    });

    expect(await loadFixtures(pool, fixtures, now)).toMatchObject({
      inserted: 0,
      updated: 0,
      unchanged: 209,
      tickets: { added: 0, updated: 0, withdrawn: 0, waiting: 7 },
    });

    // A moved fixture is updated in place and keeps its address.
    const testId = "fixtures:india-in-new-zealand-2026-27:test-1";
    const moved = fixtures.map((fixture) =>
      fixture.sourceExternalId === testId
        ? { ...fixture, startsAt: "2026-11-19T21:30:00.000Z", status: "postponed" as const }
        : fixture,
    );
    expect(await loadFixtures(pool, moved, now)).toMatchObject({ updated: 1, unchanged: 208 });
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT slug, status, starts_at FROM matches WHERE source_external_id = ?",
      [testId],
    );
    expect(rows[0]).toMatchObject({
      slug: "new-zealand-vs-india-1st-test-wellington-2026-11-19",
      status: "postponed",
    });
    expect((rows[0]!.starts_at as Date).toISOString()).toBe("2026-11-19T21:30:00.000Z");

    // Organiser listings are not changed, and a fixture that has started is not added.
    await pool.query("UPDATE matches SET source_type = 'organiser' WHERE source_external_id = ?", [
      "fixtures:bbl-16:match-1",
    ]);
    const started = {
      ...fixtures[0]!,
      sourceExternalId: "fixtures:example:started",
      slugBase: "started-fixture",
    };
    const later = await loadFixtures(
      pool,
      [
        ...moved.map((fixture) =>
          fixture.sourceExternalId === "fixtures:bbl-16:match-1"
            ? { ...fixture, venueName: "Somewhere else" }
            : fixture,
        ),
        started,
      ],
      new Date("2026-10-07T00:00:00.000Z"),
    );
    expect(later).toMatchObject({ inserted: 0, updated: 0 });
    expect(later.skipped).toEqual([
      "fixtures:bbl-16:match-1: listed by organiser",
      "fixtures:example:started: already started",
    ]);
    // Only the loads that changed something are audited.
    const [audit] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS total FROM audit_log WHERE action = 'fixtures.load'",
    );
    expect(Number(audit[0]!.total)).toBe(2);
  });

  it("keeps ticket links in step with the file and alerts the fans waiting for them", async () => {
    const fixtures = buildFixtureMatches(
      JSON.parse(readFileSync("data/fixtures/2026-27.json", "utf8")),
    );
    const slugOf = async (sourceExternalId: string) => {
      const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT slug FROM matches WHERE source_external_id = ?",
        [sourceExternalId],
      );
      return String(rows[0]!.slug);
    };
    const statusOf = async (sourceExternalId: string) => {
      const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT status FROM ticket_offers WHERE id = ?",
        [fixtureOfferId(sourceExternalId)],
      );
      return rows[0]?.status;
    };

    // A fan asks to hear when Pakistan v Sri Lanka in Rawalpindi has tickets.
    const rawalpindi = await slugOf("fixtures:pakistan-odi-tri-series-2026:match-1");
    const request = await createTicketRequest(
      pool,
      {
        matchSlug: rawalpindi,
        emailHash: hash("pk1"),
        encryptedEmail: "cipher-pk",
        quantity: 2,
        countryCode: "Pakistan",
        notes: "",
        verifyTokenHash: hash("pkv"),
        unsubTokenHash: hash("pku"),
        userId: null,
      },
      now,
    );
    expect(request.ok).toBe(true);
    await openTicketRequest(pool, hash("pkv"), "verify", now);

    // Before 3pm in Rawalpindi on 10 October the PCB's link is not listed and nobody is emailed.
    // The Chennai match is the organiser's listing now, so its link is not touched.
    const before = new Date("2026-10-10T09:59:00.000Z");
    expect((await loadFixtures(pool, fixtures, before)).tickets).toMatchObject({
      added: 0,
      waiting: 6,
    });
    expect(await notifyListedAlerts(pool, before)).toEqual([]);

    const opened = new Date("2026-10-10T10:05:00.000Z");
    expect((await loadFixtures(pool, fixtures, opened)).tickets).toEqual({
      added: 6,
      updated: 0,
      withdrawn: 0,
      waiting: 0,
    });
    const match = (await loadDirectory(pool)).matches.find((item) => item.slug === rawalpindi)!;
    expect(match.offers).toEqual([
      expect.objectContaining({
        sellerName: "Pakistan Cricket Board",
        url: "https://pcb.tcs.com.pk/",
        status: "active",
        approved: true,
      }),
    ]);
    expect(await notifyListedAlerts(pool, opened)).toEqual([
      ticketAlertEmail(
        match,
        {
          sellerName: "Pakistan Cricket Board",
          sellerDomain: "pcb.tcs.com.pk",
          url: "https://pcb.tcs.com.pk/",
        },
        "cipher-pk",
      ),
    ]);
    expect(await notifyListedAlerts(pool, opened)).toEqual([]);

    // A sold-out link that reopens is updated, and a link the file drops comes down.
    const reopened = "fixtures:england-in-south-africa-2026-27:odi-1";
    const dropped = "fixtures:australia-women-in-south-africa-2026-27:test";
    const changed = fixtures.map((fixture) =>
      fixture.sourceExternalId === reopened
        ? { ...fixture, tickets: { ...fixture.tickets!, status: "active" as const } }
        : fixture.sourceExternalId === dropped
          ? { ...fixture, tickets: null }
          : fixture,
    );
    expect((await loadFixtures(pool, changed, opened)).tickets).toEqual({
      added: 0,
      updated: 1,
      withdrawn: 1,
      waiting: 0,
    });
    expect(await statusOf(reopened)).toBe("active");
    expect(await statusOf(dropped)).toBe("expired");

    // A moderator's later check survives the next load.
    const auckland = "fixtures:india-in-new-zealand-2026-27:odi-1";
    await markVerified(pool, { matchSlug: await slugOf(auckland), actorId: moderator }, opened);
    expect(await loadFixtures(pool, changed, opened)).toMatchObject({
      updated: 0,
      tickets: { added: 0, updated: 0, withdrawn: 0 },
    });
    const [verified] = await pool.query<RowDataPacket[]>(
      "SELECT last_verified_at FROM matches WHERE source_external_id = ?",
      [auckland],
    );
    expect((verified[0]!.last_verified_at as Date).toISOString()).toBe(opened.toISOString());

    // A verification time in the future is a mistake, and the next load corrects it.
    await pool.query("UPDATE matches SET last_verified_at = ? WHERE source_external_id = ?", [
      new Date("2026-12-01T00:00:00.000Z"),
      auckland,
    ]);
    expect(await loadFixtures(pool, changed, opened)).toMatchObject({ updated: 1 });
    const [corrected] = await pool.query<RowDataPacket[]>(
      "SELECT last_verified_at FROM matches WHERE source_external_id = ?",
      [auckland],
    );
    expect((corrected[0]!.last_verified_at as Date).toISOString()).toBe(
      fixtures[0]!.lastVerifiedAt,
    );

    // A blocked seller domain takes its listed link down. Started matches keep theirs for expiry.
    await pool.query(
      `INSERT INTO domain_rules (host, decision, created_at) VALUES ('ticketgenie.in', 'deny', ?)
       ON DUPLICATE KEY UPDATE decision = 'deny'`,
      [opened],
    );
    const hyderabad = "fixtures:west-indies-in-india-2026-27:t20i-4";
    const blocked = await loadFixtures(pool, changed, opened);
    expect(blocked.skipped).toContain(`${hyderabad}: ticketgenie.in is blocked`);
    expect(await statusOf(hyderabad)).toBe("rejected");
    const lucknow = "fixtures:west-indies-in-india-2026-27:t20i-1";
    await loadFixtures(
      pool,
      changed.map((fixture) =>
        fixture.sourceExternalId === lucknow ? { ...fixture, tickets: null } : fixture,
      ),
      opened,
    );
    expect(await statusOf(lucknow)).toBe("active");
  });
});

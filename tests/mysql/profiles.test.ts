import { randomUUID } from "node:crypto";
import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { upsertUserRole } from "@/lib/data/mysql/auth";
import { migrate } from "@/lib/data/mysql/migrate";
import { createPool } from "@/lib/data/mysql/pool";
import {
  createProfile,
  loadOwnerProfile,
  loadOwnerProfiles,
  loadProfileQueue,
  removeOffering,
  reviewProfile,
  saveOffering,
  saveOwnerMatch,
  updateProfile,
  type Owner,
} from "@/lib/data/mysql/profiles";
import { loadDirectory, loadModeration } from "@/lib/data/mysql/reads";
import type { OwnerMatchInput, ProfileInput } from "@/lib/validation/profile";

// Runs against MySQL 8 when MYSQL_TEST_URL is set, like tests/mysql/backend.test.ts.
const serverUrl = process.env.MYSQL_TEST_URL;
const now = new Date("2026-10-10T06:00:00.000Z");
const later = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

const committee: ProfileInput = {
  kind: "committee",
  name: "Dadar Union Cricket Committee",
  description: "Runs the Dadar monsoon league and the Diwali tennis-ball cup for local teams.",
  country: "india",
  state: "maharashtra",
  city: "mumbai",
  address: "Dadar Union ground, Dadar",
  timezone: "",
  contactEmail: "Committee@Example.com",
  phone: "+91 98765 43210",
  whatsapp: "+91 98765 43210",
  website: "",
  instagram: "https://instagram.com/dadarunion",
  facebook: "",
  youtube: "",
  ageGroups: ["Senior"],
  facilities: ["Turf pitch"],
  consent: true,
};

const match = (overrides: Partial<OwnerMatchInput> = {}): OwnerMatchInput => ({
  profile: "",
  match: "",
  competition: "Diwali Cup",
  homeTeam: "Dadar Strikers",
  awayTeam: "Matunga Lions",
  date: "2026-11-01",
  time: "09:30",
  ground: "Dadar Union ground",
  state: "maharashtra",
  city: "Mumbai",
  format: "t20",
  attendance: "free",
  entryNotes: "Free entry. Seats on the grass bank.",
  ticketUrl: "",
  status: "published",
  ...overrides,
});

describe.skipIf(!serverUrl)("club and academy profiles on MySQL", () => {
  const database = `cm_t_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  let pool: Pool;
  let moderator: string;
  let owner: Owner;
  let stranger: Owner;
  let slug: string;

  beforeAll(async () => {
    const server = await mysql.createConnection({ uri: serverUrl });
    await server.query(
      `CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`,
    );
    await server.end();
    const url = `${serverUrl!.replace(/\/$/, "")}/${database}`;
    await migrate(url, () => undefined);
    pool = createPool(url);
    moderator = (await upsertUserRole(pool, "moderator@cricketmatch.today", "moderator", now)).id;
    const ownerUser = await upsertUserRole(pool, "owner@example.com", "fan", now);
    owner = { userId: ownerUser.id, email: ownerUser.email };
    const strangerUser = await upsertUserRole(pool, "stranger@example.com", "fan", now);
    stranger = { userId: strangerUser.id, email: strangerUser.email };
  });

  afterAll(async () => {
    await pool?.end();
    const server = await mysql.createConnection({ uri: serverUrl });
    await server.query(`DROP DATABASE IF EXISTS \`${database}\``);
    await server.end();
  });

  it("creates a hidden profile, tells moderators, and keeps it to its owner", async () => {
    const created = await createProfile(pool, owner, committee, now);
    expect(created).toMatchObject({ ok: true, slug: "dadar-union-cricket-committee-mumbai" });
    slug = created.ok ? created.slug : "";
    expect(created.ok && created.emails.map((email) => email.to)).toEqual([
      "moderator@cricketmatch.today",
    ]);

    const [profile] = await loadOwnerProfiles(pool, owner);
    expect(profile).toMatchObject({
      kind: "committee",
      cityName: "Mumbai",
      stateName: "Maharashtra",
      timezone: "Asia/Kolkata",
      contactEmail: "committee@example.com",
      links: { instagram: "https://instagram.com/dadarunion" },
      verificationStatus: "pending",
      ownerEmail: "owner@example.com",
    });
    expect((await loadDirectory(pool)).academies).toEqual([]);
    expect((await loadProfileQueue(pool)).pending.map((item) => item.slug)).toEqual([slug]);

    expect(await updateProfile(pool, stranger, slug, committee, now)).toEqual({
      ok: false,
      errors: { form: "That profile is not on your account." },
    });
  });

  it("checks the town against the state", async () => {
    expect(
      await updateProfile(pool, owner, slug, { ...committee, city: "Bengaluru" }, now),
    ).toEqual({
      ok: false,
      errors: { city: "Bengaluru is in Karnataka. Choose that state, or check the town." },
    });
    // A town that is not in the list is kept as typed, under the chosen state.
    const moved = await updateProfile(pool, owner, slug, { ...committee, city: "Sangamner" }, now);
    expect(moved).toMatchObject({ ok: true, status: "pending" });
    expect((await loadOwnerProfiles(pool, owner))[0]).toMatchObject({
      cityName: "Sangamner",
      citySlug: "sangamner",
      stateSlug: "maharashtra",
    });
    await updateProfile(pool, owner, slug, committee, now);
  });

  it("adds, edits and removes offers", async () => {
    const added = await saveOffering(
      pool,
      owner,
      { profile: slug, category: "tournament", title: "Diwali Cup entry", price: "₹5,000 a team" },
      now,
    );
    expect(added.ok).toBe(true);
    const id = added.ok ? added.id : "";
    await saveOffering(
      pool,
      owner,
      { profile: slug, id, category: "tournament", title: "Diwali Cup entry", price: "₹4,000 a team" },
      now,
    );
    await saveOffering(
      pool,
      owner,
      { profile: slug, category: "ground", title: "Turf hire", schedule: "Weekday evenings" },
      now,
    );
    let profile = (await loadOwnerProfiles(pool, owner))[0]!;
    expect(profile.offerings.map((item) => [item.title, item.price])).toEqual([
      ["Diwali Cup entry", "₹4,000 a team"],
      ["Turf hire", null],
    ]);
    await removeOffering(pool, owner, { profile: slug, id }, now);
    profile = (await loadOwnerProfiles(pool, owner))[0]!;
    expect(profile.offerings.map((item) => item.title)).toEqual(["Turf hire"]);
  });

  it("holds matches until the profile passes its check, then publishes them", async () => {
    expect(
      await saveOwnerMatch(pool, owner, match({ profile: slug, date: "2026-10-09" }), now),
    ).toEqual({ ok: false, errors: { date: "Choose a date and time that has not passed." } });

    const waiting = await saveOwnerMatch(pool, owner, match({ profile: slug }), now);
    expect(waiting).toMatchObject({ ok: true, status: "pending" });
    expect((await loadDirectory(pool)).matches).toEqual([]);

    // Sent back: the owner sees why and cannot post until the profile is fixed.
    expect(await reviewProfile(pool, { actorId: moderator, slug, action: "reject" }, now)).toEqual({
      ok: false,
      errors: { reason: "Say what needs to change." },
    });
    const rejected = await reviewProfile(
      pool,
      { actorId: moderator, slug, action: "reject", reason: "Add the ground's full address." },
      now,
    );
    expect(rejected.ok && rejected.emails.map((email) => [email.to, email.subject])).toEqual([
      ["owner@example.com", "Dadar Union Cricket Committee needs a change before it goes live"],
    ]);
    expect(await saveOwnerMatch(pool, owner, match({ profile: slug }), now)).toMatchObject({
      ok: false,
    });
    const resubmitted = await updateProfile(
      pool,
      owner,
      slug,
      { ...committee, address: "Dadar Union ground, Senapati Bapat Marg, Dadar West" },
      now,
    );
    expect(resubmitted).toMatchObject({ ok: true, status: "pending" });
    expect(resubmitted.ok && resubmitted.emails).toHaveLength(1);

    const approved = await reviewProfile(pool, { actorId: moderator, slug, action: "approve" }, now);
    expect(approved.ok && approved.emails[0]?.subject).toBe(
      "Dadar Union Cricket Committee is live on cricketmatch.today",
    );
    const directory = await loadDirectory(pool);
    expect(directory.academies.map((item) => item.slug)).toEqual([slug]);
    expect(directory.matches).toHaveLength(1);
    expect(directory.matches[0]).toMatchObject({
      slug: waiting.ok ? waiting.slug : "",
      kind: "local",
      status: "published",
      homeShort: "DS",
      cityName: "Mumbai",
      stateSlug: "maharashtra",
      startsAt: "2026-11-01T04:00:00.000Z",
      timezone: "Asia/Kolkata",
      attendanceType: "free",
      sourceType: "organiser",
      sourceLabel: "Posted by Dadar Union Cricket Committee",
      sourceUrl: `http://localhost:3000/club/${slug}`,
      academySlug: slug,
    });
  });

  it("publishes a checked profile's matches at once and lets the owner change them", async () => {
    const posted = await saveOwnerMatch(
      pool,
      owner,
      match({
        profile: slug,
        homeTeam: "Shivaji Park Gymkhana",
        awayTeam: "Dadar Strikers",
        date: "2026-11-08",
        attendance: "ticketed",
        ticketUrl: "https://tickets.example.com/diwali-cup",
      }),
      now,
    );
    expect(posted).toMatchObject({ ok: true, status: "published" });
    const postedSlug = posted.ok ? posted.slug : "";
    // The ticket link waits for a moderator, like every organiser's.
    const queue = await loadModeration(pool);
    expect(queue.offers.find((item) => item.matchSlug === postedSlug)?.offer).toMatchObject({
      status: "pending",
      approved: false,
      sellerDomain: "tickets.example.com",
    });

    const edited = await saveOwnerMatch(
      pool,
      owner,
      match({
        profile: slug,
        match: postedSlug,
        homeTeam: "Shivaji Park Gymkhana",
        awayTeam: "Dadar Strikers",
        date: "2026-11-15",
        time: "10:00",
        status: "postponed",
      }),
      later(1),
    );
    expect(edited).toEqual({ ok: true, slug: postedSlug, status: "postponed" });
    const owned = await loadOwnerProfile(pool, owner, slug);
    expect(owned?.matches.find((item) => item.slug === postedSlug)).toMatchObject({
      status: "postponed",
      startsAt: "2026-11-15T04:30:00.000Z",
    });
    expect(
      await saveOwnerMatch(pool, stranger, match({ profile: slug, match: postedSlug }), now),
    ).toMatchObject({ ok: false });
  });

  it("keeps a renamed profile's matches pointing at it, and hides both when taken down", async () => {
    await updateProfile(pool, owner, slug, { ...committee, name: "Dadar Union Cricket Club", kind: "club" }, now);
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT DISTINCT source_label, source_url FROM matches WHERE academy_slug = ?",
      [slug],
    );
    expect(rows).toEqual([
      {
        source_label: "Posted by Dadar Union Cricket Club",
        source_url: `http://localhost:3000/club/${slug}`,
      },
    ]);
    await reviewProfile(
      pool,
      { actorId: moderator, slug, action: "reject", reason: "Reported as a duplicate." },
      now,
    );
    const directory = await loadDirectory(pool);
    expect(directory.academies).toEqual([]);
    expect(directory.matches).toEqual([]);
  });

  it("caps profiles per account", async () => {
    for (let index = 1; index < 5; index += 1) {
      await createProfile(pool, owner, { ...committee, name: `Dadar Club ${index}` }, now);
    }
    expect(await createProfile(pool, owner, { ...committee, name: "One too many" }, now)).toMatchObject({
      ok: false,
    });
  });
});

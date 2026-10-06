import { randomUUID } from "node:crypto";
import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { upsertUserRole } from "@/lib/data/mysql/auth";
import { migrate } from "@/lib/data/mysql/migrate";
import { createPool } from "@/lib/data/mysql/pool";
import {
  createProfile,
  loadOwnerProfile,
  reviewProfile,
  type Owner,
} from "@/lib/data/mysql/profiles";
import { loadDirectory } from "@/lib/data/mysql/reads";
import { runSchedule, type ScheduleResult } from "@/lib/data/mysql/schedule";
import type { ProfileInput } from "@/lib/validation/profile";

// Runs against MySQL 8 when MYSQL_TEST_URL is set, like tests/mysql/backend.test.ts.
const serverUrl = process.env.MYSQL_TEST_URL;
const now = new Date("2026-10-10T06:00:00.000Z");

const club: ProfileInput = {
  kind: "club",
  name: "Shivaji Park Gymkhana",
  description: "A club that plays weekend league cricket and takes junior members every season.",
  country: "india",
  state: "maharashtra",
  city: "mumbai",
  address: "Shivaji Park, Dadar",
  timezone: "",
  contactEmail: "club@example.com",
  phone: "",
  whatsapp: "",
  website: "",
  instagram: "",
  facebook: "",
  youtube: "",
  ageGroups: [],
  facilities: [],
  consent: true,
};

const header = [
  "Date",
  "Time",
  "Opponent",
  "Ground",
  "Town",
  "Tournament",
  "Format",
  "Entry",
  "Ticket link",
];
const season = [
  header,
  ["01/11/2026", "9:30 am", "Dadar Union", "", "", "Kanga League", "T20", "Free", ""],
  [
    "08/11/2026",
    "9:30 am",
    "Matunga Lions",
    "Matunga Gymkhana",
    "Mumbai",
    "Kanga League",
    "T20",
    "Free",
    "",
  ],
  [
    "15/11/2026",
    "2 pm",
    "Pune Panthers",
    "Nehru Stadium",
    "Pune",
    "Kanga League",
    "T20",
    "Tickets",
    "https://tickets.example.com/kanga",
  ],
];

function outcomes(result: Awaited<ReturnType<typeof runSchedule>>) {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return (result as ScheduleResult).rows.map((row) => [row.line, row.outcome, ...row.problems]);
}

describe.skipIf(!serverUrl)("spreadsheet schedules on MySQL", () => {
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
    const ownerUser = await upsertUserRole(pool, "club@example.com", "fan", now);
    owner = { userId: ownerUser.id, email: ownerUser.email };
    const strangerUser = await upsertUserRole(pool, "stranger@example.com", "fan", now);
    stranger = { userId: strangerUser.id, email: strangerUser.email };
    const created = await createProfile(pool, owner, club, now);
    slug = created.ok ? created.slug : "";
  });

  afterAll(async () => {
    await pool?.end();
    const server = await mysql.createConnection({ uri: serverUrl });
    await server.query(`DROP DATABASE IF EXISTS \`${database}\``);
    await server.end();
  });

  const sheet = (rows: string[][]) => ({ profile: slug, rows, date1904: false });
  const posted = async () => (await loadOwnerProfile(pool, owner, slug))!.matches;

  it("previews a sheet without saving it, and keeps it to the profile's owner", async () => {
    const preview = await runSchedule(pool, owner, sheet(season), now, false);
    expect(outcomes(preview)).toEqual([
      [2, "add"],
      [3, "add"],
      [4, "add"],
    ]);
    expect(preview.ok && preview.rows[0]).toMatchObject({
      when: "Sun, 1 Nov 2026, 09:30 GMT+5:30",
      homeTeam: "Shivaji Park Gymkhana",
      ground: "Shivaji Park, Dadar",
      city: "Mumbai",
      filled: ["home side", "ground", "town"],
    });
    expect(await posted()).toEqual([]);
    expect(await runSchedule(pool, stranger, sheet(season), now, false)).toEqual({
      ok: false,
      errors: { form: "That profile is not on your account." },
    });
  });

  it("adds an unchecked profile's matches to wait for its check", async () => {
    const result = await runSchedule(pool, owner, sheet(season), now, true);
    expect(outcomes(result)).toEqual([
      [2, "add"],
      [3, "add"],
      [4, "add"],
    ]);
    const matches = await posted();
    expect(matches.map((match) => [match.awayName, match.status, match.stateSlug])).toEqual([
      ["Dadar Union", "pending", "maharashtra"],
      ["Matunga Lions", "pending", "maharashtra"],
      ["Pune Panthers", "pending", "maharashtra"],
    ]);
    // The ticket link waits for a moderator, like every organiser's.
    const [offers] = await pool.query<RowDataPacket[]>(
      "SELECT seller_domain, status, approved FROM ticket_offers",
    );
    expect(offers).toEqual([
      { seller_domain: "tickets.example.com", status: "pending", approved: 0 },
    ]);
  });

  it("skips what is listed, updates what changed, and reports each row's problem", async () => {
    await reviewProfile(pool, { actorId: moderator, slug, action: "approve" }, now);
    const result = await runSchedule(
      pool,
      owner,
      sheet([
        header,
        season[1]!,
        // The same fixture an hour later, and with the sides the other way round.
        [
          "08/11/2026",
          "10:30 am",
          "Matunga Lions",
          "Matunga Gymkhana",
          "Mumbai",
          "Kanga League",
          "T20",
          "Free",
          "",
        ],
        season[3]!,
        ["22/11/2026", "9:30 am", "Thane Tigers", "", "", "Kanga League", "T20", "Free", ""],
        ["22/11/2026", "9:30 am", "thane tigers", "", "", "", "", "", ""],
        ["01/10/2026", "9:30 am", "Old Boys", "", "", "", "", "", ""],
        ["29/11/2026", "9:30 am", "Bangalore Blues", "Chinnaswamy B", "Bengaluru", "", "", "", ""],
        [
          "06/12/2026",
          "9:30 am",
          "Chennai Kings",
          "",
          "",
          "",
          "",
          "Tickets",
          "http://tickets.example.com/x",
        ],
        ["13/12/2029", "9:30 am", "Future XI", "", "", "", "", "", ""],
      ]),
      now,
      true,
    );
    expect(outcomes(result)).toEqual([
      [2, "same"],
      [3, "update"],
      [4, "same"],
      [5, "add"],
      [6, "error", "The same match as row 5."],
      [7, "past"],
      [8, "add"],
      [9, "error", "Ticket link: Ticket link must be a full https address."],
      [10, "error", "Date: Choose a date within the next two years."],
    ]);
    const matches = await posted();
    expect(matches.find((match) => match.awayName === "Matunga Lions")?.startsAt).toBe(
      "2026-11-08T05:00:00.000Z",
    );
    // A town in another state takes that state, not the profile's.
    expect(matches.find((match) => match.awayName === "Bangalore Blues")?.stateSlug).toBe(
      "karnataka",
    );
    // The profile was checked, so its new and changed matches are live, and the old ones too.
    const live = (await loadDirectory(pool)).matches.map((match) => match.awayName).sort();
    expect(live).toEqual([
      "Bangalore Blues",
      "Dadar Union",
      "Matunga Lions",
      "Pune Panthers",
      "Thane Tigers",
    ]);
  });

  it("keeps a postponement made on the site unless the sheet has a status column", async () => {
    const [match] = await posted();
    await pool.query("UPDATE matches SET status = 'postponed' WHERE slug = ?", [match!.slug]);
    const changed = [...season[1]!];
    changed[1] = "10:00 am";
    expect(outcomes(await runSchedule(pool, owner, sheet([header, changed]), now, true))).toEqual([
      [2, "update"],
    ]);
    expect((await posted())[0]?.status).toBe("postponed");
    expect(
      outcomes(
        await runSchedule(
          pool,
          owner,
          sheet([
            [...header, "Status"],
            [...changed, "On"],
          ]),
          now,
          true,
        ),
      ),
    ).toEqual([[2, "update"]]);
    expect((await posted())[0]?.status).toBe("published");
  });

  it("says when a sheet has nothing to read or too much", async () => {
    expect(await runSchedule(pool, owner, sheet([header]), now, false)).toMatchObject({
      ok: false,
      errors: { form: expect.stringContaining("No matches found") },
    });
    const long = [
      header,
      ...Array.from({ length: 201 }, (_, at) => [`${(at % 28) + 1}/12/2026`, "9:30", `Side ${at}`]),
    ];
    expect(await runSchedule(pool, owner, sheet(long), now, false)).toMatchObject({
      ok: false,
      errors: { form: expect.stringContaining("Add up to 200 at a time") },
    });
  });
});

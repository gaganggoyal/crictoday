import { randomUUID } from "node:crypto";
import mysql, { type Pool } from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { upsertUserRole } from "@/lib/data/mysql/auth";
import {
  attachProfileImage,
  captionProfileImage,
  loadRecentImages,
  moveProfileImage,
  removeOwnProfileImage,
  removeProfileImageAsStaff,
} from "@/lib/data/mysql/media";
import { migrate } from "@/lib/data/mysql/migrate";
import { createPool } from "@/lib/data/mysql/pool";
import {
  createProfile,
  loadOwnerProfiles,
  reviewProfile,
  type Owner,
} from "@/lib/data/mysql/profiles";
import { loadDirectory } from "@/lib/data/mysql/reads";
import { MAX_PHOTOS } from "@/lib/domain/media";
import type { ProfileImage } from "@/lib/domain/types";
import type { ProfileInput } from "@/lib/validation/profile";

// Runs against MySQL 8 when MYSQL_TEST_URL is set, like tests/mysql/backend.test.ts.
const serverUrl = process.env.MYSQL_TEST_URL;
const now = new Date("2026-10-10T06:00:00.000Z");

const academy: ProfileInput = {
  kind: "academy",
  name: "Nashik Cricket Academy",
  description: "Coaching for juniors from U10 to U19, with nets every evening and summer camps.",
  country: "india",
  state: "maharashtra",
  city: "nashik",
  address: "College Road",
  timezone: "",
  contactEmail: "coach@example.com",
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

let counter = 0;
const image = (): ProfileImage => {
  counter += 1;
  return {
    id: counter.toString(16).padStart(32, "0"),
    width: 1600,
    height: 900,
    smallWidth: 640,
    smallHeight: 360,
    caption: null,
    addedAt: now.toISOString(),
  };
};

describe.skipIf(!serverUrl)("profile pictures on MySQL", () => {
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
    const ownerUser = await upsertUserRole(pool, "coach@example.com", "fan", now);
    owner = { userId: ownerUser.id, email: ownerUser.email };
    const strangerUser = await upsertUserRole(pool, "stranger@example.com", "fan", now);
    stranger = { userId: strangerUser.id, email: strangerUser.email };
    const created = await createProfile(pool, owner, academy, now);
    slug = created.ok ? created.slug : "";
  });

  afterAll(async () => {
    await pool?.end();
    const server = await mysql.createConnection({ uri: serverUrl });
    await server.query(`DROP DATABASE IF EXISTS \`${database}\``);
    await server.end();
  });

  const pictures = async () => {
    const [profile] = await loadOwnerProfiles(pool, owner);
    return { logo: profile!.logo, cover: profile!.cover, photos: profile!.photos };
  };

  it("starts without pictures and keeps them to the profile's owner", async () => {
    expect(await pictures()).toEqual({ logo: null, cover: null, photos: [] });
    expect(
      await attachProfileImage(
        pool,
        stranger,
        { profile: slug, role: "logo", image: image() },
        now,
      ),
    ).toEqual({ ok: false, errors: { form: "That profile is not on your account." } });
  });

  it("replaces a logo and reports the old one for deletion", async () => {
    const first = image();
    expect(
      await attachProfileImage(pool, owner, { profile: slug, role: "logo", image: first }, now),
    ).toEqual({ ok: true, replaced: [] });
    const second = image();
    expect(
      await attachProfileImage(pool, owner, { profile: slug, role: "logo", image: second }, now),
    ).toEqual({ ok: true, replaced: [first.id] });
    expect((await pictures()).logo).toEqual(second);
  });

  it("holds up to twelve photos in order, with captions and moves", async () => {
    const added: ProfileImage[] = [];
    for (let index = 0; index < MAX_PHOTOS; index += 1) {
      const photo = image();
      added.push(photo);
      await attachProfileImage(pool, owner, { profile: slug, role: "photo", image: photo }, now);
    }
    expect(
      await attachProfileImage(pool, owner, { profile: slug, role: "photo", image: image() }, now),
    ).toMatchObject({ ok: false, errors: { file: expect.stringContaining("up to 12 photos") } });

    await captionProfileImage(
      pool,
      owner,
      { profile: slug, id: added[1]!.id, caption: "Under-14 nets" },
      now,
    );
    await moveProfileImage(pool, owner, { profile: slug, id: added[1]!.id, direction: -1 }, now);
    // Moving the first photo earlier changes nothing.
    await moveProfileImage(pool, owner, { profile: slug, id: added[1]!.id, direction: -1 }, now);
    const { photos } = await pictures();
    expect(photos.map((photo) => photo.id).slice(0, 3)).toEqual([
      added[1]!.id,
      added[0]!.id,
      added[2]!.id,
    ]);
    expect(photos[0]!.caption).toBe("Under-14 nets");

    expect(
      await removeOwnProfileImage(pool, owner, { profile: slug, id: added[0]!.id }, now),
    ).toEqual({ ok: true, removed: [added[0]!.id] });
    expect(
      await removeOwnProfileImage(pool, owner, { profile: slug, id: added[0]!.id }, now),
    ).toEqual({ ok: true, removed: [] });
    expect((await pictures()).photos).toHaveLength(MAX_PHOTOS - 1);
  });

  it("shows pictures publicly once the profile is live, and lets moderators take them down", async () => {
    expect((await loadDirectory(pool)).academies).toEqual([]);
    await reviewProfile(pool, { actorId: moderator, slug, action: "approve" }, now);
    const [listed] = (await loadDirectory(pool)).academies;
    expect(listed?.logo?.id).toBe((await pictures()).logo?.id);
    expect(listed?.photos).toHaveLength(MAX_PHOTOS - 1);

    const cover = image();
    await attachProfileImage(pool, owner, { profile: slug, role: "cover", image: cover }, now);
    const recent = await loadRecentImages(pool, new Date(now.getTime() - 1000));
    expect(recent.map((item) => item.role)).toContain("cover");
    expect(recent[0]?.profile).toEqual({ slug, name: academy.name, kind: "academy" });

    expect(
      await removeProfileImageAsStaff(pool, owner.userId, { profile: slug, id: cover.id }, now),
    ).toEqual({ ok: false, errors: { form: "Moderator access is required." } });
    expect(
      await removeProfileImageAsStaff(pool, moderator, { profile: slug, id: cover.id }, now),
    ).toEqual({ ok: true, removed: [cover.id] });
    expect((await pictures()).cover).toBeNull();
  });
});

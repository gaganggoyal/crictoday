import type { Pool, PoolConnection } from "mysql2/promise";
import { DomainError } from "@/lib/data/mysql/pool";
import { ownedProfile, type Owner } from "@/lib/data/mysql/profiles";
import { toAcademy, writeAudit, type AcademyRow } from "@/lib/data/mysql/rows";
import { STAFF, actorWithRole, attempt } from "@/lib/data/mysql/writes";
import { MAX_PHOTOS, profileImages, type ImageRole } from "@/lib/domain/media";
import type { ProfileImage, StoredAcademy } from "@/lib/domain/types";

type Pictures = Pick<StoredAcademy, "logo" | "cover" | "photos">;

async function savePictures(
  connection: PoolConnection,
  profile: StoredAcademy,
  next: Pictures,
  now: Date,
) {
  await connection.query(
    "UPDATE academies SET logo = ?, cover = ?, photos = ?, updated_at = ? WHERE id = ?",
    [
      next.logo ? JSON.stringify(next.logo) : null,
      next.cover ? JSON.stringify(next.cover) : null,
      JSON.stringify(next.photos),
      now,
      profile.id,
    ],
  );
}

/** The profile's pictures without one of them, or null when it is not there. */
function withoutPicture(profile: StoredAcademy, id: string): Pictures | null {
  const pictures: Pictures = { logo: profile.logo, cover: profile.cover, photos: profile.photos };
  if (profile.logo?.id === id) return { ...pictures, logo: null };
  if (profile.cover?.id === id) return { ...pictures, cover: null };
  const photos = profile.photos.filter((photo) => photo.id !== id);
  return photos.length === profile.photos.length ? null : { ...pictures, photos };
}

/**
 * Puts a stored picture on an owner's profile. A new logo or cover replaces the old one; the
 * caller deletes the files of whatever `replaced` lists once this has committed.
 */
export async function attachProfileImage(
  pool: Pool,
  owner: Owner,
  input: { profile: string; role: ImageRole; image: ProfileImage },
  now: Date,
) {
  return attempt(pool, async (connection) => {
    const profile = await ownedProfile(connection, owner, input.profile);
    const next: Pictures = { logo: profile.logo, cover: profile.cover, photos: profile.photos };
    const replaced: string[] = [];
    if (input.role === "photo") {
      if (profile.photos.length >= MAX_PHOTOS) {
        throw new DomainError({
          file: `A profile can show up to ${MAX_PHOTOS} photos. Remove one to add another.`,
        });
      }
      next.photos = [...profile.photos, input.image];
    } else {
      const previous = profile[input.role];
      if (previous) replaced.push(previous.id);
      next[input.role] = input.image;
    }
    await savePictures(connection, profile, next, now);
    await writeAudit(
      connection,
      {
        actorId: owner.userId,
        actorEmail: owner.email,
        action: "profile.image.add",
        entityType: "academy",
        entityId: profile.id,
        before: replaced.length ? { id: replaced[0] } : null,
        after: { role: input.role, id: input.image.id },
      },
      now,
    );
    return { ok: true as const, replaced };
  });
}

/** Takes a picture off an owner's profile. The caller deletes the files it lists. */
export async function removeOwnProfileImage(
  pool: Pool,
  owner: Owner,
  input: { profile: string; id: string },
  now: Date,
) {
  return attempt(pool, async (connection) => {
    const profile = await ownedProfile(connection, owner, input.profile);
    const next = withoutPicture(profile, input.id);
    if (!next) return { ok: true as const, removed: [] as string[] };
    await savePictures(connection, profile, next, now);
    await writeAudit(
      connection,
      {
        actorId: owner.userId,
        actorEmail: owner.email,
        action: "profile.image.remove",
        entityType: "academy",
        entityId: profile.id,
        before: { id: input.id },
        after: null,
      },
      now,
    );
    return { ok: true as const, removed: [input.id] };
  });
}

/** A moderator takes a picture down from any profile. */
export async function removeProfileImageAsStaff(
  pool: Pool,
  actorId: string,
  input: { profile: string; id: string },
  now: Date,
) {
  return attempt(pool, async (connection) => {
    const actor = await actorWithRole(connection, actorId, STAFF, "Moderator access is required.");
    const [rows] = await connection.query<AcademyRow[]>(
      "SELECT * FROM academies WHERE slug = ? FOR UPDATE",
      [input.profile],
    );
    if (!rows[0]) throw new DomainError({ form: "Profile not found." });
    const profile = toAcademy(rows[0]);
    const next = withoutPicture(profile, input.id);
    if (!next) return { ok: true as const, removed: [] as string[] };
    await savePictures(connection, profile, next, now);
    await writeAudit(
      connection,
      {
        actorId: actor.id,
        actorEmail: actor.email,
        action: "profile.image.takedown",
        entityType: "academy",
        entityId: profile.id,
        before: { id: input.id },
        after: null,
      },
      now,
    );
    return { ok: true as const, removed: [input.id] };
  });
}

/** Sets or clears the caption under a gallery photo. */
export async function captionProfileImage(
  pool: Pool,
  owner: Owner,
  input: { profile: string; id: string; caption: string },
  now: Date,
) {
  return attempt(pool, async (connection) => {
    const profile = await ownedProfile(connection, owner, input.profile);
    if (!profile.photos.some((photo) => photo.id === input.id)) {
      throw new DomainError({ form: "That photo was removed." });
    }
    const photos = profile.photos.map((photo) =>
      photo.id === input.id ? { ...photo, caption: input.caption || null } : photo,
    );
    await savePictures(connection, profile, { ...profile, photos }, now);
    return { ok: true as const };
  });
}

/** Moves a gallery photo one place earlier or later. */
export async function moveProfileImage(
  pool: Pool,
  owner: Owner,
  input: { profile: string; id: string; direction: -1 | 1 },
  now: Date,
) {
  return attempt(pool, async (connection) => {
    const profile = await ownedProfile(connection, owner, input.profile);
    const from = profile.photos.findIndex((photo) => photo.id === input.id);
    const to = from + input.direction;
    if (from === -1 || to < 0 || to >= profile.photos.length) return { ok: true as const };
    const photos = [...profile.photos];
    [photos[from], photos[to]] = [photos[to]!, photos[from]!];
    await savePictures(connection, profile, { ...profile, photos }, now);
    return { ok: true as const };
  });
}

/** Pictures added to live profiles since a date, newest first, for moderators to look over. */
export async function loadRecentImages(pool: Pool, since: Date) {
  const [rows] = await pool.query<AcademyRow[]>(
    `SELECT * FROM academies
     WHERE demo = 0 AND verification_status = 'verified' AND updated_at >= ?
     ORDER BY updated_at DESC LIMIT 200`,
    [since],
  );
  return rows
    .map((row) => toAcademy(row))
    .flatMap((profile) =>
      profileImages(profile)
        .filter(({ image }) => new Date(image.addedAt) >= since)
        .map(({ role, image }) => ({
          profile: { slug: profile.slug, name: profile.name, kind: profile.kind },
          role,
          image,
        })),
    )
    .sort((a, b) => b.image.addedAt.localeCompare(a.image.addedAt));
}

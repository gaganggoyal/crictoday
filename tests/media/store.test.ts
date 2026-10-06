import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { imageSrc, socialImageSrc } from "@/lib/domain/media";
import {
  ImageError,
  deleteProfileImageFiles,
  readProfileImageAsJpeg,
  readProfileImageFile,
  storeProfileImage,
} from "@/lib/media/store";

const now = new Date("2026-10-06T10:00:00.000Z");
let directory: string;
const previous = process.env.UPLOAD_DIR;

const picture = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: "#176b43" } });

beforeAll(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "cm-media-"));
  process.env.UPLOAD_DIR = directory;
});

afterAll(async () => {
  if (previous === undefined) delete process.env.UPLOAD_DIR;
  else process.env.UPLOAD_DIR = previous;
  await rm(directory, { recursive: true, force: true });
});

describe("profile pictures", () => {
  it("turns a phone photo upright, shrinks it, and drops its camera data", async () => {
    // A landscape sensor image that the camera marked "rotate 90°", with GPS-like EXIF.
    const photo = await picture(2400, 1200)
      .jpeg()
      .withMetadata({ orientation: 6, exif: { IFD0: { Copyright: "Someone's phone" } } })
      .toBuffer();
    const stored = await storeProfileImage(photo, "photo", now);
    expect(stored).toMatchObject({
      width: 800,
      height: 1600,
      smallWidth: 320,
      smallHeight: 640,
      caption: null,
      addedAt: now.toISOString(),
    });
    expect(stored.id).toMatch(/^[0-9a-f]{32}$/);
    const full = await readProfileImageFile(`${stored.id}.webp`);
    const metadata = await sharp(full!).metadata();
    expect(metadata).toMatchObject({ format: "webp", width: 800, height: 1600 });
    expect(metadata.exif).toBeUndefined();
    expect(metadata.orientation).toBeUndefined();
  });

  it("keeps a logo's clear background and does not blow up a small one", async () => {
    const logo = await sharp({
      create: { width: 300, height: 200, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .png()
      .toBuffer();
    const stored = await storeProfileImage(logo, "logo", now);
    expect([stored.width, stored.height, stored.smallWidth, stored.smallHeight]).toEqual([
      300, 200, 160, 107,
    ]);
    const small = await readProfileImageFile(`${stored.id}-sm.webp`);
    expect((await sharp(small!).metadata()).hasAlpha).toBe(true);
  });

  it("refuses files that are not raster pictures, and pictures too small to show", async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900"><script>alert(1)</script></svg>',
    );
    await expect(storeProfileImage(svg, "photo", now)).rejects.toThrow(ImageError);
    await expect(storeProfileImage(Buffer.from("not a picture"), "logo", now)).rejects.toThrow(
      "Use a JPEG, PNG or WebP picture.",
    );
    // A JPEG header on a broken body.
    const broken = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)]);
    await expect(storeProfileImage(broken, "photo", now)).rejects.toThrow(ImageError);
    const tiny = await picture(200, 150).png().toBuffer();
    await expect(storeProfileImage(tiny, "cover", now)).rejects.toThrow(
      "at least 400 pixels on each side",
    );
  });

  it("serves only its own file names, makes a JPEG for link previews, and deletes every copy", async () => {
    const stored = await storeProfileImage(
      await picture(1600, 900).jpeg().toBuffer(),
      "cover",
      now,
    );
    expect(imageSrc(stored)).toBe(`/media/profiles/${stored.id}.webp`);
    expect(await readProfileImageFile("../../etc/passwd")).toBeNull();
    expect(await readProfileImageFile(`${stored.id}.webp.tmp`)).toBeNull();

    const share = path.basename(socialImageSrc(stored));
    const jpeg = await readProfileImageAsJpeg(share);
    expect((await sharp(jpeg!).metadata()).format).toBe("jpeg");
    expect(await readProfileImageAsJpeg(`${stored.id}.jpg`)).toBeNull();

    await deleteProfileImageFiles([stored.id, "../not-an-id"]);
    const left = await readdir(path.join(directory, "profiles"));
    expect(left.filter((file) => file.startsWith(stored.id))).toEqual([]);
    expect(await readProfileImageAsJpeg(share)).toBeNull();
  });
});

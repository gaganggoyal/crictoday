import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp, { type Metadata, type OutputInfo } from "sharp";
import { IMAGE_SPEC, MEDIA_FILE, SOCIAL_FILE, type ImageRole } from "@/lib/domain/media";
import type { ProfileImage } from "@/lib/domain/types";

/** A picture that cannot be used, with a message for the person who sent it. */
export class ImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageError";
  }
}

/** Where uploads live. Production sets UPLOAD_DIR outside the checkout, so deploys keep them. */
export function mediaRoot() {
  // Read at run time; the comment keeps the build from tracing the whole project for it.
  return path.resolve(
    /* turbopackIgnore: true */ process.env.UPLOAD_DIR ||
      path.join(process.cwd(), ".data", "uploads"),
  );
}

function profileDir() {
  return path.join(mediaRoot(), "profiles");
}

// Raster formats only: SVG can carry scripts and links, so it is never decoded.
const FORMATS = new Set(["jpeg", "png", "webp", "gif", "avif", "heif", "tiff"]);
// About 60 megapixels. Larger photos are shrunk in the browser before they are sent.
const MAX_PIXELS = 60_000_000;

/** Raster formats by their first bytes, checked before any decoder sees the file. */
function looksLikeRaster(input: Buffer) {
  const ascii = (start: number, end: number) => input.subarray(start, end).toString("latin1");
  return (
    (input[0] === 0xff && input[1] === 0xd8 && input[2] === 0xff) ||
    ascii(0, 8) === "\x89PNG\r\n\x1a\n" ||
    (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") ||
    ascii(0, 4) === "GIF8" ||
    ascii(4, 8) === "ftyp" ||
    ascii(0, 4) === "II*\0" ||
    ascii(0, 4) === "MM\0*"
  );
}

function decoder(input: Buffer) {
  return sharp(input, { limitInputPixels: MAX_PIXELS, failOn: "error", animated: false });
}

async function writeAtomic(file: string, data: Buffer) {
  const temporary = `${file}.${randomBytes(4).toString("hex")}.tmp`;
  await writeFile(temporary, data, { mode: 0o644 });
  await rename(temporary, file);
}

/**
 * Checks a picture, turns it upright, and writes it as two WebP files without its metadata
 * (camera, GPS). The original is not kept.
 */
export async function storeProfileImage(
  input: Buffer,
  role: ImageRole,
  now: Date,
): Promise<ProfileImage> {
  const spec = IMAGE_SPEC[role];
  if (!looksLikeRaster(input)) throw new ImageError("Use a JPEG, PNG or WebP picture.");
  let metadata: Metadata;
  try {
    metadata = await decoder(input).metadata();
  } catch {
    throw new ImageError("That file is not a picture we can read. Use a JPEG, PNG or WebP.");
  }
  if (!metadata.format || !FORMATS.has(metadata.format)) {
    throw new ImageError("Use a JPEG, PNG or WebP picture.");
  }
  if ((metadata.width ?? 0) * (metadata.height ?? 0) > MAX_PIXELS) {
    throw new ImageError("That picture is too large. Use a smaller copy.");
  }
  if (Math.min(metadata.width ?? 0, metadata.height ?? 0) < spec.minEdge) {
    throw new ImageError(
      `That picture is too small. Use one at least ${spec.minEdge} pixels on each side.`,
    );
  }

  const id = randomBytes(16).toString("hex");
  const upright = decoder(input).rotate();
  const encode = (edge: number, quality: number) =>
    upright
      .clone()
      .resize({ width: edge, height: edge, fit: "inside", withoutEnlargement: true })
      .webp({ quality, effort: 4 })
      .toBuffer({ resolveWithObject: true });
  let full: { data: Buffer; info: OutputInfo };
  let small: { data: Buffer; info: OutputInfo };
  try {
    [full, small] = await Promise.all([
      encode(spec.full, role === "logo" ? 90 : 82),
      encode(spec.small, 78),
    ]);
  } catch {
    throw new ImageError("That picture could not be read. Try saving it again as a JPEG.");
  }

  await mkdir(profileDir(), { recursive: true });
  await writeAtomic(path.join(profileDir(), `${id}.webp`), full.data);
  await writeAtomic(path.join(profileDir(), `${id}-sm.webp`), small.data);
  return {
    id,
    width: full.info.width,
    height: full.info.height,
    smallWidth: small.info.width,
    smallHeight: small.info.height,
    caption: null,
    addedAt: now.toISOString(),
  };
}

/** Deletes pictures' files. A file that is already gone is fine. */
export async function deleteProfileImageFiles(ids: string[]) {
  await Promise.all(
    ids
      .filter((id) => /^[0-9a-f]{32}$/.test(id))
      .flatMap((id) => [`${id}.webp`, `${id}-sm.webp`, `${id}-share.jpg`])
      .map((file) => rm(path.join(profileDir(), file), { force: true })),
  );
}

/** A stored file's bytes, or null for a name that is not ours or a file that is gone. */
export async function readProfileImageFile(file: string) {
  if (!MEDIA_FILE.test(file)) return null;
  try {
    return await readFile(path.join(profileDir(), file));
  } catch {
    return null;
  }
}

/**
 * A JPEG of a stored picture for link previews. It is made when a chat app first asks for it,
 * then kept beside the WebP files.
 */
export async function readProfileImageAsJpeg(file: string) {
  const id = SOCIAL_FILE.exec(file)?.[1];
  if (!id) return null;
  const target = path.join(profileDir(), file);
  const saved = await readFile(target).catch(() => null);
  if (saved) return saved;
  const webp = await readProfileImageFile(`${id}.webp`);
  if (!webp) return null;
  const jpeg = await sharp(webp)
    .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
  await writeAtomic(target, jpeg).catch(() => undefined);
  // A picture taken down while this ran must not live on as its JPEG.
  if (!(await readProfileImageFile(`${id}.webp`))) {
    await rm(target, { force: true });
    return null;
  }
  return jpeg;
}

import type { ProfileImage } from "@/lib/domain/types";

/** The pictures a profile can have: one logo, one cover across the top, and a gallery. */
export const IMAGE_ROLES = ["logo", "cover", "photo"] as const;
export type ImageRole = (typeof IMAGE_ROLES)[number];

export const IMAGE_ROLE_LABEL: Record<ImageRole, string> = {
  logo: "logo",
  cover: "cover photo",
  photo: "photo",
};

/**
 * Longest edge of the stored files, and of the copy a browser sends. `minEdge` is the shortest
 * edge we accept: smaller pictures look blurred where they show.
 */
export const IMAGE_SPEC: Record<
  ImageRole,
  { full: number; small: number; send: number; minEdge: number }
> = {
  logo: { full: 512, small: 160, send: 1024, minEdge: 64 },
  cover: { full: 1920, small: 800, send: 2400, minEdge: 400 },
  photo: { full: 1600, small: 640, send: 2000, minEdge: 300 },
};

export const MAX_PHOTOS = 12;
/** The largest file the server takes. Browsers shrink photos well below this before sending. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const MAX_CAPTION = 140;

export function isImageRole(value: unknown): value is ImageRole {
  return typeof value === "string" && (IMAGE_ROLES as readonly string[]).includes(value);
}

/** A stored picture's file name: `<id>.webp`, or `<id>-sm.webp` for the small copy. */
export const MEDIA_FILE = /^([0-9a-f]{32})(-sm)?\.webp$/;

export function imageSrc(image: Pick<ProfileImage, "id">, size: "full" | "small" = "full") {
  return `/media/profiles/${image.id}${size === "small" ? "-sm" : ""}.webp`;
}

/** A JPEG copy for link previews, since some chat apps do not show WebP. */
export const SOCIAL_FILE = /^([0-9a-f]{32})-share\.jpg$/;

export function socialImageSrc(image: Pick<ProfileImage, "id">) {
  return `/media/profiles/${image.id}-share.jpg`;
}

/** Every picture on a profile, for clean-up and moderation. */
export function profileImages(profile: {
  logo: ProfileImage | null;
  cover: ProfileImage | null;
  photos: ProfileImage[];
}) {
  const images: Array<{ role: ImageRole; image: ProfileImage }> = [];
  if (profile.logo) images.push({ role: "logo", image: profile.logo });
  if (profile.cover) images.push({ role: "cover", image: profile.cover });
  for (const image of profile.photos) images.push({ role: "photo", image });
  return images;
}

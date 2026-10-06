import "server-only";
import { getDirectory } from "@/lib/data/catalog";
import { inDefaultWindow } from "@/lib/domain/filters";

/** A public profile with its upcoming matches, from one directory read. */
export async function getProfilePage(slug: string) {
  const directory = await getDirectory();
  const profile = directory.academies.find((academy) => academy.slug === slug);
  if (!profile) return null;
  const now = new Date();
  const matches = directory.matches
    .filter((match) => match.academySlug === slug && inDefaultWindow(match, now))
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  return { profile, matches, now };
}

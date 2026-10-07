import "server-only";
import { currentTime } from "@/lib/clock";
import { getDirectory } from "@/lib/data/catalog";
import { matchesToCome } from "@/lib/domain/filters";

/** A public profile with its upcoming matches, from one directory read. */
export async function getProfilePage(slug: string) {
  const directory = await getDirectory();
  const profile = directory.academies.find((academy) => academy.slug === slug);
  if (!profile) return null;
  const now = currentTime();
  const matches = matchesToCome(
    directory.matches.filter((match) => match.academySlug === slug),
    now,
  );
  return { profile, matches, now };
}

import type { OfferingCategory, ProfileKind, StoredAcademy } from "@/lib/domain/types";

export const PROFILE_KINDS: ProfileKind[] = ["academy", "club", "committee", "ground"];

export const PROFILE_KIND_LABEL: Record<ProfileKind, string> = {
  academy: "Academy",
  club: "Club",
  committee: "Committee or league",
  ground: "Ground or turf",
};

export const PROFILE_KIND_PLURAL: Record<ProfileKind, string> = {
  academy: "Academies",
  club: "Clubs",
  committee: "Committees and leagues",
  ground: "Grounds and turfs",
};

export const PROFILE_KIND_HINT: Record<ProfileKind, string> = {
  academy: "Coaching for juniors or adults, camps and trials.",
  club: "A team or club that plays matches and takes members.",
  committee: "Runs a tournament, a local league or the cricket in a town.",
  ground: "A ground, turf or box-cricket venue that hosts games and takes bookings.",
};

export const OFFERING_CATEGORIES: OfferingCategory[] = [
  "coaching",
  "camp",
  "trials",
  "nets",
  "ground",
  "tournament",
  "membership",
  "other",
];

export const OFFERING_LABEL: Record<OfferingCategory, string> = {
  coaching: "Coaching",
  camp: "Camp",
  trials: "Trials",
  nets: "Nets and practice",
  ground: "Ground hire",
  tournament: "Tournament entry",
  membership: "Membership",
  other: "Other",
};

export const AGE_GROUPS = ["U10", "U12", "U14", "U16", "U19", "Senior", "Women's"];
export const FACILITIES = [
  "Nets",
  "Turf pitch",
  "Indoor",
  "Bowling machine",
  "Floodlights",
  "Gym",
  "Video analysis",
  "Changing rooms",
  "Parking",
];

/** Limits that keep a profile readable and the queue small. */
export const MAX_OFFERINGS = 30;
export const MAX_PROFILES_PER_ACCOUNT = 5;
export const MAX_UPCOMING_MATCHES = 300;

export function profilePath(profile: Pick<StoredAcademy, "kind" | "slug">) {
  return `${profile.kind === "academy" ? "/academy" : "/club"}/${profile.slug}`;
}

/** A wa.me link for a phone number written with its country code, or null. */
export function whatsappHref(number: string | null | undefined) {
  const digits = (number ?? "").replace(/\D/g, "");
  return digits.length >= 8 ? `https://wa.me/${digits}` : null;
}

export function telHref(number: string | null | undefined) {
  const cleaned = (number ?? "").replace(/[^\d+]/g, "");
  return cleaned.replace(/\D/g, "").length >= 6 ? `tel:${cleaned}` : null;
}

/** The code a match card shows for a side: initials for a name of several words. */
export function shortName(name: string) {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length >= 2) {
    return words
      .slice(0, 4)
      .map((word) => word[0])
      .join("")
      .toUpperCase();
  }
  return (words[0] ?? name).slice(0, 3).toUpperCase();
}

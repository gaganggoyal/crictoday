import "server-only";
import { countries } from "@/lib/data/seed";
import type { StoredAcademy } from "@/lib/domain/types";
import type { ProfileDefaults } from "@/components/profile/profile-form";

/** Countries a profile can be in, India first. */
export const PROFILE_COUNTRIES = [...countries]
  .sort((a, b) => (a.slug === "india" ? -1 : b.slug === "india" ? 1 : a.name.localeCompare(b.name)))
  .map(({ slug, name }) => ({ slug, name }));

/** The form's starting values for a new profile, or the current ones of an existing profile. */
export function profileDefaults(
  profile: StoredAcademy | null,
  email: string,
  kind = "",
): ProfileDefaults {
  return {
    kind: profile?.kind ?? kind,
    name: profile?.name ?? "",
    description: profile?.description ?? "",
    country: profile?.countrySlug ?? "india",
    state: profile?.stateSlug ?? "",
    city: profile?.cityName ?? "",
    address: profile?.address ?? "",
    timezone: profile && profile.countrySlug !== "india" ? (profile.timezone ?? "") : "",
    contactEmail: profile?.contactEmail ?? email,
    phone: profile?.phone ?? "",
    whatsapp: profile?.whatsapp ?? "",
    website: profile?.website ?? "",
    instagram: profile?.links.instagram ?? "",
    facebook: profile?.links.facebook ?? "",
    youtube: profile?.links.youtube ?? "",
    ageGroups: profile?.ageGroups ?? [],
    facilities: profile?.facilities ?? [],
    companyWebsite: "",
  };
}

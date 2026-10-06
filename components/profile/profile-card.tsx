import Link from "next/link";
import { MapPin } from "lucide-react";
import { ProfileCover, ProfileLogo } from "@/components/profile/profile-picture";
import { PROFILE_KIND_LABEL, profilePath } from "@/lib/domain/profiles";
import type { StoredAcademy } from "@/lib/domain/types";

export function ProfileCard({ profile }: { profile: StoredAcademy }) {
  const place = [profile.cityName, profile.stateName ?? profile.countryName].join(", ");
  return (
    <Link
      href={profilePath(profile)}
      className="group flex h-full flex-col overflow-hidden rounded-[1.25rem] border border-line bg-surface no-underline"
    >
      <ProfileCover cover={profile.cover} size="small" className="aspect-[16/7]" />
      <div className="flex flex-1 flex-col px-5 pb-5">
        <ProfileLogo
          name={profile.name}
          logo={profile.logo}
          size={64}
          className="-mt-8 shadow-sm ring-4 ring-surface"
        />
        <p className="mt-3 text-xs font-semibold tracking-[0.14em] text-link uppercase">
          {PROFILE_KIND_LABEL[profile.kind]}
          {profile.verificationLabel ? ` · ${profile.verificationLabel}` : ""}
        </p>
        <h3 className="mt-1 font-display text-2xl leading-tight font-extrabold group-hover:underline">
          {profile.name}
        </h3>
        <p className="mt-2 flex items-start gap-1.5 text-sm text-muted">
          <MapPin aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
          {place}
        </p>
        {profile.offerings.length ? (
          <ul className="mt-4 flex flex-wrap gap-2 text-xs" aria-label="Offers">
            {profile.offerings.slice(0, 3).map((offering) => (
              <li key={offering.id} className="rounded-full border border-line px-2.5 py-1">
                {offering.title}
              </li>
            ))}
            {profile.offerings.length > 3 ? (
              <li className="px-1 py-1 text-muted">+{profile.offerings.length - 3} more</li>
            ) : null}
          </ul>
        ) : profile.ageGroups.length ? (
          <p className="mt-3 text-sm">{profile.ageGroups.join(" · ")}</p>
        ) : null}
        {profile.photos.length ? (
          <p className="mt-auto pt-4 text-xs text-muted">
            {profile.photos.length} {profile.photos.length === 1 ? "photo" : "photos"}
          </p>
        ) : null}
      </div>
    </Link>
  );
}

export function ProfileGrid({ profiles }: { profiles: StoredAcademy[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {profiles.map((profile) => (
        <ProfileCard key={profile.slug} profile={profile} />
      ))}
    </div>
  );
}

/** The invitation shown where a place has no clubs listed yet. */
export function ListYoursCallout({ place }: { place: string }) {
  return (
    <div className="rounded-[1.25rem] border border-dashed border-line bg-surface p-6">
      <h3 className="font-display text-2xl font-extrabold">
        Run a club, academy or committee in {place}?
      </h3>
      <p className="mt-2 max-w-xl text-muted">
        Create a free profile with your coaching, camps, ground hire and contact details, then post
        your matches. They appear here and on your own page.
      </p>
      <Link
        href="/get-listed"
        className="mt-4 inline-flex min-h-11 items-center rounded-full bg-[#176B43] px-5 font-medium text-white"
      >
        List your club for free
      </Link>
    </div>
  );
}

import Link from "next/link";
import { ImageTakedown } from "@/components/admin/image-takedown";
import { ProfileReview } from "@/components/admin/profile-review";
import { profileQueue, recentProfileImages } from "@/lib/data/profiles";
import { profileImages } from "@/lib/domain/media";
import { PROFILE_KIND_LABEL, profilePath } from "@/lib/domain/profiles";
import type { StoredAcademy } from "@/lib/domain/types";

export default async function AdminProfilesPage() {
  const [{ pending, recent }, pictures] = await Promise.all([
    profileQueue(),
    recentProfileImages(),
  ]);
  return (
    <>
      <h1 className="font-display text-4xl font-extrabold">Profiles</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Check that each academy, club, committee or ground is real and that its contact belongs to
        it. Approving makes it public with its waiting matches, and emails the owner. Sending it
        back hides it and its matches until the owner fixes it.
      </p>
      <section className="mt-8">
        <h2 className="font-display text-2xl font-bold">Waiting ({pending.length})</h2>
        {pending.length ? (
          <ul className="mt-4 grid gap-4">
            {pending.map((profile) => (
              <li
                key={profile.slug}
                className="grid gap-4 rounded-[1.25rem] border border-line bg-surface p-5 lg:grid-cols-[minmax(0,1fr)_22rem]"
              >
                <ProfileFacts profile={profile} />
                <ProfileReview slug={profile.slug} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-muted">Nothing is waiting.</p>
        )}
      </section>
      <section className="mt-10">
        <h2 className="font-display text-2xl font-bold">
          New pictures on live profiles ({pictures.length})
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Logos and photos go live as soon as a checked profile adds them. These are the last two
          weeks&apos;. Take down anything that is not theirs to use or not about cricket.
        </p>
        {pictures.length ? (
          <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {pictures.map(({ profile, role, image }) => (
              <li key={image.id} className="grid content-start gap-1">
                <Link href={profilePath(profile)} className="truncate text-sm font-medium">
                  {profile.name}
                </Link>
                <ImageTakedown profile={profile.slug} role={role} image={image} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-muted">None.</p>
        )}
      </section>
      <section className="mt-10">
        <h2 className="font-display text-2xl font-bold">Recently decided</h2>
        <ul className="mt-3 grid gap-2 text-sm">
          {recent.map((profile) => (
            <li key={profile.slug} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-medium">
                {profile.verificationStatus === "verified" ? "Live" : "Sent back"}
              </span>
              {profile.verificationStatus === "verified" ? (
                <Link href={profilePath(profile)}>{profile.name}</Link>
              ) : (
                <span>{profile.name}</span>
              )}
              <span className="text-muted">
                {PROFILE_KIND_LABEL[profile.kind]} · {profile.cityName}
              </span>
              {profile.verificationStatus === "verified" ? (
                <details>
                  <summary className="cursor-pointer text-muted">Take down</summary>
                  <div className="mt-2 max-w-md">
                    <ProfileReview slug={profile.slug} />
                  </div>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function ProfileFacts({ profile }: { profile: StoredAcademy }) {
  const facts: Array<[string, React.ReactNode]> = [
    ["Kind", PROFILE_KIND_LABEL[profile.kind]],
    [
      "Place",
      `${profile.address}, ${profile.cityName}, ${profile.stateName ?? profile.countryName}`,
    ],
    ["Account", profile.ownerEmail ?? "None"],
    ["Contact email", profile.contactEmail ?? "None"],
    ["Phone", profile.phone ?? "None"],
    ["WhatsApp", profile.whatsapp ?? "None"],
    [
      "Links",
      [profile.website, profile.links.instagram, profile.links.facebook, profile.links.youtube]
        .filter((link): link is string => Boolean(link))
        .map((link) => (
          <a
            key={link}
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="block break-all"
          >
            {link}
          </a>
        )),
    ],
    ["Offers", String(profile.offerings.length)],
  ];
  const pictures = profileImages(profile);
  return (
    <div className="min-w-0">
      <p className="font-display text-2xl font-extrabold">{profile.name}</p>
      <p className="mt-2 text-sm whitespace-pre-line text-muted">{profile.description}</p>
      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        {facts.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-muted">{label}</dt>
            <dd className="break-words">{value}</dd>
          </div>
        ))}
      </dl>
      {pictures.length ? (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Pictures">
          {pictures.map(({ role, image }) => (
            <li key={image.id}>
              <ImageTakedown profile={profile.slug} role={role} image={image} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

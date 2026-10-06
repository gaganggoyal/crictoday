import Link from "next/link";
import { MapPin } from "lucide-react";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { MatchGrid } from "@/components/match/match-grid";
import { PhotoGallery } from "@/components/profile/photo-gallery";
import { ProfileCover, ProfileLogo } from "@/components/profile/profile-picture";
import {
  OFFERING_LABEL,
  PROFILE_KIND_LABEL,
  profilePath,
  telHref,
  whatsappHref,
} from "@/lib/domain/profiles";
import type { StoredAcademy, StoredMatch } from "@/lib/domain/types";
import { jsonLdScript, profileJsonLd } from "@/lib/seo";

const button =
  "inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-4 text-sm font-medium";

/** The public page of an academy, club, committee or ground. */
export function ProfileView({
  profile,
  matches,
  now,
}: {
  profile: StoredAcademy;
  matches: StoredMatch[];
  now: Date;
}) {
  const path = profilePath(profile);
  const place = [profile.cityName, profile.stateName ?? profile.countryName].join(", ");
  const map = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${profile.address}, ${place}`)}`;
  const whatsapp = whatsappHref(profile.whatsapp);
  const tel = telHref(profile.phone);
  const greeting = encodeURIComponent(`Hi ${profile.name}, I found you on cricketmatch.today.`);
  const links: Array<[string, string]> = [
    ["Website", profile.website ?? ""],
    ["Instagram", profile.links.instagram ?? ""],
    ["Facebook", profile.links.facebook ?? ""],
    ["YouTube", profile.links.youtube ?? ""],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  return (
    <article className="mx-auto w-full max-w-[1120px] px-5 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(profileJsonLd(profile, path)) }}
      />
      <Breadcrumbs
        crumbs={[
          { name: "Clubs and academies", path: "/academies" },
          ...(profile.stateSlug && profile.stateName
            ? [{ name: profile.stateName, path: `/country/india/state/${profile.stateSlug}` }]
            : []),
          { name: profile.cityName, path: `/country/${profile.countrySlug}/${profile.citySlug}` },
          { name: profile.name, path },
        ]}
      />
      {profile.cover ? (
        <ProfileCover
          cover={profile.cover}
          size="full"
          priority
          className="mt-4 aspect-[16/9] rounded-[1.5rem] sm:aspect-[3/1]"
        />
      ) : null}
      <div className={profile.cover ? "relative -mt-12 ml-4 sm:-mt-16 sm:ml-6" : "mt-5"}>
        <ProfileLogo
          name={profile.name}
          logo={profile.logo}
          size={profile.cover ? 112 : 88}
          className={profile.cover ? "shadow-lg ring-4 ring-background" : undefined}
        />
      </div>
      <p className="mt-4 text-xs font-semibold tracking-[0.16em] text-link uppercase">
        {PROFILE_KIND_LABEL[profile.kind]}
        {profile.verificationLabel ? ` · ${profile.verificationLabel}` : ""}
      </p>
      <h1 className="mt-1 font-display text-5xl leading-[0.98] font-extrabold tracking-tight">
        {profile.name}
      </h1>
      <p className="mt-3 flex items-start gap-1.5 text-muted">
        <MapPin aria-hidden="true" size={18} className="mt-0.5 shrink-0" />
        {profile.address}, {place}
      </p>
      <p className="mt-5 max-w-3xl text-[17px] leading-7 whitespace-pre-line">
        {profile.description}
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {whatsapp ? (
          <a
            className="inline-flex min-h-11 items-center rounded-full bg-[#176B43] px-4 text-sm font-medium text-white"
            href={`${whatsapp}?text=${greeting}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            WhatsApp
          </a>
        ) : null}
        {tel ? (
          <a className={button} href={tel}>
            Call {profile.phone}
          </a>
        ) : null}
        {profile.contactEmail ? (
          <a className={button} href={`mailto:${profile.contactEmail}`}>
            Email
          </a>
        ) : null}
        <a className={button} href={map} target="_blank" rel="noopener noreferrer">
          Map
        </a>
        {links.map(([label, href]) => (
          <a key={label} className={button} href={href} target="_blank" rel="noopener noreferrer">
            {label}
          </a>
        ))}
      </div>

      {profile.photos.length ? (
        <section aria-labelledby="photos" className="mt-12">
          <h2 id="photos" className="mb-4 font-display text-3xl font-extrabold">
            Photos
          </h2>
          <PhotoGallery name={profile.name} photos={profile.photos} />
        </section>
      ) : null}

      {profile.offerings.length ? (
        <section aria-labelledby="offers" className="mt-12">
          <h2 id="offers" className="font-display text-3xl font-extrabold">
            What {profile.name} offers
          </h2>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {profile.offerings.map((offering) => (
              <li
                key={offering.id}
                className="flex flex-col rounded-[1.25rem] border border-line bg-surface p-5"
              >
                <p className="text-xs font-semibold tracking-[0.14em] text-link uppercase">
                  {OFFERING_LABEL[offering.category]}
                </p>
                <h3 className="mt-2 text-lg font-semibold">{offering.title}</h3>
                {offering.price || offering.schedule ? (
                  <p className="mt-1 text-sm font-medium">
                    {[offering.price, offering.schedule].filter(Boolean).join(" · ")}
                  </p>
                ) : null}
                {offering.details ? (
                  <p className="mt-2 text-sm whitespace-pre-line text-muted">{offering.details}</p>
                ) : null}
                {offering.url ? (
                  <a
                    className="mt-auto pt-4 text-sm font-semibold text-link"
                    href={offering.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Book or enquire
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {profile.ageGroups.length || profile.facilities.length ? (
        <dl className="mt-10 grid gap-4 rounded-[1.25rem] border border-line bg-surface p-5 sm:grid-cols-2">
          {profile.ageGroups.length ? (
            <div>
              <dt className="text-sm text-muted">Age groups</dt>
              <dd>{profile.ageGroups.join(", ")}</dd>
            </div>
          ) : null}
          {profile.facilities.length ? (
            <div>
              <dt className="text-sm text-muted">Facilities</dt>
              <dd>{profile.facilities.join(", ")}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      <section aria-labelledby="fixtures" className="mt-12">
        <h2 id="fixtures" className="mb-4 font-display text-3xl font-extrabold">
          Upcoming matches
        </h2>
        {matches.length ? (
          <MatchGrid matches={matches} now={now} />
        ) : (
          <p className="text-muted">No upcoming matches are listed yet.</p>
        )}
      </section>

      <p className="mt-12 text-sm text-muted">
        {profile.lastVerifiedAt
          ? `Checked by a moderator on ${new Date(profile.lastVerifiedAt).toUTCString()}. `
          : ""}
        Is this yours, or is something wrong?{" "}
        <Link href={`/submit/academy?claim=${profile.slug}`}>Tell us</Link>.
      </p>
    </article>
  );
}

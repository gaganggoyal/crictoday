import Link from "next/link";
import { notFound } from "next/navigation";
import { MediaEditor } from "@/components/profile/media-editor";
import { OfferingsEditor } from "@/components/profile/offerings-editor";
import { ProfileForm } from "@/components/profile/profile-form";
import { ProfileLogo } from "@/components/profile/profile-picture";
import { getSession } from "@/lib/auth/session";
import { PROFILE_COUNTRIES, profileDefaults } from "@/lib/data/profile-form";
import { ownerProfile } from "@/lib/data/profiles";
import { stillToCome } from "@/lib/domain/filters";
import { PROFILE_KIND_LABEL, profilePath } from "@/lib/domain/profiles";
import { formatInTimeZone } from "@/lib/domain/time";
import type { StoredMatch } from "@/lib/domain/types";
import { pageMetadata } from "@/lib/seo";
import { firstParam } from "@/lib/utils";

export const metadata = pageMetadata(
  "Manage your profile",
  "Matches, offers and details.",
  "/dashboard",
  false,
);

const MATCH_STATUS: Partial<Record<StoredMatch["status"], string>> = {
  published: "Live",
  pending: "Waiting for your profile's check",
  postponed: "Postponed",
  cancelled: "Cancelled",
};

export default async function ManageProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) return null;
  const { slug } = await params;
  const query = await searchParams;
  const data = await ownerProfile(session, slug);
  if (!data) notFound();
  const { profile, matches } = data;
  const now = new Date();
  const upcoming = matches.filter((match) => stillToCome(match, now));
  const past = matches.filter((match) => !stillToCome(match, now)).reverse();
  const saved = firstParam(query.saved);
  const live = profile.verificationStatus === "verified";

  return (
    <div className="grid gap-10">
      <div>
        <p className="text-sm">
          <Link href="/dashboard">Your account</Link>
        </p>
        <div className="mt-3 flex items-center gap-4">
          <ProfileLogo name={profile.name} logo={profile.logo} size={64} />
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.14em] text-link uppercase">
              {PROFILE_KIND_LABEL[profile.kind]}
            </p>
            <h1 className="font-display text-4xl font-extrabold">{profile.name}</h1>
          </div>
        </div>
        <div className="mt-4 grid gap-2">
          {firstParam(query.created) ? (
            <Notice>Your profile is saved. Add your offers and matches while it waits.</Notice>
          ) : null}
          {saved ? (
            <Notice>
              Match saved.{" "}
              {live ? (
                <Link className="text-link" href={`/match/${saved}`}>
                  See the match page
                </Link>
              ) : null}
            </Notice>
          ) : null}
          {profile.verificationStatus === "rejected" ? (
            <Notice tone="warning">
              A moderator asked for a change: {profile.reviewNotes}. Edit the details below and save
              to send it back for its check.
            </Notice>
          ) : live ? (
            <Notice>
              Your profile is live at{" "}
              <Link className="text-link" href={profilePath(profile)}>
                {profilePath(profile)}
              </Link>
              . Matches you post go live at once.
            </Notice>
          ) : (
            <Notice>
              Waiting for its check. We email {profile.ownerEmail ?? "you"} when it is live, and
              your matches go public then.
            </Notice>
          )}
        </div>
        <nav aria-label="On this page" className="mt-5 flex flex-wrap gap-2 text-sm">
          {[
            ["#matches", "Matches"],
            ["#offers", "Offers"],
            ["#photos", "Logo and photos"],
            ["#details", "Details"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="inline-flex min-h-11 items-center rounded-full border border-line px-4"
            >
              {label}
            </a>
          ))}
        </nav>
      </div>

      <section id="matches" aria-labelledby="matches-heading" className="scroll-mt-32">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="matches-heading" className="font-display text-3xl font-extrabold">
            Matches
          </h2>
          {profile.verificationStatus === "rejected" ? null : (
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/dashboard/profiles/${profile.slug}/matches/new`}
                className="inline-flex min-h-11 items-center rounded-full bg-[#176B43] px-5 font-medium text-white"
              >
                Post a match
              </Link>
              <Link
                href={`/dashboard/profiles/${profile.slug}/matches/import`}
                className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-5 font-medium"
              >
                Add from a spreadsheet
              </Link>
            </div>
          )}
        </div>
        {upcoming.length ? (
          <MatchList owner={profile.slug} matches={upcoming} />
        ) : (
          <p className="mt-4 text-muted">
            No upcoming matches yet. Post a friendly or a league game, or add your whole season from
            a spreadsheet.
          </p>
        )}
        {past.length ? (
          <details className="mt-6">
            <summary className="cursor-pointer text-sm font-medium">
              Past matches ({past.length})
            </summary>
            <MatchList owner={profile.slug} matches={past} past />
          </details>
        ) : null}
      </section>

      <section id="offers" aria-labelledby="offers-heading" className="scroll-mt-32">
        <h2 id="offers-heading" className="mb-4 font-display text-3xl font-extrabold">
          Offers
        </h2>
        <OfferingsEditor profile={profile.slug} offerings={profile.offerings} />
      </section>

      <section id="photos" aria-labelledby="photos-heading" className="scroll-mt-32">
        <h2 id="photos-heading" className="font-display text-3xl font-extrabold">
          Logo and photos
        </h2>
        <p className="mt-2 mb-5 max-w-2xl text-muted">
          {live
            ? "Pictures show on your page and your card as soon as you add them."
            : "Pictures go public with your profile once it passes its check."}{" "}
          Use your own photos, or ones you have permission to use.
        </p>
        <MediaEditor
          profile={profile.slug}
          name={profile.name}
          logo={profile.logo}
          cover={profile.cover}
          photos={profile.photos}
        />
      </section>

      <section id="details" aria-labelledby="details-heading" className="max-w-3xl scroll-mt-32">
        <h2 id="details-heading" className="mb-4 font-display text-3xl font-extrabold">
          Details
        </h2>
        <ProfileForm
          slug={profile.slug}
          defaults={profileDefaults(profile, session.email)}
          countries={PROFILE_COUNTRIES}
        />
      </section>
    </div>
  );
}

function Notice({
  children,
  tone = "info",
}: {
  children: React.ReactNode;
  tone?: "info" | "warning";
}) {
  return (
    <p
      role="status"
      className={
        tone === "warning"
          ? "rounded-2xl border border-warning bg-surface px-4 py-3 text-sm"
          : "rounded-2xl bg-surface px-4 py-3 text-sm"
      }
    >
      {children}
    </p>
  );
}

function MatchList({
  owner,
  matches: list,
  past = false,
}: {
  owner: string;
  matches: StoredMatch[];
  past?: boolean;
}) {
  return (
    <ul className="mt-4 grid gap-3">
      {list.map((match) => (
        <li
          key={match.slug}
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4"
        >
          <div className="min-w-0">
            <p className="font-semibold">
              {match.homeName} vs {match.awayName}
            </p>
            <p className="text-sm text-muted">
              {formatInTimeZone(match.startsAt, match.timezone)} · {match.venueName},{" "}
              {match.cityName}
            </p>
            <p className="mt-1 text-xs font-semibold tracking-[0.12em] uppercase">
              {MATCH_STATUS[match.status] ?? match.status}
            </p>
          </div>
          <div className="flex gap-2">
            {past ? null : (
              <Link
                href={`/dashboard/profiles/${owner}/matches/${match.slug}`}
                className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm"
              >
                Edit
              </Link>
            )}
            {match.status !== "pending" ? (
              <Link
                href={`/match/${match.slug}`}
                className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm"
              >
                View
              </Link>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

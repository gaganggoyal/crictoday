import Link from "next/link";
import { ProfileLogo } from "@/components/profile/profile-picture";
import { getSession } from "@/lib/auth/session";
import { accountSnapshot } from "@/lib/data/account";
import { ownerProfiles, profilesEnabled } from "@/lib/data/profiles";
import { MAX_PROFILES_PER_ACCOUNT, PROFILE_KIND_LABEL, profilePath } from "@/lib/domain/profiles";
import type { StoredAcademy } from "@/lib/domain/types";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "Your account",
  "Your clubs, academies, matches and alerts.",
  "/dashboard",
  false,
);

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;
  const [account, profiles] = await Promise.all([accountSnapshot(session), ownerProfiles(session)]);
  const enabled = profilesEnabled();
  return (
    <>
      <h1 className="font-display text-4xl font-extrabold">Your account</h1>
      <section aria-labelledby="profiles" className="mt-8">
        <h2 id="profiles" className="font-display text-2xl font-extrabold">
          Your clubs and academies
        </h2>
        {profiles.length ? (
          <ul className="mt-4 grid gap-4 md:grid-cols-2">
            {profiles.map((profile) => (
              <ProfileStatus key={profile.slug} profile={profile} editable={enabled} />
            ))}
          </ul>
        ) : (
          <div className="mt-4 rounded-[1.25rem] border border-line bg-surface p-6">
            <p className="font-display text-2xl font-extrabold">
              Run an academy, club, committee or ground?
            </p>
            <p className="mt-2 max-w-xl text-muted">
              Create a free profile, list what you offer, and post your matches. Fans in your city
              find them on the city and state pages.
            </p>
            {enabled ? (
              <Link
                href="/dashboard/profiles/new"
                className="mt-4 inline-flex min-h-11 items-center rounded-full bg-[#176B43] px-5 font-medium text-white"
              >
                Create your profile
              </Link>
            ) : (
              <p className="mt-4 text-sm text-muted">
                Profiles need the site&apos;s database, which this preview does not run.
              </p>
            )}
          </div>
        )}
        {enabled && profiles.length > 0 && profiles.length < MAX_PROFILES_PER_ACCOUNT ? (
          <Link
            href="/dashboard/profiles/new"
            className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-link"
          >
            Add another profile
          </Link>
        ) : null}
      </section>
      <section aria-labelledby="activity" className="mt-10">
        <h2 id="activity" className="sr-only">
          Activity
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/dashboard/matches"
            className="rounded-2xl border border-line bg-surface p-5 no-underline"
          >
            <p className="text-sm text-muted">Matches you reported</p>
            <p className="font-display text-4xl font-extrabold">{account.submissions.length}</p>
          </Link>
          <div className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-sm text-muted">Your ticket alerts</p>
            <p className="font-display text-4xl font-extrabold">{account.alertCount}</p>
          </div>
        </div>
      </section>
    </>
  );
}

const STATUS: Record<StoredAcademy["verificationStatus"], string> = {
  pending: "Waiting for its check",
  unverified: "Waiting for its check",
  verified: "Live",
  rejected: "Needs a change",
};

function ProfileStatus({ profile, editable }: { profile: StoredAcademy; editable: boolean }) {
  const live = profile.verificationStatus === "verified";
  return (
    <li className="grid gap-3 rounded-[1.25rem] border border-line bg-surface p-5">
      <p className="flex flex-wrap items-center gap-2 text-xs font-semibold tracking-[0.14em] uppercase">
        <span className="text-link">{PROFILE_KIND_LABEL[profile.kind]}</span>
        <span
          className={
            live
              ? "rounded-full bg-[#176B43] px-2 py-0.5 text-white"
              : profile.verificationStatus === "rejected"
                ? "rounded-full bg-[#8C2F1B] px-2 py-0.5 text-white"
                : "rounded-full border border-line px-2 py-0.5"
          }
        >
          {STATUS[profile.verificationStatus]}
        </span>
      </p>
      <div className="flex items-center gap-3">
        <ProfileLogo name={profile.name} logo={profile.logo} size={48} />
        <div className="min-w-0">
          <p className="font-display text-2xl font-extrabold">{profile.name}</p>
          <p className="text-sm text-muted">
            {profile.cityName}, {profile.stateName ?? profile.countryName}
          </p>
        </div>
      </div>
      {profile.verificationStatus === "rejected" && profile.reviewNotes ? (
        <p className="text-sm">{profile.reviewNotes}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {editable ? (
          <>
            <Link
              href={`/dashboard/profiles/${profile.slug}`}
              className="inline-flex min-h-11 items-center rounded-full bg-[#176B43] px-4 text-sm font-medium text-white"
            >
              Manage
            </Link>
            <Link
              href={`/dashboard/profiles/${profile.slug}/matches/new`}
              className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm"
            >
              Post a match
            </Link>
          </>
        ) : null}
        {live ? (
          <Link
            href={profilePath(profile)}
            className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm"
          >
            Public page
          </Link>
        ) : null}
      </div>
    </li>
  );
}

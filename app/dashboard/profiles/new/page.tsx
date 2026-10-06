import Link from "next/link";
import { ProfileForm } from "@/components/profile/profile-form";
import { getSession } from "@/lib/auth/session";
import { PROFILE_COUNTRIES, profileDefaults } from "@/lib/data/profile-form";
import { profilesEnabled } from "@/lib/data/profiles";
import { PROFILE_KINDS } from "@/lib/domain/profiles";
import { pageMetadata } from "@/lib/seo";
import { firstParam } from "@/lib/utils";

export const metadata = pageMetadata(
  "Create your profile",
  "List your academy, club, committee or ground.",
  "/dashboard/profiles/new",
  false,
);

export default async function NewProfilePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) return null;
  const asked = firstParam((await searchParams).kind) ?? "";
  const kind = PROFILE_KINDS.includes(asked as (typeof PROFILE_KINDS)[number]) ? asked : "";
  return (
    <div className="max-w-3xl">
      <p className="text-sm">
        <Link href="/dashboard">Your account</Link>
      </p>
      <h1 className="mt-2 font-display text-4xl font-extrabold">Create your profile</h1>
      <p className="mt-3 text-muted">
        It takes a few minutes. A moderator checks every new profile once before it goes public.
        Meanwhile you can add your offers and matches.
      </p>
      <div className="mt-8">
        {profilesEnabled() ? (
          <ProfileForm
            defaults={profileDefaults(null, session.email, kind)}
            countries={PROFILE_COUNTRIES}
          />
        ) : (
          <p className="rounded-2xl border border-line bg-surface p-5 text-muted">
            Profiles need the site&apos;s database, which this preview does not run.
          </p>
        )}
      </div>
    </div>
  );
}

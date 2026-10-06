import Link from "next/link";
import { notFound } from "next/navigation";
import { MatchForm } from "@/components/profile/match-form";
import { getSession } from "@/lib/auth/session";
import { ownerProfile } from "@/lib/data/profiles";
import { localParts } from "@/lib/domain/time";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "Edit a match",
  "Change or cancel a match.",
  "/dashboard",
  false,
);

export default async function EditMatchPage({
  params,
}: {
  params: Promise<{ slug: string; match: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const { slug, match: matchSlug } = await params;
  const data = await ownerProfile(session, slug);
  const match = data?.matches.find((item) => item.slug === matchSlug);
  if (!data || !match) notFound();
  const { profile } = data;
  const { date, time } = localParts(match.startsAt, match.timezone);
  return (
    <div className="max-w-3xl">
      <p className="text-sm">
        <Link href={`/dashboard/profiles/${profile.slug}`}>{profile.name}</Link>
      </p>
      <h1 className="mt-2 font-display text-4xl font-extrabold">
        {match.homeName} vs {match.awayName}
      </h1>
      <p className="mt-3 text-muted">
        Change the details, or mark the match postponed or cancelled. Its page keeps the same
        address.
      </p>
      <div className="mt-8">
        <MatchForm
          profile={profile.slug}
          india={profile.countrySlug === "india"}
          verified={profile.verificationStatus === "verified"}
          defaults={{
            match: match.slug,
            competition: match.competitionName === "Friendly match" ? "" : match.competitionName,
            homeTeam: match.homeName,
            awayTeam: match.awayName,
            date,
            time,
            ground: match.venueName,
            state: match.stateSlug ?? profile.stateSlug ?? "",
            city: match.cityName,
            format: match.format,
            attendance: match.attendanceType === "unknown" ? "free" : match.attendanceType,
            entryNotes: match.entryNotes ?? "",
            ticketUrl: "",
            status: match.status === "pending" ? "published" : match.status,
          }}
        />
      </div>
    </div>
  );
}

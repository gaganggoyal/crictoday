import Link from "next/link";
import { notFound } from "next/navigation";
import { MatchForm } from "@/components/profile/match-form";
import { getSession } from "@/lib/auth/session";
import { ownerProfile } from "@/lib/data/profiles";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "Post a match",
  "Add a match to your profile.",
  "/dashboard",
  false,
);

export default async function NewMatchPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession();
  if (!session) return null;
  const { slug } = await params;
  const data = await ownerProfile(session, slug);
  if (!data || data.profile.verificationStatus === "rejected") notFound();
  const { profile } = data;
  const plays = profile.kind === "academy" || profile.kind === "club";
  return (
    <div className="max-w-3xl">
      <p className="text-sm">
        <Link href={`/dashboard/profiles/${profile.slug}`}>{profile.name}</Link>
      </p>
      <h1 className="mt-2 font-display text-4xl font-extrabold">Post a match</h1>
      <p className="mt-3 text-muted">
        {profile.verificationStatus === "verified"
          ? "It goes live as soon as you post it, with your profile as its source."
          : "It goes live when your profile passes its check."}{" "}
        For a tournament, use Post and add another: the next match keeps the tournament, ground and
        date.
      </p>
      <div className="mt-8">
        <MatchForm
          profile={profile.slug}
          india={profile.countrySlug === "india"}
          verified={profile.verificationStatus === "verified"}
          defaults={{
            match: "",
            competition: "",
            homeTeam: plays ? profile.name : "",
            awayTeam: "",
            date: "",
            time: "",
            ground: profile.address,
            state: profile.stateSlug ?? "",
            city: profile.cityName,
            format: "t20",
            attendance: "free",
            entryNotes: "",
            ticketUrl: "",
            status: "published",
          }}
        />
      </div>
    </div>
  );
}

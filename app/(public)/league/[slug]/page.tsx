import Link from "next/link";
import { notFound } from "next/navigation";
import { MatchGrid } from "@/components/match/match-grid";
import { getDirectory } from "@/lib/data/catalog";
import { leagues } from "@/lib/data/seed";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const league = leagues.find((item) => item.slug === slug);
  if (!league) notFound();
  return pageMetadata(
    `${league.name} fixtures and official ticket links`,
    league.summary,
    `/league/${league.slug}`,
  );
}

export default async function LeaguePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const league = leagues.find((item) => item.slug === slug);
  if (!league) notFound();
  const directory = await getDirectory();
  const matches = directory.matches.filter((match) => match.competitionSlug === league.slug);
  const teams = [...new Set(matches.flatMap((match) => [match.homeSlug, match.awaySlug]))];
  return (
    <div className="mx-auto w-full max-w-[1120px] px-5 py-10">
      <p className="text-xs font-semibold tracking-[0.16em] text-link uppercase">League</p>
      <h1 className="font-display text-5xl font-extrabold tracking-tight">{league.name}</h1>
      <p className="mt-3 max-w-2xl text-muted">{league.summary}</p>
      <p className="mt-3 text-sm">
        Season:{" "}
        <Link href={`/league/${league.slug}/${league.seasonSlug}`}>{league.seasonName}</Link>
        {" · "}
        <a href={league.officialUrl} target="_blank" rel="noopener noreferrer">
          Official site
        </a>
      </p>
      <p className="mt-4 max-w-2xl text-sm">{league.ticketGuidance}</p>
      <p className="mt-4 text-sm text-muted">{teams.length} sides in the current listings.</p>
      <div className="mt-8">
        {matches.length ? (
          <MatchGrid matches={matches} now={new Date()} />
        ) : (
          <p className="rounded-2xl border border-dashed border-line p-6">
            No fixtures are listed for this league yet.
          </p>
        )}
      </div>
    </div>
  );
}

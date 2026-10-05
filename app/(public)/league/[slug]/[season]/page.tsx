import { notFound } from "next/navigation";
import { MatchGrid } from "@/components/match/match-grid";
import { getDirectory } from "@/lib/data/catalog";
import { leagues } from "@/lib/data/seed";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ slug: string; season: string }> }) {
  const { slug, season } = await params;
  const league = leagues.find((item) => item.slug === slug && item.seasonSlug === season);
  if (!league) notFound();
  return pageMetadata(`${league.name} ${league.seasonName}`, league.summary, `/league/${slug}/${season}`);
}

export default async function SeasonPage({ params }: { params: Promise<{ slug: string; season: string }> }) {
  const { slug, season } = await params;
  const league = leagues.find((item) => item.slug === slug);
  if (!league) notFound();
  const directory = await getDirectory();
  const matches = directory.matches.filter((match) => match.competitionSlug === slug && match.seasonSlug === season);
  if (league.seasonSlug !== season && matches.length === 0) notFound();
  return (
    <div className="mx-auto w-full max-w-[1120px] px-5 py-10">
      <h1 className="font-display text-5xl font-extrabold tracking-tight">
        {league.name} · {season}
      </h1>
      <div className="mt-8">
        {matches.length ? (
          <MatchGrid matches={matches} now={new Date()} />
        ) : (
          <p>No fixtures are listed for this season yet.</p>
        )}
      </div>
    </div>
  );
}

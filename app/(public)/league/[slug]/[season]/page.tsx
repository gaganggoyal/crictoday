import { notFound } from "next/navigation";
import { MatchGrid } from "@/components/match/match-grid";
import { getDirectory } from "@/lib/data/catalog";
import { leagues } from "@/lib/data/seed";
import { pageMetadata } from "@/lib/seo";

/** The league's current season, or an earlier one that still has listed fixtures. */
async function loadSeason(slug: string, season: string) {
  const league = leagues.find((item) => item.slug === slug);
  if (!league) return null;
  const directory = await getDirectory();
  const matches = directory.matches.filter(
    (match) => match.competitionSlug === slug && match.seasonSlug === season,
  );
  if (league.seasonSlug !== season && matches.length === 0) return null;
  const seasonName =
    league.seasonSlug === season ? league.seasonName : (matches[0]?.seasonName ?? season);
  return { league, matches, seasonName };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; season: string }>;
}) {
  const { slug, season } = await params;
  const loaded = await loadSeason(slug, season);
  if (!loaded) notFound();
  return pageMetadata(
    `${loaded.league.name} ${loaded.seasonName}`,
    loaded.league.summary,
    `/league/${slug}/${season}`,
  );
}

export default async function SeasonPage({
  params,
}: {
  params: Promise<{ slug: string; season: string }>;
}) {
  const { slug, season } = await params;
  const loaded = await loadSeason(slug, season);
  if (!loaded) notFound();
  const { league, matches, seasonName } = loaded;
  return (
    <div className="mx-auto w-full max-w-[1120px] px-5 py-10">
      <h1 className="font-display text-5xl font-extrabold tracking-tight">
        {league.name} · {seasonName}
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

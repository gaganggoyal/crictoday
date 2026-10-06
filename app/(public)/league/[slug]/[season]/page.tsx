import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { MatchGrid, NothingListedYet } from "@/components/match/match-grid";
import { currentTime } from "@/lib/clock";
import { getDirectory } from "@/lib/data/catalog";
import { leagues } from "@/lib/data/seed";
import { pageMetadata, upcomingSummary } from "@/lib/seo";

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
  const { league, matches, seasonName } = loaded;
  const summary = upcomingSummary(matches, currentTime());
  // The current season lists the same fixtures as the league's page, which is the one to index.
  const current = league.seasonSlug === season;
  return pageMetadata(
    `${league.name} ${seasonName} fixtures`,
    summary ? `${seasonName}: ${summary}. ${league.summary}` : league.summary,
    current ? `/league/${slug}` : `/league/${slug}/${season}`,
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
  const summary = upcomingSummary(matches, currentTime());
  return (
    <div className="mx-auto w-full max-w-[1120px] px-5 py-10">
      <Breadcrumbs
        crumbs={[
          { name: "Leagues", path: "/leagues" },
          { name: league.name, path: `/league/${league.slug}` },
          { name: seasonName, path: `/league/${league.slug}/${season}` },
        ]}
      />
      <h1 className="mt-3 font-display text-5xl font-extrabold tracking-tight">
        {league.name} · {seasonName}
      </h1>
      {summary ? <p className="mt-3 max-w-2xl font-medium">{summary}.</p> : null}
      <div className="mt-8">
        {matches.length ? (
          <MatchGrid matches={matches} now={currentTime()} />
        ) : (
          <NothingListedYet title={`${seasonName} fixtures are not listed yet`} />
        )}
      </div>
    </div>
  );
}
